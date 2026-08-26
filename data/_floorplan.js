// Small helpers for hand-placing a GPU die map.
//
// The three GPUs here share a shape: a front-end strip, memory controllers on
// the edges, a cache slab, and a field of identical compute tiles in the
// middle. Blackhole has a SoC descriptor giving every tile's position; these
// parts have only block diagrams, so the maps below are built from those — the
// ARRANGEMENT is the vendor's, the exact geometry is not, and every page says so.

// A row of side-by-side blocks that together span the die width.
// `cells` is [{w, ...tile}, ...]; x is accumulated left to right.
export function band(y, cells, h) {
  let x = 0;
  return cells.map((c) => {
    const t = { ...c, x, y, w: c.w || 1, h: h || c.h || 1 };
    x += t.w;
    return t;
  });
}

// A rectangular field of identical tiles, `perRow` across and `rows` down,
// each `w` columns wide. `make(index, col, row)` returns the tile's own props.
export function field({ y0, perRow, rows, w = 1, make }) {
  const out = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < perRow; c++) {
      const i = r * perRow + c;
      out.push({ x: c * w, y: y0 + r, w, h: 1, ...make(i, c, r) });
    }
  }
  return out;
}

// Split an N-bit bus into `n` controller blocks that span `cols` columns.
export function memBand(y, n, cols, label, sub, detail, specs, path = "gddr") {
  const w = cols / n;
  return band(y, Array.from({ length: n }, (_, i) => ({
    w, kind: "memory", label, sub: typeof sub === "function" ? sub(i) : sub,
    detail, specs, path,
  })));
}

export const MAP_NOTE =
  "A logical floorplan, not a die photo. The grouping and the edge/centre "
  + "arrangement follow the vendor's own block diagram; the geometry does not — "
  + "block sizes and positions here are chosen so every unit is visible and "
  + "labelled, not to scale or to physical location on silicon. In particular "
  + "the cache bands are drawn as single blocks for legibility: on all three "
  + "GPUs here the last-level cache is BANKED into slices tied to the memory "
  + "partitions, so it is physically distributed along the memory edges rather "
  + "than being one slab in the middle.";
