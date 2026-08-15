#!/usr/bin/env python3
"""Canonical dataset integrity checks: cross-references, ordering, prose hygiene."""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'data'
errs = []

chars = json.load(open(ROOT / 'characters.json'))['characters']
locs = json.load(open(ROOT / 'locations.json'))['locations']
events = json.load(open(ROOT / 'events.json'))['events']
J = json.load(open(ROOT / 'journeys.json'))
journeys = J['journeys']

cid = {c['id'] for c in chars}
lid = {l['id'] for l in locs}
eid = {e['id'] for e in events}
jid = {j['id'] for j in journeys}
event_by_id = {e['id']: e for e in events}
WAYPOINT_BASES = {'explicit', 'inferred', 'interpolation'}
LOCATION_TYPES = {'town', 'ranch', 'crossing', 'grave', 'river', 'landmark'}
MONTHS = ['March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
          'November', 'December', 'January', 'February', 'March', 'April', 'May',
          'June', 'July', 'August']

# events: refs + required fields
event_ts = [e['t'] for e in events]
if event_ts != sorted(event_ts): errs.append("events: entries out of chronological order")
for e in events:
    if e['loc'] not in lid: errs.append(f"event {e['id']}: unknown loc {e['loc']}")
    for c in e['chars']:
        if c not in cid: errs.append(f"event {e['id']}: unknown char {c}")
    if not e.get('text'): errs.append(f"event {e['id']}: empty text")
    month_index = int(e['t'])
    expected_year = 1876 if month_index < 10 else 1877
    if MONTHS[month_index] not in e['date'] or str(expected_year) not in e['date']:
        errs.append(f"event {e['id']}: date '{e['date']}' disagrees with t={e['t']}")

# locations: supported renderer types + uncertainty contract
for loc in locs:
    if loc['type'] not in LOCATION_TYPES:
        errs.append(f"location {loc['id']}: unsupported type {loc['type']}")
    if loc.get('fictional') and loc.get('approx') is not True:
        errs.append(f"location {loc['id']}: fictional site must set approx:true")

# journeys: refs, waypoint time-ordering, timeline bounds
t0, t1 = J['timeline']['t0'], J['timeline']['t1']
for j in journeys:
    for c in j['chars']:
        if c not in cid: errs.append(f"journey {j['id']}: unknown char {c}")
    ts = [w['t'] for w in j['waypoints']]
    if ts != sorted(ts): errs.append(f"journey {j['id']}: waypoints out of time order")
    for w in j['waypoints']:
        basis = w.get('basis')
        if basis not in WAYPOINT_BASES:
            errs.append(f"journey {j['id']}: waypoint t={w['t']} has invalid/missing basis")
        if basis in ('inferred', 'interpolation') and w.get('approx') is not True:
            errs.append(f"journey {j['id']}: {basis} waypoint t={w['t']} must set approx:true")
        if 'eventId' in w:
            if w['eventId'] not in eid:
                errs.append(f"journey {j['id']}: unknown eventId {w['eventId']}")
            elif w['t'] != event_by_id[w['eventId']]['t']:
                errs.append(
                    f"journey {j['id']}: waypoint/event time mismatch for {w['eventId']} "
                    f"({w['t']} != {event_by_id[w['eventId']]['t']})"
                )
        if not (t0 - 1 <= w['t'] <= t1 + 0.5):
            errs.append(f"journey {j['id']}: waypoint t={w['t']} outside timeline")

# Cross-story sequence constraints that a per-array sort cannot catch.
drive = next(j for j in journeys if j['id'] == 'drive')
drive_by_label = {w.get('label'): w for w in drive['waypoints'] if w.get('label')}
ordered_moments = [
    ('massacre', event_by_id['massacre']['t']),
    ('Red River', drive_by_label['Red River']['t']),
    ('The storm', drive_by_label['The storm']['t']),
    ('The Canadian', drive_by_label['The Canadian']['t']),
    ('wilbarger-death', event_by_id['wilbarger-death']['t']),
    ('The Arkansas', drive_by_label['The Arkansas']['t']),
    ('jake-hanged', event_by_id['jake-hanged']['t']),
]
for (a_name, a_t), (b_name, b_t) in zip(ordered_moments, ordered_moments[1:]):
    if a_t >= b_t:
        errs.append(f"cross-story order: {a_name} t={a_t} must precede {b_name} t={b_t}")

# The Elmira line uses the modern Bent's Old Fort NHS as its explicit map anchor.
bents = next(loc for loc in locs if loc['id'] == 'bents-fort')
elmira = next(j for j in journeys if j['id'] == 'elmira')
elmira_bents = next(w for w in elmira['waypoints'] if w.get('label') == "Bent's Old Fort")
if (bents['lat'], bents['lon']) != (38.039775, -103.42665):
    errs.append("location bents-fort: coordinates must anchor Bent's Old Fort NHS")
if (elmira_bents['lat'], elmira_bents['lon']) != (bents['lat'], bents['lon']):
    errs.append("journey elmira: Bent's Old Fort waypoint must match location anchor")

# characters: journey refs
for c in chars:
    for ref in c.get('journeys', []):
        if ref not in jid: errs.append(f"char {c['id']}: unknown journey {ref}")
    # cast list cuts at the first period — make sure that cut reads as a sentence
    first = c['role'].split('.')[0].rstrip()
    if first.endswith(("'s", ' and', ' the', ' of', ' with', '—')) or len(first) < 25:
        errs.append(f"char {c['id']}: bad first-sentence cut: “{first}.”")

# prose hygiene: doubled words / double spaces anywhere
def walk(o, path, fname):
    if isinstance(o, str):
        if '  ' in o: errs.append(f"{fname} {path}: double space")
        m = re.search(r'\b(\w+) \1\b', o, re.I)
        if m and m.group(1).lower() not in ('that', 'had', 'is'):
            errs.append(f"{fname} {path}: doubled word '{m.group(1)}'")
    elif isinstance(o, dict):
        for k, v in o.items(): walk(v, f"{path}.{k}", fname)
    elif isinstance(o, list):
        for i, v in enumerate(o): walk(v, f"{path}[{i}]", fname)

for fname in ('characters.json', 'locations.json', 'events.json', 'journeys.json'):
    walk(json.load(open(ROOT / fname)), '', fname)

if errs:
    print('\n'.join(errs))
    sys.exit(1)
print(f"DATA OK — {len(events)} events, {len(chars)} characters, {len(locs)} locations, {len(journeys)} journeys")
