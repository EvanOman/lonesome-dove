# Route audit

## Method

The seven journey polylines were checked waypoint by waypoint against the novel, including unlabeled shape points. Chapter numbers below refer to the numbered chapters in the source text used for the audit. Short locators paraphrase or quote only a few words.

Each waypoint now carries one of three evidence values:

- `explicit`: the novel names the place, crossing, or event.
- `inferred`: the novel gives a relative direction or region but not a recoverable point.
- `interpolation`: the point exists only to make the map route legible.

Every inferred or interpolated point has `approx: true`. Explicit points also have `approx: true` when the exact site is fictional, unnamed, or otherwise uncertain. Exact fractional `t` values are visualization choices; only their order, linked-event equality, and the conventional March 1876–August 1877 frame should be treated as claims.

Journey `chars` are featured participants in that storyline, not exhaustive manifests and not a claim that each character travels every segment. This is especially important for Lorena on the composite Jake and Blue Duck trails, and for Roscoe, Joe, and Janey on July's route. Luke is therefore not added merely to make Elmira's featured cast exhaustive.

## Waypoint validation

### `drive` (indices 0–28)

| Indices | Basis | Chapter evidence / validation |
|---|---|---|
| 0–3 | explicit, approximate | Chs. 1, 9–11, 25, 30, 35: Lonesome Dove, Hacienda Flores, drive departure, and Nueces crossing. Fictional or unnamed sites remain approximate. |
| 4–8 | interpolation, approximate | Chs. 35–60: shape points between the Nueces, San Antonio corridor, and north Texas; no exact sites are stated. |
| 9 | explicit, approximate | Ch. 60, “Red”: the herd crosses into Indian Territory. |
| 10 | explicit, approximate | Ch. 62, “half a day from the Canadian”: Bill Spettle's storm follows the Red crossing. |
| 11 | explicit, approximate | Ch. 62: approach to and crossing of the Canadian. |
| 12 | interpolation, approximate | Chs. 62–72: Canadian-to-Arkansas route shaping. |
| 13 | explicit, approximate | Ch. 72, “far west of Dodge”: Arkansas crossing shifted west of Dodge. |
| 14 | explicit, approximate | Ch. 74: hanging beside a steep-banked creek and nearby trees; tree species is not given. |
| 15 | interpolation, approximate | Chs. 74–80: western Kansas toward the Republican. |
| 16 | explicit, approximate | Ch. 80: Republican crossing. |
| 17 | explicit | Chs. 84–86: Ogallala. |
| 18 | explicit, approximate | Chs. 84–87: Clara's fictional ranch near the Platte, roughly twenty miles from town. |
| 19–21 | interpolation, approximate | Ch. 89: west along the Platte, then northwest toward Salt Creek and the Powder. |
| 22 | explicit, approximate | Ch. 90, “north of the juncture”: Deets's grave near the Salt Creek–Powder confluence. |
| 23–24 | interpolation, approximate | Chs. 91–93: Powder/Crazy Woman/Bighorn corridor into Montana. |
| 25 | explicit, approximate | Ch. 94: Yellowstone crossing after the herd is already in Montana. |
| 26–27 | explicit, approximate | Ch. 98: Missouri near Fort Benton, then the Marias; these replace the former false direct line to the Milk. |
| 28 | explicit, approximate | Ch. 98: fictional ranch between the Milk and Missouri, with cattle moved east. |

### `rescue` (indices 0–7)

| Indices | Basis | Chapter evidence / validation |
|---|---|---|
| 0 | explicit, approximate | Chs. 47–48: Gus leaves the Hat Creek camp west of Austin, not the Red River. |
| 1 | inferred, approximate | Ch. 54: Clear Fork country; exact crossing point is unknown. |
| 2 | interpolation, approximate | Ch. 54: route shaping through the Wichita/Prairie Dog Fork/Palo Duro corridor. |
| 3 | explicit, approximate | Chs. 56–57: Gus and July charge the captive camp at night after Blue Duck leaves. |
| 4 | explicit, approximate | Ch. 58: Roscoe's waiting camp is upriver/west of the captive camp. |
| 5 | inferred, approximate | Chs. 60–61: a distinct later tent camp near the Canadian. |
| 6 | interpolation, approximate | Ch. 63: northbound trailing route. |
| 7 | inferred, approximate | Ch. 63: Gus keeps Lorena behind the herd rather than rejoining it. |

### `jake` (indices 0–11)

| Indices | Basis | Chapter evidence / validation |
|---|---|---|
| 0 | explicit, approximate | Ch. 25: departure from fictional Lonesome Dove. |
| 1 | explicit, approximate | Ch. 40: Lorena refuses to enter San Antonio. The town center is only a regional anchor. |
| 2 | explicit, approximate | Chs. 44–48: their fictional camp west of Austin. |
| 3 | explicit | Chs. 44, 48: Jake gambles in Austin while Lorena waits outside town. |
| 4 | explicit, approximate | Ch. 48: Blue Duck takes Lorena from the Austin-area camp. |
| 5–6 | explicit | Chs. 59, 64: Jake reaches Fort Worth and then meets the Suggses in Dallas. |
| 7–9 | interpolation, approximate | Chs. 64, 68–71: northward travel through Indian Territory. |
| 10 | inferred, approximate | Chs. 71–72: Wilbarger's ambush west of Dodge near the Arkansas corridor. |
| 11 | explicit, approximate | Ch. 74: Jake and the Suggs brothers are hanged in western Kansas. |

### `blueduck` (indices 0–5)

| Indices | Basis | Chapter evidence / validation |
|---|---|---|
| 0 | explicit, approximate | Chs. 45–48: abduction from Lorena's camp west of Austin. |
| 1 | interpolation, approximate | Ch. 49: northwest forced travel through increasingly empty country. |
| 2 | explicit, approximate | Chs. 49, 54–57: the captive camp in the Canadian breaks. |
| 3 | inferred, approximate | Ch. 57: Blue Duck leaves before the rescue. |
| 4 | explicit, approximate | Ch. 58: he doubles back upriver and kills Roscoe, Joe, and Janey. |
| 5 | inferred, approximate | Ch. 58: Gus infers a destination toward the Purgatory River. The route ends here because the next year is unnarrated. |

Blue Duck's Santa Rosa death remains a standalone event and a stop on Call's return. Drawing a continuous Canadian-to-Santa-Rosa leg would invent his missing itinerary.

### `july` (indices 0–21)

| Indices | Basis | Chapter evidence / validation |
|---|---|---|
| 0 | explicit | Ch. 28: July and Joe leave Fort Smith. |
| 1–2 | interpolation, approximate | Ch. 50: Fort Smith–Red River–Fort Worth shaping. |
| 3 | explicit | Ch. 50: first Fort Worth visit. |
| 4–5 | inferred, approximate | Chs. 50–52: July rides east, finds Roscoe and Janey on the Fort Smith trail. |
| 6 | explicit | Ch. 52: return west to Fort Worth. |
| 7 | inferred, approximate | Chs. 52, 56: north with Roscoe, Joe, and Janey. |
| 8 | interpolation, approximate | Ch. 56: approach to the Canadian. |
| 9–10 | explicit, approximate | Chs. 56–58: downriver rescue and upriver return to three graves. |
| 11 | interpolation, approximate | Chs. 58, 65: travel north after the Canadian. |
| 12 | explicit | Ch. 69: Dodge City. |
| 13 | inferred, approximate | Ch. 77: failed northward attempt after a horse is hurt. |
| 14 | explicit | Ch. 77: forced return to Dodge. |
| 15 | explicit, approximate | Ch. 77: Republican crossing. |
| 16–19 | explicit; ranch points approximate | Chs. 77, 80–82: Clara's ranch → Ogallala → ranch → Ogallala. |
| 20 | inferred, approximate | Ch. 81: brief eastward pursuit of Elmira. |
| 21 | explicit, approximate | Ch. 82: July returns to Clara's and stays. |

### `elmira` (indices 0–13)

| Indices | Basis | Chapter evidence / validation |
|---|---|---|
| 0 | explicit | Chs. 29, 36: departure from Fort Smith on the whiskey boat. |
| 1–6 | interpolation, approximate | Chs. 36, 53: upstream Arkansas route shaping. |
| 7 | inferred, approximate | Ch. 53: whiskey transferred at an unnamed landing. |
| 8 | explicit, approximate | Ch. 53: Bent's Fort, anchored to the modern Bent's Old Fort National Historic Site near La Junta. The novel's chronology remains qualified below. |
| 9 | explicit, approximate | Ch. 75 retrospective: Republican crossing. |
| 10 | explicit, approximate | Ch. 75: Clara's ranch and Martin's birth. |
| 11 | explicit | Chs. 75–76: Ogallala and Dee Boot after the birth. |
| 12 | interpolation, approximate | Chs. 80, 83: eastbound Platte-road shaping. |
| 13 | explicit, approximate | Chs. 83, 87: reported deaths about sixty miles east of Ogallala; attackers not specifically identified. |

### `return` (indices 0–17)

| Indices | Basis | Chapter evidence / validation |
|---|---|---|
| 0 | explicit, approximate | Ch. 100: Call leaves the fictional Milk River ranch in late spring. |
| 1 | explicit | Ch. 101: Miles City, coffin, and buggy. |
| 2–4 | interpolation, approximate | Ch. 101: eleven-day Wyoming/Nebraska transit. The former unsupported “past Deets's grave” label was removed. |
| 5 | explicit, approximate | Ch. 101: Clara's ranch and the delivered letters. |
| 6–7 | explicit, approximate | Ch. 102: down the Platte, across the Republican, and into Kansas. |
| 8 | explicit | Ch. 102: west to Denver. |
| 9–10 | explicit, approximate | Ch. 102: Purgatoire corridor and Raton Pass. |
| 11 | explicit | Ch. 102: Santa Rosa and Blue Duck's death. |
| 12 | explicit, approximate | Ch. 102: Pecos route through Bosque Redondo. |
| 13 | explicit, approximate | Ch. 102: buggy wreck above Horsehead Crossing. |
| 14 | explicit, approximate | Ch. 102: later Colorado River crossing. |
| 15 | explicit, approximate | Chs. 95, 102: burial in the fictional live-oak grove on the south Guadalupe. |
| 16 | interpolation, approximate | Ch. 102: south around San Antonio and toward the Nueces. |
| 17 | explicit, approximate | Ch. 102: return to fictional Lonesome Dove in August 1877. |

## Major corrections

- Reordered the Red River crossing before Bill Spettle's storm and moved the storm to just south of the Canadian.
- Rephased the shared chronology so the rescue and massacre precede the herd's Red River crossing, and Wilbarger's ambush precedes the drive's Arkansas crossing.
- Rebuilt the western-Kansas drive west of Dodge and removed invented cottonwoods.
- Moved Deets's grave to the Salt Creek–Powder confluence vicinity and added the explicit Fort Benton/Missouri and Marias swing before the Milk.
- Moved Lorena's abduction and Gus's departure from Fort Worth/Red River to separate Austin-area camps; reversed the Canadian sites so the waiting camp is upriver.
- Restored Jake's Fort Worth → Dallas → western-Kansas sequence and separated the Wilbarger ambush from the Dallas meeting.
- Added July's two narrated out-and-back legs, Dodge, Republican crossing, and the correct Clara/Ogallala order.
- Added Elmira's Bent's Fort and Republican legs, put Clara before Ogallala, and moved the death point to about sixty miles east.
- Restored Call's Platte/Republican/Kansas/Denver/Purgatoire/Raton route and the Pecos/Bosque Redondo/Horsehead stages. The timeline now ends in August 1877.
- Corrected linked prose: buffalo rifle rather than pistol; live oaks rather than pecans; Yellowstone after entry into Montana; Gus's left-leg/back wounds; and uncertainty about Elmira's killers.

## Remaining uncertainty

- Fictional ranches, camps, graves, unnamed crossings, and violence sites cannot be geolocated to decimal precision. Their coordinates are intentionally rounded map estimates.
- The novel's Hacienda Flores directions combine Coahuila with geometry that does not reconcile around Laredo.
- “Bent's Fort” is chronologically ambiguous only after applying the chart's conventional 1876 dating; the novel itself supplies no year. The map uses Bent's Old Fort National Historic Site (`38.039775, -103.426650`) as the recognizable geographic referent and keeps the route point approximate because the original trading post had long since closed by 1876.
- McMurtry's Miles City and Santa Rosa scenes contain conventional-chronology anachronisms. The real town coordinates are retained because those places are explicit in the novel; the map does not treat every described institution as historically contemporaneous.
- Gus's wounding distances conflict with real hydrography. The location remains a fictional regional estimate.

## Sources

- Larry McMurtry, *Lonesome Dove*, chapters 1–102 (primary narrative evidence; only short locators used here).
- [USGS Geographic Names Information System](https://www.usgs.gov/us-board-on-geographic-names/what-geographic-names-information-system-gnis) and [The National Map geonames service](https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer): authoritative modern coordinates for named US places and Horsehead Crossing.
- [USGS Wyoming–Montana stream network](https://www.usgs.gov/centers/wyoming-montana-water-science-center/science/wyoming-montana-stream-water-quality-network-0): Salt Creek and Powder River confluence vicinity.
- [NPS: Fort Benton National Historic Landmark](https://www.nps.gov/places/fort-benton-national-historic-landmark.htm): Missouri head-of-navigation and Marias context.
- [NPS: Bent's Old Fort](https://www.nps.gov/beol/) and [fort status](https://www.nps.gov/beol/planyourvisit/fort_status.htm): site identity and chronology.
- [History Nebraska: Ogallala, Nebraska's Cowboy Capital](https://history.nebraska.gov/document/ogallala-nebraskas-cowboy-capital/): 1870s trail-town identity.
- [NPS: Dodge City](https://www.nps.gov/places/dodge-city-old-city-hall-monuments.htm): cattle-drive frontier identity.
- [City of San Antonio history](https://www.sanantonio.gov/Mission-Trails/Prehistory-History/History-of-San-Antonio): historical town identity.
- [Montana Department of Labor history](https://dli.mt.gov/_docs/publications/dli-msm-062009.pdf): Miles Town chronology.
- [NPS: Santa Rosa Park Lake Historic District](https://www.nps.gov/places/park-lake-historic-district.htm) and [Puerto de Luna National Register record](https://npgallery.nps.gov/GetAsset/02d02bc4-e810-4659-b97f-090c364434b3/): Santa Rosa and Guadalupe County chronology.
