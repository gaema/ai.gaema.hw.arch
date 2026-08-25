# arch.hw.gaema.ai — accelerator architecture explorer

Interactive block diagrams of six AI accelerators, drawn to one structure so
they can be compared like with like:

| Card | Vendor | Architecture |
|---|---|---|
| Radeon AI PRO R9700 | AMD | RDNA 4 (Navi 48) |
| Arc Pro B70 | Intel | Xe2 “Battlemage” |
| RTX PRO 6000 Blackwell | NVIDIA | Blackwell (GB202) |
| GeForce RTX 5090 | NVIDIA | Blackwell (GB202) |
| Blackhole p150a | Tenstorrent | Blackhole |
| Blackhole p300c | Tenstorrent | Blackhole |

Each page carries two views of the same part:

- a **die map** — every block drawn at its own place on one grid, with the
  interconnect drawn between them, so adjacency is visible: which edge the
  memory controllers sit on, how many cores one L2 serves, which tiles a memory
  channel feeds. Hover for detail, filter by block class, click a block to open
  it in the hierarchy.
- a **hierarchy** — card → die → cluster → execution unit → matrix engine.
  Breadcrumb to come back out, `Esc` to go up one level. Every view has its own
  URL.

## Layout

```
index.html            landing page: SKU cards + the cross-vendor matrix
<slug>/index.html     one explorer page per card (a thin shell)
assets/theme.css      colour tokens, light / dark / auto
assets/theme.js       theme boot + toggle
assets/app.css        layout
assets/diemap.js      the die-map renderer (grid + filters + hover detail)
assets/explorer.js    the drill-down renderer; owns both views on a page
assets/landing.js     cards + matrix
assets/nav.js         header nav, built from the registry
data/index.js         the SKU registry — the one place a card is added
data/<slug>.js        one card's die map, hierarchy, specs and sources
data/_floorplan.js    band/field/memBand helpers for hand-placed GPU die maps
data/_blackwell.js    GB202 hierarchy + die map, shared by the two NVIDIA cards
data/_blackhole.js    Blackhole hierarchy + die map, shared by the two TT cards
```

No build step, no dependencies, no bundler — plain ES modules served statically.
Open `index.html` over any static server (module imports need `http://`, not
`file://`):

```sh
python3 -m http.server 8080
```

## Conventions

- **Published figures only.** Every number comes from vendor documentation or
  press coverage, and every page lists its sources. Where a vendor does not
  publish a figure the site says so rather than estimating. No measurement of
  our own hardware appears here, and no card is described by anything other
  than its public specification.
- **Say whether a map is real or logical.** Tenstorrent publishes a SoC
  descriptor giving every tile's NOC coordinate, so the Blackhole map is the
  actual 17 × 12 grid in the vendor's own coordinates (Y = 0 at the bottom). The
  three GPUs publish block diagrams but no per-unit geometry, so those maps take
  the vendor's arrangement and lay it out for legibility — not to scale, not to
  physical position — and say so on the page. Never present a hand-placed
  floorplan as a die photo.
- **A harvested part is drawn whole, with the count stated.** No vendor
  publishes which specific units a given card fused off, so marking particular
  ones would be invention. 188 of 192, 170 of 192, 120 of 140 — stated, not
  drawn.
- **Draw the interconnect the shape it actually is.** Blackhole has a router in
  every tile, so its map draws real tile-to-tile links (`mesh: {torus: true}`,
  rendered into the grid gaps) plus the QSFP cage runs as arcs. The three GPUs
  do not work that way — their compute reaches cache and memory across a shared
  fabric whose topology two of the three vendors do not publish — so they get a
  labelled fabric *band*, hatched and dashed so it never reads as another cache
  level. Giving a GPU a mesh it does not have would be the same class of error
  as inventing a harvest pattern.
- **Colours come from `assets/theme.css`, never from a literal.** The page must
  read correctly in light, dark, and system-default.

## Adding a card

1. Write `data/<slug>.js` exporting `{ id, name, vendor, vendorKey, arch, die,
   tagline, headline, compare, dieMap, root, sources }`. `root` is the node
   tree; a node is `{ id, label, kind, count, note, specs, span, cols,
   children }`. `dieMap` is `{ title, cols, rows, cell, cellH, lede, hint,
   note, source, interconnect, tiles }`, optionally with `mesh: {torus}` and
   `arcs: [{from:[x,y], to:[x,y], color, dip, label}]`; a tile is `{ x, y, w, h,
   kind, label, sub, detail, specs, path }`, where `path` is the hierarchy path
   the tile opens (`"se0/sa0/wgp0"`).
2. Add the slug to `ORDER` and `LOADERS` in `data/index.js`.
3. Copy an existing `<slug>/index.html` shell and change `data-sku`, the
   `<title>` and the description.

`kind` is one of `compute`, `matrix`, `cache`, `memory`, `sched`, `fixed`,
`io`, `off` — it picks the tile colour and the legend label.
