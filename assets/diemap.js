// The die map: every block on the die drawn at its own place on one grid.
//
// The hierarchy explorer answers "what is inside what". It cannot answer "where
// is it, and what is it next to" -- and on these parts adjacency is the whole
// story: which Tensix column a GDDR channel feeds, which edge the memory
// controllers sit on, how many cores one L2 has to serve.
//
// A tile is {x, y, w, h, kind, label, sub, detail, specs, path}. Coordinates are
// 0-based from the top-left of the grid; `path` (optional) is the hierarchy path
// the tile opens in the explorer below, which is what ties the two views
// together.

import { KINDS } from "../data/index.js";

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

function paint(node, kind) {
  node.style.setProperty("--tile-ink", `var(--k-${kind || "io"}-ink)`);
  node.style.setProperty("--tile-bg", `var(--k-${kind || "io"}-bg)`);
}

export function renderDieMap(sku, onOpenPath) {
  const host = document.getElementById("diemap");
  if (!host || !sku.dieMap) return;
  const map = sku.dieMap;
  const tiles = map.tiles;

  host.textContent = "";

  const head = el("div", "stage-head");
  head.append(el("h2", null, map.title || "Die map"));
  head.append(el("span", "sub", `${map.cols} × ${map.rows} grid · ${tiles.length} blocks`));
  host.append(head);

  if (map.lede) host.append(el("p", "map-lede", map.lede));

  // --- filters: one chip per kind present, plus "all" ---------------------
  const kinds = [];
  for (const t of tiles) if (!kinds.includes(t.kind)) kinds.push(t.kind);

  const bar = el("div", "filters");
  const chips = [];

  function setFilter(kind) {
    for (const c of chips) c.el.setAttribute("aria-pressed", String(c.kind === kind));
    for (const t of grid.children) {
      t.classList.toggle("dimmed", kind !== null && t.dataset.kind !== kind);
    }
  }

  const all = el("button", "chip", "All blocks");
  all.type = "button";
  all.setAttribute("aria-pressed", "true");
  all.addEventListener("click", () => setFilter(null));
  chips.push({ el: all, kind: null });
  bar.append(all);

  for (const k of kinds) {
    const c = el("button", "chip", KINDS[k] || k);
    c.type = "button";
    c.setAttribute("aria-pressed", "false");
    paint(c, k);
    c.classList.add("chip-kind");
    c.addEventListener("click", () => setFilter(k));
    chips.push({ el: c, kind: k });
    bar.append(c);
  }
  host.append(bar);

  // --- the grid -----------------------------------------------------------
  const scroll = el("div", "map-scroll");
  const grid = el("div", "diegrid");
  grid.style.setProperty("--cols", String(map.cols));
  grid.style.setProperty("--rows", String(map.rows));
  grid.style.setProperty("--cell", (map.cell || 46) + "px");
  grid.style.setProperty("--cellh", (map.cellH || map.cell || 46) + "px");

  const tip = el("div", "map-tip");
  tip.setAttribute("role", "status");

  for (const t of tiles) {
    const n = el(t.path ? "button" : "div", "dtile" + (t.path ? " opens" : ""));
    if (t.path) n.type = "button";
    n.dataset.kind = t.kind;
    paint(n, t.kind);
    n.style.gridColumn = `${t.x + 1} / span ${t.w || 1}`;
    n.style.gridRow = `${t.y + 1} / span ${t.h || 1}`;

    n.append(el("span", "d-label", t.label));
    if (t.sub) n.append(el("span", "d-sub", t.sub));

    const show = () => {
      tip.textContent = "";
      tip.append(el("strong", null, t.label));
      if (t.sub) tip.append(el("span", "t-kind", " · " + t.sub));
      tip.append(el("span", "t-kind", " · " + (KINDS[t.kind] || t.kind)));
      if (t.detail) tip.append(el("p", null, t.detail));
      if (t.specs) {
        const dl = el("dl");
        for (const [k, v] of t.specs) { dl.append(el("dt", null, k)); dl.append(el("dd", null, v)); }
        tip.append(dl);
      }
      if (t.path) tip.append(el("p", "t-open", "Click to open this block in the hierarchy below."));
      tip.classList.add("on");
    };

    n.addEventListener("mouseenter", show);
    n.addEventListener("focus", show);
    n.title = t.label + (t.sub ? " — " + t.sub : "");
    if (t.path) n.addEventListener("click", () => onOpenPath(t.path));
    grid.append(n);
  }

  scroll.append(grid);
  host.append(scroll);

  const idle = () => {
    tip.textContent = "";
    tip.append(el("span", "t-idle", map.hint
      || "Hover or focus a block for detail. Blocks with a border you can click open in the hierarchy below."));
    tip.classList.remove("on");
  };
  grid.addEventListener("mouseleave", idle);
  idle();
  host.append(tip);

  if (map.note) host.append(el("p", "note", map.note));
  if (map.source) host.append(el("p", "note", "Layout source: " + map.source));
}
