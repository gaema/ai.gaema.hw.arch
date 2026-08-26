# arch.hw.gaema.ai — accelerator architecture explorer

Interactive block diagrams of seven AI accelerators, drawn to one structure so
they can be compared like with like:

| Card | Vendor | Architecture |
|---|---|---|
| Radeon AI PRO R9700 | AMD | RDNA 4 (Navi 48) |
| Arc Pro B50 | Intel | Xe2 “Battlemage” (BMG-G21) |
| Arc Pro B70 | Intel | Xe2 “Battlemage” (BMG-G31) |
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
- a **traced read**, on the same map — *Trace a read* animates one memory access
  along its actual path. On a mesh that is a dimension-ordered route counted in
  **hops**; on a GPU it is the named levels a read falls through, counted in
  **stops**, because a cache hierarchy has no distance to measure.
- a **hierarchy** — card → die → cluster → execution unit → matrix engine.
  Breadcrumb to come back out, `Esc` to go up one level. Every view has its own
  URL.

## Layout

```
index.html            landing page: SKU cards + the cross-vendor matrix
<vendor>/<slug>/      one explorer page per card (a thin shell), grouped by
                      vendor: amd/ intel/ nvidia/ tenstorrent/
<slug>/index.html     redirect stub at the old flat path, preserving the hash
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
data/_battlemage.js   Xe2 hierarchy + die map, shared by the two Intel cards
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

- **State the figure; don't narrate its sourcing.** Every number comes from
  vendor documentation, published analysis, or the silicon itself, and every
  page lists its sources at the bottom. The page body carries the VALUE — a
  reader wants to know that the B70's L2 is 24 MiB, not to read commentary
  about which vendor documents do or do not mention it. Where a figure is
  genuinely unknown the cell reads `—`.

  Whatever the route to a number, it must be a property of the SILICON: no
  performance measurement of ours appears here, and nothing about the machine
  any reading came from — no host, no bus address, no fleet detail.
- **Keep the die and the board apart, and never let an attribute cross.** A
  QSFP-DD cage and a PCIe edge connector are parts of the CARD: they are drawn
  outside the die block, in their own row, with runs to the die tiles they are
  wired to — not as arcs between two on-die tiles, which would imply the cage is
  on the die. The same rule applies to figures: a memory-controller block is one
  on-die controller, so it carries its own width and its share of bandwidth,
  while the capacity and the aggregate rate are labelled as the subsystem and
  the DRAM on the board. Every spec key names its own scope for this reason
  (`This block`, `Whole memory subsystem`, `DRAM on the board`).
- **A page describes ONE product.** Sibling variants — Max-Q, Server Edition,
  the cut-down part in the same family — are named as separate products or left
  out, never folded into this card's figures.
- **Say whether a map is real or logical.** Blackhole has a SoC descriptor
  giving every tile's NOC coordinate, so its map is the actual 17 × 12 grid in
  the vendor's own coordinates (Y = 0 at the bottom). The three GPUs have block
  diagrams but no per-unit geometry, so those maps take the vendor's
  arrangement and lay it out for legibility — not to scale, not to
  physical position — and say so on the page. Never present a hand-placed
  floorplan as a die photo.
- **A harvest is drawn; its POSITION is illustrative.** Disabled units are
  shown struck through and greyed, because a reader comparing 188 of 192
  against 120 of 140 should see the difference rather than read it. WHICH units
  a given card fused off is not something the maps assert: the Blackwell pages
  draw dark TPCs, Blackhole draws a mirrored column pair whose *shape* follows
  from the harvesting scheme while the specific pair varies per die, and the
  B50 draws four disabled Xe-cores grouped for legibility. Each says at the
  point of use that the placement is illustrative.
- **Draw the interconnect the shape it actually is.** Blackhole has a router in
  every tile, so its map draws real tile-to-tile links (`mesh: {torus: true}`,
  rendered into the grid gaps) plus the QSFP cage runs as arcs. A multi-die card
  stacks its dies vertically with the link band between them, drawing the whole
  chain — Ethernet row → MAC/PCS → 8 SerDes lanes → PCB → back up the other
  side — and each die's mesh is a separate `regions` entry so nothing ties
  across the band. The three GPUs
  do not work that way — their compute reaches cache and memory across a shared
  fabric — so they get a labelled fabric *band*, hatched and dashed so it never reads as another cache
  level. Giving a GPU a mesh it does not have would be the same class of error
  as inventing a harvest pattern.
- **Colours come from `assets/theme.css`, never from a literal.** The page must
  read correctly in light, dark, and system-default.

## Adding a card

1. Write `data/<slug>.js` exporting `{ id, name, vendor, vendorKey, arch, die,
   tagline, spec, extra, compare, dieMap, root, sources }`. `spec` must answer
   every field in `SPEC_SPINE` (`data/index.js`) and nothing else — the spec
   card is the same 16 rows in the same order on every page, and `load()`
   throws if a SKU drifts. Whatever a vendor counts that the others do not goes
   in `extra`, which renders as a second, subordinate card. `root` is the node
   tree; a node is `{ id, label, kind, count, note, specs, span, cols,
   children }`. `dieMap` is `{ title, cols, rows, cell, cellH, lede, hint,
   note, source, interconnect, tiles }`, optionally with
   `mesh: {torus, regions: [{x0, x1, y0, y1}]}` (one region per die) and
   `arcs: [{from:[x,y], to:[x,y], color, dip, label}]` — an arc may anchor
   anywhere inside a spanning tile, and bows perpendicular to its own run, so
   vertical links read as links; a tile is `{ x, y, w, h,
   kind, label, sub, detail, specs, path }`, where `path` is the hierarchy path
   the tile opens (`"se0/sa0/wgp0"`).
2. Add the slug to `ORDER` and `LOADERS` in `data/index.js`.
3. Copy an existing `<vendor>/<slug>/index.html` shell and change `data-sku`,
   the `<title>` and the description. `pageHref()` in `data/index.js` derives
   the URL from `vendorKey` via `VENDOR_DIR`, so nav, cards and matrix all
   follow automatically — a new vendor needs one entry there.

`kind` is one of `compute`, `matrix`, `cache`, `memory`, `sched`, `fixed`,
`io`, `link`, `off` — it picks the tile colour and the legend label.

`dieMap.dataflow` adds the traced read: `{label, title, note}` plus either
`{from:[x,y], to:[x,y]}` for a mesh — routed dimension-ordered, X then one turn
then Y — or `{kind:"stops", stops:[[x,y], …]}` for a hierarchy walk. Keep the
two honest: a mesh route's hop count is a real distance, a stop list is not.
