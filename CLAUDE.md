# Lonesome Dove Trail Map

Interactive canvas visualization of the novel *Lonesome Dove* — see README.md for the full tour.

**State (as of the 50-iteration polish loop, June 2026):** 35 events / 26 characters / 24 places /
7 journeys, all quotes verified verbatim-or-removed; two views (Map with story tour + auto mode,
Journeys with scrub/play/follow-the-herd); full keyboard operability and focus management;
reduced-motion support; bottom-sheet cards + scrollable strip on phones; short-viewport label
suppression; pinch/double-tap/inertia/eased-wheel camera with a fully cancel-safe animation state
machine; idle render throttling (0 repaints at rest, ~2ms frames); self-hosted fonts (offline-capable);
deep links + dynamic titles; poster export with imprint; og share card; validated in Chromium,
Firefox, and (risk-assessed) WebKit across 5 viewport classes. Test hook: `window.__ldmap`.

Static site, no build step: `index.html` + `css/` + `js/` (ES modules) + `data/` (canonical book dataset + baked Natural Earth geography).

## Local Deployment

Served by a systemd user service (`lonesome-dove.service`) on **port 18761**, exposed on the tailnet at
https://omachine.werewolf-universe.ts.net/lonesome-dove/

After making code changes, run:
```bash
just redeploy
```
(Static files are served live from this directory; the restart is just belt-and-braces.)

## Testing

`just test` runs the full suite: `tests/validate-data.py` (cross-references, waypoint ordering,
prose hygiene, cast-list sentence cuts) then the visual regression below.

## Visual regression

`tests/visual-check.sh` captures three canonical screenshots (map fit, event card, journeys fit)
and RMSE-compares them against `tests/goldens/`. Renders are reproducible (seeded parchment noise,
reduced-motion, toast suppressed). After **intentional** visual changes: `tests/visual-check.sh --bless`.

## Conventions

- Served by `serve.py` (sends `Cache-Control: no-cache`); asset links in `index.html` carry `?v=N` — **bump the version when changing css/js/fonts** so stale browser caches can't serve old code.

- All asset/data paths in HTML/JS must stay **relative** (no leading `/`) — the site is served under the `/lonesome-dove/` subpath via Tailscale Serve.
- `data/*.json` is the canonical source of truth for the book content. `t` values everywhere are **months since March 1876** (the conventional dating of the drive). Keep `events.json` t-values and `journeys.json` waypoint t-values consistent — `python3` cross-reference check lives in git history / can be re-run by validating ids between files.
- `data/geo/` is generated from Natural Earth (10m rivers + NA supplement) and US states GeoJSON, filtered to the corridor bbox and RDP-simplified. Regeneration scripts were one-shot; treat these files as baked assets.
