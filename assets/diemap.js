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

const SVG = "http://www.w3.org/2000/svg";

const svgEl = (tag, attrs) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

// Draw the on-die network over the laid-out grid.
//
// `map.mesh` means every tile has a router and talks to its four orthogonal
// neighbours: the ties are drawn in the GAPS between tiles, which is where the
// links physically are. `map.mesh.torus` adds the wrap stubs at each border,
// because the edge tiles are not dead ends -- the mesh closes on itself.
//
// `map.arcs` draws named point-to-point runs on top (a board connector wired to
// two specific tiles, say), curved so they read as off-grid wiring rather than
// as more mesh.
function drawInterconnect(svg, grid, cells, map) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const W = grid.clientWidth, H = grid.clientHeight;
  if (!W || !H) return;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("width", W);
  svg.setAttribute("height", H);

  const box = (x, y) => {
    const n = cells[`${x},${y}`];
    if (!n) return null;
    return { l: n.offsetLeft, t: n.offsetTop, w: n.offsetWidth, h: n.offsetHeight,
             cx: n.offsetLeft + n.offsetWidth / 2, cy: n.offsetTop + n.offsetHeight / 2 };
  };

  if (map.mesh) {
    const g = svgEl("g", { class: "ic-mesh" });
    // A card can carry more than one die, and separate dies do NOT share a
    // NOC. Each region is one closed mesh: links stay inside it and the wrap
    // closes on the region's own edges, never across the gutter between dies.
    const regions = map.mesh.regions || [{ x0: 0, x1: map.cols - 1 }];
    for (const rg of regions) {
      const y0 = rg.y0 || 0, y1 = rg.y1 == null ? map.rows - 1 : rg.y1;
      for (let y = y0; y <= y1; y++) {
        for (let x = rg.x0; x <= rg.x1; x++) {
          const a = box(x, y);
          if (!a) continue;
          if (x < rg.x1) {
            const r = box(x + 1, y);
            if (r) g.append(svgEl("line", { x1: a.l + a.w, y1: a.cy, x2: r.l, y2: r.cy }));
          }
          if (y < y1) {
            const d = box(x, y + 1);
            if (d) g.append(svgEl("line", { x1: a.cx, y1: a.t + a.h, x2: d.cx, y2: d.t }));
          }
        }
      }
      if (map.mesh.torus) {
        const s = 7;
        for (let y = y0; y <= y1; y++) {
          const a = box(rg.x0, y), b = box(rg.x1, y);
          if (a) g.append(svgEl("line", { class: "wrap", x1: a.l - s, y1: a.cy, x2: a.l, y2: a.cy }));
          if (b) g.append(svgEl("line", { class: "wrap", x1: b.l + b.w, y1: b.cy, x2: b.l + b.w + s, y2: b.cy }));
        }
        for (let x = rg.x0; x <= rg.x1; x++) {
          const a = box(x, y0), b = box(x, y1);
          if (a) g.append(svgEl("line", { class: "wrap", x1: a.cx, y1: a.t - s, x2: a.cx, y2: a.t }));
          if (b) g.append(svgEl("line", { class: "wrap", x1: b.cx, y1: b.t + b.h, x2: b.cx, y2: b.t + b.h + s }));
        }
      }
    }
    svg.append(g);
  }

  for (const arc of map.arcs || []) {
    const a = box(arc.from[0], arc.from[1]), b = box(arc.to[0], arc.to[1]);
    if (!a || !b) continue;
    // Bow the curve PERPENDICULAR to the run, so a vertical link reads as a
    // link and not as a flat line hidden under the tiles it crosses.
    const dx = b.cx - a.cx, dy = b.cy - a.cy;
    const vertical = Math.abs(dy) > Math.abs(dx);
    const amt = (arc.dip || 1) * Math.max(18, (vertical ? Math.abs(dy) : Math.abs(dx)) * 0.18);
    const mx = (a.cx + b.cx) / 2, my = (a.cy + b.cy) / 2;
    const ctl = vertical ? [mx + amt, my] : [mx, my + amt];
    const p = svgEl("path", {
      class: "ic-arc",
      d: `M ${a.cx} ${a.cy} Q ${ctl[0]} ${ctl[1]} ${b.cx} ${b.cy}`,
      stroke: arc.color || "currentColor",
    });
    if (arc.label) {
      const title = svgEl("title", {});
      title.textContent = arc.label;
      p.append(title);
    }
    svg.append(p);
    for (const e of [a, b]) svg.append(svgEl("circle", { class: "ic-dot", cx: e.cx, cy: e.cy, r: 3, fill: arc.color || "currentColor" }));
  }
}

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
  // A multi-die map is wider than the reading column; let it break out so both
  // dies are visible at once instead of behind a scrollbar.
  host.classList.toggle("wide", map.cols > 20);

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
  // A mesh is drawn in the gaps, so the gaps have to be wide enough to see.
  grid.style.setProperty("--gap", (map.mesh ? 8 : 2) + "px");

  const tip = el("div", "map-tip");
  tip.setAttribute("role", "status");

  // Tile elements by drawn grid coordinate, so the interconnect overlay can
  // find where each one actually landed.
  const cells = {};

  for (const t of tiles) {
    const n = el(t.path ? "button" : "div", "dtile" + (t.path ? " opens" : ""));
    if (t.path) n.type = "button";
    n.dataset.kind = t.kind;
    if (t.kind === "link") n.classList.add("is-link");
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
    // Register a spanning tile under EVERY cell it covers, not just its origin,
    // so an interconnect run can anchor anywhere along a wide block. Anchoring
    // mid-span used to resolve to nothing and the run was silently dropped.
    for (let sx = 0; sx < (t.w || 1); sx++) {
      for (let sy = 0; sy < (t.h || 1); sy++) cells[`${t.x + sx},${t.y + sy}`] = n;
    }
    grid.append(n);
  }

  scroll.append(grid);

  // --- interconnect overlay ----------------------------------------------
  // Only meshes get an overlay. A GPU's fabric is drawn as a labelled band in
  // the tile list instead, which is how the vendors draw it themselves.
  let svg = null, redraw = () => {};
  if (map.mesh || map.arcs) {
    svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("class", "ic-overlay");
    grid.append(svg);
    redraw = () => drawInterconnect(svg, grid, cells, map);
    if (window.ResizeObserver) new ResizeObserver(redraw).observe(grid);
    requestAnimationFrame(redraw);
  }

  host.append(scroll);

  if (svg) {
    const t = el("button", "chip ic-toggle", "Hide interconnect");
    t.type = "button";
    t.setAttribute("aria-pressed", "true");
    t.addEventListener("click", () => {
      const on = svg.classList.toggle("off");
      t.setAttribute("aria-pressed", String(!on));
      t.textContent = on ? "Show interconnect" : "Hide interconnect";
    });
    bar.append(t);
  }

  const idle = () => {
    tip.textContent = "";
    tip.append(el("span", "t-idle", map.hint
      || "Hover or focus a block for detail. Blocks with a border you can click open in the hierarchy below."));
    tip.classList.remove("on");
  };
  grid.addEventListener("mouseleave", idle);
  idle();
  host.append(tip);

  if (map.interconnect) {
    const p = el("p", "note ic-note");
    p.append(el("strong", null, "Interconnect. "));
    p.append(document.createTextNode(map.interconnect));
    host.append(p);
  }
  if (map.note) host.append(el("p", "note", map.note));
  if (map.source) host.append(el("p", "note", "Layout source: " + map.source));
}
