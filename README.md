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

Each page opens at the card and descends — click a block to go inside it, use
the breadcrumb to come back out, `Esc` to go up one level. Every view has its
own URL.

## Layout

```
index.html            landing page: SKU cards + the cross-vendor matrix
<slug>/index.html     one explorer page per card (a thin shell)
assets/theme.css      colour tokens, light / dark / auto
assets/theme.js       theme boot + toggle
assets/app.css        layout
assets/explorer.js    the drill-down renderer
assets/landing.js     cards + matrix
assets/nav.js         header nav, built from the registry
data/index.js         the SKU registry — the one place a card is added
data/<slug>.js        one card's hierarchy, specs and sources
data/_blackwell.js    GB202 hierarchy shared by the two NVIDIA cards
data/_blackhole.js    Blackhole ASIC hierarchy shared by the two TT cards
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
- **Logical diagrams, not floorplans.** Blocks are arranged for legibility, not
  to physical scale or position. A harvested part is drawn as the full die with
  disabled units marked — no vendor publishes which specific units a given card
  fused off.
- **Colours come from `assets/theme.css`, never from a literal.** The page must
  read correctly in light, dark, and system-default.

## Adding a card

1. Write `data/<slug>.js` exporting `{ id, name, vendor, vendorKey, arch, die,
   tagline, headline, compare, root, sources }`. `root` is the node tree; a node
   is `{ id, label, kind, count, note, specs, span, cols, children }`.
2. Add the slug to `ORDER` and `LOADERS` in `data/index.js`.
3. Copy an existing `<slug>/index.html` shell and change `data-sku`, the
   `<title>` and the description.

`kind` is one of `compute`, `matrix`, `cache`, `memory`, `sched`, `fixed`,
`io`, `off` — it picks the tile colour and the legend label.
