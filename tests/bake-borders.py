#!/usr/bin/env python3
"""Bake data/geo/borders.json from data/geo/states.json.

Extracts border polylines from US state polygons:
  1. Collects every polygon edge, deduplicating shared edges (each
     boundary drawn once, not once per adjacent polygon).
  2. Drops coastal edges and river-hugging boundaries (Red River,
     Rio Grande, Sabine River).
  3. Chains surviving edges into polylines and RDP-simplifies.
  4. Post-filters any polyline that substantially overlaps an
     already-kept one — catches near-duplicate river digitizations
     where adjacent polygons trace the same course with slightly
     different vertices.

The old bake used 4-decimal rounding for dedup keys, which failed
when two polygons digitized a shared river boundary with vertices
differing by 0.001 deg.  This script uses 3-decimal snapping (so
0.001 differences collapse) and also applies a polyline-overlap
post-filter to catch remaining near-duplicates — including 2-point
straight-line borders where adjacent states segment the same boundary
with different intermediate vertices (producing single-state edges
with non-matching keys).
"""
import json
import math
from pathlib import Path
from collections import Counter, defaultdict

ROOT = Path(__file__).resolve().parent.parent / "data" / "geo"

# ---------------------------------------------------------------------------
# 1. Load state polygons
# ---------------------------------------------------------------------------
states = json.load(open(ROOT / "states.json"))

# River geometry for boundary exclusion: where a state border IS a river
# (Rio Grande, Red River), the river line already represents that boundary,
# so we must not also draw a dashed political border on top of it.
_rivers = json.load(open(ROOT / "rivers.json"))
def _river_pts(name, lon0=-180.0, lon1=180.0):
    return [p for r in _rivers if r["name"] == name
            for l in r["lines"] for p in l if lon0 <= p[0] <= lon1]
_RIO = _river_pts("Rio Grande")
_RED = _river_pts("Red", -100.8, -94.0)

def _near_river(mx, my, tol=0.13):
    t2 = tol * tol
    if 25.5 <= my <= 32.2:                       # Rio Grande: whole TX-Mexico border
        if any((mx - qx) ** 2 + (my - qy) ** 2 < t2 for qx, qy in _RIO):
            return True
    if 33.0 <= my <= 34.6 and -100.8 <= mx <= -94.0:  # Red River: TX-OK / AR-TX
        if any((mx - qx) ** 2 + (my - qy) ** 2 < t2 for qx, qy in _RED):
            return True
    return False

# ---------------------------------------------------------------------------
# 2. Collect every polygon edge
# ---------------------------------------------------------------------------
# Dedup key: snap endpoints to 3 decimal places.  This collapses 0.001-deg
# differences along river boundaries where adjacent polygons trace the same
# course with slightly different vertices (e.g. -90.750 vs -90.749).

SNAP = 3

def _snap(pt):
    return (round(pt[0], SNAP), round(pt[1], SNAP))

def _key(a, b):
    return tuple(sorted([_snap(a), _snap(b)]))

edge_count = Counter()          # dedup key -> number of state polygons
edge_raw = {}                   # dedup key -> (raw_a, raw_b) first seen
edge_states = defaultdict(set)  # dedup key -> set of state names

for s in states:
    for polys in s["polys"]:
        ring = polys[0]
        for i in range(len(ring) - 1):
            a, b = ring[i], ring[i + 1]
            k = _key(a, b)
            edge_count[k] += 1
            edge_states[k].add(s["name"])
            if k not in edge_raw:
                edge_raw[k] = (a, b)

shared_keys = {k for k, c in edge_count.items() if c >= 2}
single_keys = {k for k, c in edge_count.items() if c == 1}

print(f"Total unique edge keys: {len(edge_count)}")
print(f"Shared (2+ states):     {len(shared_keys)}")
print(f"Single (1 state):       {len(single_keys)}")

# ---------------------------------------------------------------------------
# 3. Decide which edges to include
# ---------------------------------------------------------------------------
# Include:
#   - Every shared edge (each drawn exactly once)
#   - Single-state edges that are NOT near-duplicates of shared edges
#     and NOT coastal / river-excluded
#
# Exclude:
#   a) Red River (TX-OK winding boundary)
#   b) Sabine River (TX-LA below lat 31)
#   c) AR-TX Red River segment
#   d) NM-TX Rio Grande near El Paso
#   e) Coastal edges on Gulf of Mexico
#   f) Single-state edges that run near a shared edge (near-duplicates
#      from the other polygon's copy of a river-following boundary)

def _mid(a, b):
    return ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)


def _should_exclude_shared(k):
    """Exclusion rules for shared (2-state) edges."""
    pair = frozenset(edge_states[k])
    a, b = edge_raw[k]
    mx, my = _mid(a, b)

    # River boundaries (Red River) — the river line represents these
    if _near_river(mx, my):
        return True

    # Red River: TX-OK (keep panhandle straight borders only)
    if pair == frozenset({"Texas", "Oklahoma"}):
        if mx >= -99.5 and my <= 36.0:
            return True

    # Sabine River: TX-LA below lat 31
    if pair == frozenset({"Texas", "Louisiana"}):
        if my < 31.0:
            return True

    # AR-TX Red River near Texarkana
    if pair == frozenset({"Arkansas", "Texas"}):
        if my < 34.0:
            return True

    # NM-TX Rio Grande near El Paso
    if pair == frozenset({"New Mexico", "Texas"}):
        if my < 32.1 and mx > -107.0:
            return True

    return False


def _should_exclude_single(k):
    """Exclusion rules for single-state edges."""
    a, b = edge_raw[k]
    mx, my = _mid(a, b)

    # Rio Grande (TX-Mexico border) — the river line represents this boundary
    if _near_river(mx, my):
        return True

    # Gulf coast: very low latitudes
    if my < 29.0:
        return True
    # TX coast
    state = next(iter(edge_states[k]))
    if state == "Texas" and my < 30.0 and mx > -97.9:
        return True
    # LA coast
    if state == "Louisiana" and my < 30.2 and mx > -93.0:
        return True
    # MS coast (but keep the MS-AL straight border)
    if state == "Mississippi" and my < 30.5 and mx > -89.5:
        return True

    return False


# Build the set of shared edge midpoints for near-duplicate detection
shared_midpoints = []
for k in shared_keys:
    if not _should_exclude_shared(k):
        a, b = edge_raw[k]
        shared_midpoints.append(_mid(a, b))


def _is_near_duplicate(k):
    """Check if a single-state edge is a near-duplicate of a shared edge."""
    a, b = edge_raw[k]
    mx, my = _mid(a, b)
    for smx, smy in shared_midpoints:
        if abs(mx - smx) < 0.04 and abs(my - smy) < 0.04:
            return True
    return False


# Collect border edges
border_keys = set()
excluded_shared = 0
excluded_single = 0
excluded_neardup = 0

for k in shared_keys:
    if _should_exclude_shared(k):
        excluded_shared += 1
    else:
        border_keys.add(k)

for k in single_keys:
    if _should_exclude_single(k):
        excluded_single += 1
    elif _is_near_duplicate(k):
        excluded_neardup += 1
    else:
        border_keys.add(k)

print(f"Excluded shared:      {excluded_shared}")
print(f"Excluded single:      {excluded_single}")
print(f"Excluded near-dupes:  {excluded_neardup}")
print(f"Border edges to draw: {len(border_keys)}")

# ---------------------------------------------------------------------------
# 4. Build adjacency graph and chain edges into polylines
# ---------------------------------------------------------------------------
adj = defaultdict(list)
for k in border_keys:
    a_raw, b_raw = edge_raw[k]
    a_snap = _snap(a_raw)
    b_snap = _snap(b_raw)
    adj[a_snap].append((b_snap, k, a_raw, b_raw))
    adj[b_snap].append((a_snap, k, b_raw, a_raw))

# Node degrees for chain termination
node_degree = Counter()
for k in border_keys:
    a_raw, b_raw = edge_raw[k]
    node_degree[_snap(a_raw)] += 1
    node_degree[_snap(b_raw)] += 1

used = set()
polylines = []

def chain_from(start_snap, start_raw):
    """Walk a chain from start, stopping at junctions/endpoints (degree != 2)."""
    pts_raw = [start_raw]
    cur_snap = start_snap
    while True:
        if node_degree[cur_snap] != 2:
            break
        found = False
        for neighbor_snap, k, this_raw, neighbor_raw in adj[cur_snap]:
            if k not in used:
                used.add(k)
                pts_raw.append(neighbor_raw)
                cur_snap = neighbor_snap
                found = True
                break
        if not found:
            break
    return pts_raw

# Start from endpoints (degree 1) and junctions (degree 3+)
starters = sorted([n for n, d in node_degree.items() if d != 2])

for start_snap in starters:
    for neighbor_snap, k, this_raw, neighbor_raw in adj[start_snap]:
        if k not in used:
            used.add(k)
            rest = chain_from(neighbor_snap, neighbor_raw)
            pts = [this_raw] + rest
            if len(pts) >= 2:
                polylines.append(pts)

# Handle remaining cycles (all degree-2 nodes)
for k in sorted(border_keys - used):
    if k in used:
        continue
    used.add(k)
    a_raw, b_raw = edge_raw[k]
    rest = chain_from(_snap(b_raw), b_raw)
    pts = [a_raw] + rest
    if len(pts) >= 2:
        polylines.append(pts)

print(f"Chained into {len(polylines)} polylines, "
      f"{sum(len(p) for p in polylines)} points")

# ---------------------------------------------------------------------------
# 5. RDP simplification
# ---------------------------------------------------------------------------

def _perpendicular_dist(pt, ls, le):
    dx = le[0] - ls[0]
    dy = le[1] - ls[1]
    d2 = dx * dx + dy * dy
    if d2 == 0:
        return math.hypot(pt[0] - ls[0], pt[1] - ls[1])
    t = max(0, min(1, ((pt[0] - ls[0]) * dx + (pt[1] - ls[1]) * dy) / d2))
    return math.hypot(pt[0] - (ls[0] + t * dx), pt[1] - (ls[1] + t * dy))


def rdp(pts, epsilon):
    if len(pts) <= 2:
        return pts
    dmax = 0
    idx = 0
    for i in range(1, len(pts) - 1):
        d = _perpendicular_dist(pts[i], pts[0], pts[-1])
        if d > dmax:
            dmax = d
            idx = i
    if dmax > epsilon:
        left = rdp(pts[:idx + 1], epsilon)
        right = rdp(pts[idx:], epsilon)
        return left[:-1] + right
    return [pts[0], pts[-1]]


EPSILON = 0.012

simplified = []
for pl in polylines:
    s = rdp(pl, EPSILON)
    if len(s) >= 2:
        simplified.append(s)

print(f"After RDP (eps={EPSILON}): {len(simplified)} polylines, "
      f"{sum(len(p) for p in simplified)} points")

# ---------------------------------------------------------------------------
# 6. Post-filter: drop polylines that substantially overlap a kept one
# ---------------------------------------------------------------------------
# Safety net: catches any near-duplicate polylines that slipped through
# the edge-level near-duplicate filter (e.g. if two adjacent polygons
# have slightly different chain structure).

def _point_to_polyline_dist(pt, polyline):
    best = float("inf")
    for i in range(len(polyline) - 1):
        d = _perpendicular_dist(pt, polyline[i], polyline[i + 1])
        if d < best:
            best = d
    return best


def _polyline_length(pl):
    total = 0
    for i in range(len(pl) - 1):
        total += math.hypot(pl[i+1][0] - pl[i][0], pl[i+1][1] - pl[i][1])
    return total


def _sample_along(polyline, n=12):
    """Sample n evenly-spaced points along a polyline (including endpoints)."""
    if len(polyline) < 2:
        return []
    # For short polylines, always include endpoints + midpoint
    if len(polyline) == 2:
        a, b = polyline[0], polyline[1]
        return [
            [a[0], a[1]],
            [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
            [b[0], b[1]],
        ]
    # For longer polylines, sample segment midpoints
    pts = []
    step = max(1, (len(polyline) - 1) // n)
    for i in range(0, len(polyline) - 1, step):
        mx = (polyline[i][0] + polyline[i + 1][0]) / 2
        my = (polyline[i][1] + polyline[i + 1][1]) / 2
        pts.append([mx, my])
    return pts


OVERLAP_DIST = 0.025
OVERLAP_RATIO = 0.65

simplified.sort(key=lambda pl: -_polyline_length(pl))


def _bbox(pl):
    """Return (min_lon, min_lat, max_lon, max_lat) for a polyline."""
    lons = [p[0] for p in pl]
    lats = [p[1] for p in pl]
    return (min(lons), min(lats), max(lons), max(lats))


def _bbox_overlap(bb1, bb2, margin=0.05):
    """Check if two bounding boxes overlap (with margin)."""
    return not (bb1[2] + margin < bb2[0] or bb2[2] + margin < bb1[0] or
                bb1[3] + margin < bb2[1] or bb2[3] + margin < bb1[1])


def _endpoints_on_other(pl, other):
    """Check if both endpoints of pl lie on or very near 'other'."""
    d0 = _point_to_polyline_dist(pl[0], other)
    d1 = _point_to_polyline_dist(pl[-1], other)
    return d0 < OVERLAP_DIST and d1 < OVERLAP_DIST


kept = []
kept_bboxes = []
dropped = 0
for pl in simplified:
    samples = _sample_along(pl)
    if not samples:
        kept.append(pl)
        kept_bboxes.append(_bbox(pl))
        continue

    pl_bb = _bbox(pl)
    is_overlap = False
    for oi, other in enumerate(kept):
        # Quick bbox rejection — skip pairs with non-overlapping extents
        if not _bbox_overlap(pl_bb, kept_bboxes[oi]):
            continue
        # Both endpoints of the candidate must lie on the existing polyline
        if not _endpoints_on_other(pl, other):
            continue
        # Sample-based overlap check
        close_count = sum(
            1 for pt in samples
            if _point_to_polyline_dist(pt, other) < OVERLAP_DIST
        )
        if close_count / len(samples) >= OVERLAP_RATIO:
            is_overlap = True
            break

    if is_overlap:
        dropped += 1
        continue

    kept.append(pl)
    kept_bboxes.append(pl_bb)

if dropped:
    print(f"Dropped {dropped} overlapping polylines")
print(f"After overlap filter: {len(kept)} polylines, "
      f"{sum(len(p) for p in kept)} points")

# ---------------------------------------------------------------------------
# 7. Round coordinates and write output
# ---------------------------------------------------------------------------

def _round_pt(pt):
    return [round(pt[0], 3), round(pt[1], 3)]

output = [[_round_pt(p) for p in pl] for pl in kept]
output.sort(key=lambda pl: (pl[0], pl[1] if len(pl) > 1 else []))

total_pts = sum(len(pl) for pl in output)
print(f"\nFinal: {len(output)} polylines, {total_pts} points")

all_lons = [p[0] for pl in output for p in pl]
all_lats = [p[1] for pl in output for p in pl]
print(f"Bbox: lon [{min(all_lons):.1f}, {max(all_lons):.1f}], "
      f"lat [{min(all_lats):.1f}, {max(all_lats):.1f}]")

out_path = ROOT / "borders.json"
with open(out_path, "w") as f:
    json.dump(output, f, separators=(",", ":"))

print(f"Wrote {out_path} ({out_path.stat().st_size} bytes)")
