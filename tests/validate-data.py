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

# events: refs + required fields
for e in events:
    if e['loc'] not in lid: errs.append(f"event {e['id']}: unknown loc {e['loc']}")
    for c in e['chars']:
        if c not in cid: errs.append(f"event {e['id']}: unknown char {c}")
    if not e.get('text'): errs.append(f"event {e['id']}: empty text")

# journeys: refs, waypoint time-ordering, timeline bounds
t0, t1 = J['timeline']['t0'], J['timeline']['t1']
for j in journeys:
    for c in j['chars']:
        if c not in cid: errs.append(f"journey {j['id']}: unknown char {c}")
    ts = [w['t'] for w in j['waypoints']]
    if ts != sorted(ts): errs.append(f"journey {j['id']}: waypoints out of time order")
    for w in j['waypoints']:
        if 'eventId' in w and w['eventId'] not in eid:
            errs.append(f"journey {j['id']}: unknown eventId {w['eventId']}")
        if not (t0 - 1 <= w['t'] <= t1 + 0.5):
            errs.append(f"journey {j['id']}: waypoint t={w['t']} outside timeline")

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
