# Lonesome Dove — The Trail from Texas to Montana

An interactive, canvas-drawn chart of Larry McMurtry's *Lonesome Dove* (1985):
the Hat Creek outfit's cattle drive from the Rio Grande to the Milk River,
and every journey that crosses it.

Styled as an 1876 hand-inked survey map: Albers conic projection (curved
parallels, degree labels on the frame), parchment with hand-tint wash, shared-
topology borders (the river *is* the boundary where history had it), engraver's
mountains, period territory names, and real river geography from Natural Earth —
with the Milk River's Montana reach hand-restored.

## Views

- **The Map** — every significant site with period glyphs (✟ graves, ✕ crossings).
  Click any marker for what happened there; **✦ Ride the Story** (or the
  chronology strip, with month ticks and epitaph hovers on the death diamonds)
  steps through all 35 events in order. ←/→ navigate; deaths dim the light.
- **The Journeys** — seven trails, one per storyline, each in its own ink.
  Scrub or play March 1876 → July 1877 (note the ❄ hard-winter band); toggle,
  solo (double-click), or read (shift-click) trails from the legend;
  **⌖ follow the herd** rides the camera north with the drive. Zoom in during
  playback and you may spot the blue pigs.

Also aboard: **Dramatis Personæ** (the full company, color-keyed),
**About this chart** (methods, sources, the Whipple epigraph), **⤓ Poster**
(high-resolution PNG export of the current view), deep links for every card
(`#event/gus-death`, `#rider/deets`, `#journey/return`, `#cast`, `#about`),
pinch-zoom and inertial pan, `prefers-reduced-motion` support, idle render
throttling, and an og:image rendered from the chart itself.

## Data

`data/` is a canonical, hand-built dataset of the novel:

| file | contents |
|---|---|
| `characters.json` | 26 characters — role, fate, trail color |
| `locations.json` | 24 sites with coordinate estimates (`approx` flagged) |
| `events.json` | 35 events, ordered, `t` = months since March 1876 |
| `journeys.json` | 7 journeys as time-parameterized waypoint paths |
| `geo/` | rivers (Natural Earth 10m + NA supplement), shared-topology borders, states (coast source) |

The novel gives no dates; convention places the drive in 1876–77, and all dates
are marked *circa*. Fictional sites are placed by the book's internal geography.

## Running

Static site, no build step. Locally it runs as the `lonesome-dove` systemd user
service on port 18761 (see `CLAUDE.md`); ad hoc:

```bash
python3 serve.py 18761   # sends Cache-Control: no-cache so updates always reach the browser
# → http://127.0.0.1:18761/
```

`just test` runs the dataset integrity checks and the visual-regression suite.

*"Uva uvam vivendo varia fit."*
