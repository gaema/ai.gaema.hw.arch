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
function sizeSvg(svg, W, H) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("width", W);
  svg.setAttribute("height", H);
}

// The mesh belongs BEHIND the tiles -- its links live in the gaps between them.
// Point-to-point runs (cage wiring, a traced read) belong in FRONT, or they are
// hidden by the very tiles they connect.
function drawInterconnect(svg, top, grid, cells, map) {
  const W = grid.clientWidth, H = grid.clientHeight;
  if (!W || !H) return;
  sizeSvg(svg, W, H);
  sizeSvg(top, W, H);

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
    top.append(p);
    for (const e of [a, b]) top.append(svgEl("circle", { class: "ic-dot", cx: e.cx, cy: e.cy, r: 3, fill: arc.color || "currentColor" }));
  }
}

// Dataflow: trace one read across the die, because a static map cannot show the
// thing that actually costs time -- how far a byte travels and how many hops it
// takes to get there.
//
// On a mesh the route is DIMENSION-ORDERED: the packet completes one axis, turns
// once, and completes the other. That is not a drawing simplification -- it is
// how cyclic-dependency deadlock is avoided, and turning freely would reintroduce
// it. On the GPUs there are no per-tile hops to show, so the route is the named
// stops a read passes through instead.
function routeCells(map) {
  const df = map.dataflow;
  if (!df) return [];
  if (df.kind === "stops") return df.stops.slice();
  const [x0, y0] = df.from, [x1, y1] = df.to;
  const out = [];
  const stepX = Math.sign(x1 - x0), stepY = Math.sign(y1 - y0);
  for (let x = x0; x !== x1; x += stepX) out.push([x, y0]);   // along X first
  for (let y = y0; y !== y1; y += stepY) out.push([x1, y]);   // one turn, then Y
  out.push([x1, y1]);
  return out;
}

function drawRoute(svg, grid, cells, map) {
  const path = routeCells(map);
  if (path.length < 2) return null;
  const pts = [];
  for (const [x, y] of path) {
    const n = cells[`${x},${y}`];
    if (!n) continue;
    pts.push([n.offsetLeft + n.offsetWidth / 2, n.offsetTop + n.offsetHeight / 2]);
    n.classList.add("on-route");
  }
  if (pts.length < 2) return null;

  const g = svgEl("g", { class: "ic-route" });
  const d = "M " + pts.map((p) => `${p[0]} ${p[1]}`).join(" L ");
  g.append(svgEl("path", { class: "route-line", d }));

  const dot = svgEl("circle", { class: "route-dot", r: 5, cx: pts[0][0], cy: pts[0][1] });
  const motion = svgEl("animateMotion", {
    dur: Math.max(2, pts.length * 0.18) + "s", repeatCount: "indefinite", path: d,
  });
  // animateMotion is relative to the element's own position, so start at origin.
  dot.setAttribute("cx", 0);
  dot.setAttribute("cy", 0);
  dot.append(motion);
  g.append(dot);
  svg.append(g);
  return path.length;
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

// A SKU may carry more than one map, because more than one thing is worth
// drawing: the p300c needs its card AND the two-card box that card ships in,
// and those are different objects at different scales. `dieMap` stays the
// single-map spelling every other SKU uses.
export function renderDieMap(sku, onOpenPath) {
  const host = document.getElementById("diemap");
  const maps = [].concat(sku.dieMap || [], sku.dieMaps || []);
  if (!host || !maps.length) return;
  host.textContent = "";
  host.classList.toggle("wide", maps.some((m) => m.cols > 20));
  for (const map of maps) renderOneMap(host, map, onOpenPath);
}

function renderOneMap(host, map, onOpenPath) {
  const tiles = map.tiles;

  const head = el("div", "stage-head");
  head.append(el("h2", null, map.title || "Die map"));
  head.append(el("span", "sub", `${map.cols} × ${map.rows} grid · ${tiles.length} blocks`));
  host.append(head);

  if (map.lede) host.append(el("p", "map-lede", map.lede));

  // --- filters: one chip per kind present, plus "all" ---------------------
  const kinds = [];
  for (const t of tiles) if (!kinds.includes(t.kind)) kinds.push(t.kind);

  const bar = el("div", "filters");

  // The filters pick ONE kind out of N -- setFilter below clears every other
  // chip -- so they are a radio group, not a row of toggles. That distinction
  // is invisible on screen (a highlight looks the same either way) and decides
  // everything off it: a radio group announces "3 of 8" and moves with the
  // arrow keys, while eight aria-pressed buttons announce eight independent
  // on/off controls and give no way to hear that choosing one un-chose another.
  // The group needs its own element because the two toggle buttons share this
  // bar and must NOT be members of it.
  const group = el("div", "filter-group");
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-label", "Show one kind of block");
  bar.append(group);

  const chips = [];

  function setFilter(kind, focus) {
    for (const c of chips) {
      const on = c.kind === kind;
      c.el.setAttribute("aria-checked", String(on));
      // Roving tabindex: a radio group is ONE tab stop, and the arrows move
      // within it. Eight separate stops would be the toggle behaviour again.
      c.el.tabIndex = on ? 0 : -1;
      if (on && focus) c.el.focus();
    }
    for (const t of grid.children) {
      // A board outline is CONTEXT, not content: it has no kind, so the test
      // below would dim it under every filter and fade away the one thing
      // saying which tiles share a PCB.
      if (t.classList.contains("dgroup")) continue;
      t.classList.toggle("dimmed", kind !== null && t.dataset.kind !== kind);
    }
  }

  function onKey(e) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const i = chips.findIndex((c) => c.el === e.target);
    setFilter(chips[(i + step + chips.length) % chips.length].kind, true);
  }

  function addChip(kind, label) {
    const c = el("button", "chip", label);
    c.type = "button";
    c.setAttribute("role", "radio");
    c.setAttribute("aria-checked", String(kind === null));
    c.tabIndex = kind === null ? 0 : -1;
    c.addEventListener("click", () => setFilter(kind));
    c.addEventListener("keydown", onKey);
    chips.push({ el: c, kind });
    group.append(c);
    return c;
  }

  addChip(null, "All blocks");
  for (const k of kinds) {
    const c = addChip(k, KINDS[k] || k);
    paint(c, k);
    c.classList.add("chip-kind");
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

  // --- board groups -------------------------------------------------------
  // A group says "these tiles are ONE PHYSICAL BOARD". Without it every tile on
  // a map reads as sitting on the same PCB, which is exactly the error the
  // p300c map used to make: it drew the card-to-card connector in the same band
  // as the on-PCB die-to-die traces, so a link between two separate cards
  // looked like part of the fabric inside one. Drawn behind the tiles and
  // inert, so it changes nothing about hit-testing or the mesh overlay.
  // The label straddles the outline's top edge, and .map-scroll clips anything
  // above the grid (overflow-x:auto forces overflow-y to auto too), so the grid
  // needs room for it or the label is invisible while still being in the DOM --
  // which is exactly how it first shipped.
  if ((map.groups || []).length) grid.classList.add("has-groups");
  for (const g of map.groups || []) {
    const box = el("div", "dgroup");
    box.style.gridColumn = `${g.x0 + 1} / span ${g.x1 - g.x0 + 1}`;
    box.style.gridRow = `${g.y0 + 1} / span ${g.y1 - g.y0 + 1}`;
    if (g.label) box.append(el("span", "dgroup-l", g.label));
    grid.append(box);
  }

  // Tile elements by drawn grid coordinate, so the interconnect overlay can
  // find where each one actually landed.
  const cells = {};

  for (const t of tiles) {
    const n = el(t.path ? "button" : "div", "dtile" + (t.path ? " opens" : ""));
    if (t.path) n.type = "button";
    n.dataset.kind = t.kind;
    if (t.kind === "link") n.classList.add("is-link");
    if (t.kind === "off") n.classList.add("is-off");
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
  let svg = null, svgTop = null, redraw = () => {};
  let routeOn = false, hops = null;
  if (map.mesh || map.arcs || map.dataflow) {
    svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("class", "ic-overlay");
    svgTop = document.createElementNS(SVG, "svg");
    svgTop.setAttribute("class", "ic-overlay ic-top");
    grid.append(svg);
    grid.append(svgTop);
    redraw = () => {
      drawInterconnect(svg, svgTop, grid, cells, map);
      for (const n of grid.querySelectorAll(".on-route")) n.classList.remove("on-route");
      if (routeOn) hops = drawRoute(svgTop, grid, cells, map);
    };
    if (window.ResizeObserver) new ResizeObserver(redraw).observe(grid);
    requestAnimationFrame(redraw);
  }

  host.append(scroll);

  if (map.dataflow) {
    // Named for the THING it shows, not for the next action -- the same shape
    // as the seven kind filters beside it, so all ten chips in this bar are one
    // control type: label = what it is, aria-pressed = whether it is on, and
    // the highlight carries the state. An action label ("Hide the read") cannot
    // pair with aria-pressed, because pressed reports what IS while the label
    // promises what a click WILL do -- they invert the moment the toggle is on.
    const base = map.dataflow.label || "Traced read";
    const d = el("button", "chip df-toggle", base);
    d.type = "button";
    d.setAttribute("aria-pressed", "false");
    d.addEventListener("click", () => {
      routeOn = !routeOn;
      d.setAttribute("aria-pressed", String(routeOn));
      redraw();
      // A mesh route is counted in HOPS -- tile-to-tile, and the count is the
      // cost. A GPU read passes through named levels, which are stops, not hops;
      // calling them hops would invent a distance the hierarchy does not have.
      const unit = map.dataflow.kind === "stops" ? "stops" : "hops";
      // The count is an ANNOTATION on the same name, not a different name: the
      // accessible name stays recognisably "Traced read" whether on or off,
      // which is what WCAG 2.5.3 (Label in Name) asks of a visible label.
      d.textContent = routeOn && hops ? `${base} · ${hops} ${unit}` : base;
      tip.textContent = "";
      if (routeOn) {
        tip.append(el("strong", null, map.dataflow.title || "One read, traced"));
        tip.append(el("p", null, map.dataflow.note));
        tip.classList.add("on");
      } else idle();
    });
    bar.append(d);
  }

  if (svg) {
    const t = el("button", "chip ic-toggle", "Interconnect");
    t.type = "button";
    t.setAttribute("aria-pressed", "true");
    t.addEventListener("click", () => {
      const hidden = svg.classList.toggle("off");
      svgTop.classList.toggle("off", hidden);
      t.setAttribute("aria-pressed", String(!hidden));
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
