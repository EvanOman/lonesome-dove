---
date: 2026-08-15
topic: trail-gazetteer
---

# Trail Gazetteer

## What We're Building

Add a searchable Gazetteer drawer to the existing Map view. It lists every mapped place, distinguishes recorded places from regional and fictional estimates, and opens an expanded location card without hiding the chart. Location cards show the map anchor, coordinate confidence, a Google Maps link, curated reference links, related story events, and alternative candidates when the novel's wording is ambiguous.

Bent's Fort is the model for an ambiguous entry: the map remains anchored to Bent's Old Fort National Historic Site, while the card compares Bent's Old Fort with Bent's New Fort, notes the conventional 1876 chronology problem, and gives the National Park Service's approximately forty-mile downriver relationship.

## Why This Approach

The existing Map already contains the location layer and the existing story panel already serves as a directory for Dramatis Personæ. Reusing that pattern makes places discoverable without adding a third canvas mode or crowding the trail comparison view. The visual direction is a compact surveyor's field index: ruled paper, cartographic symbols, restrained oxblood controls, and the existing type system.

## Key Decisions

- Entry point: Add a visible `Gazetteer` masthead button beside `Dramatis Personæ`.
- Browsing: Search plus All, Recorded, Estimated, and Fictional filters.
- Confidence: Derive the category from the canonical `approx` and `fictional` flags.
- External maps: Generate a Google Maps coordinate link for every location; label fictional and regional links as estimates.
- References: Store only curated links in `locations.json`; do not guess Wikipedia pages automatically.
- Ambiguity: Store candidate comparisons on the affected location rather than adding misleading story markers.
- Navigation: Location cards include a return control to the Gazetteer and retain shareable `#place/...` URLs.

## Open Questions

- None for the initial release. Additional ambiguous sites can adopt the same candidate schema later.

## Next Steps

Implement the drawer, enriched location cards, data validation, and desktop/mobile browser coverage.
