// Shared Wormhole ASIC hierarchy, used by both Wormhole cards.
// Wormhole is not a GPU: there is no warp scheduler and no hardware cache
// hierarchy. Each Tensix tile is an independent little computer with its own
// software-managed SRAM, and the interesting structure is the NoC between them.
//
// Generation before Blackhole: a 10 × 12 mesh rather than 17 × 12, one PCIe
// tile rather than two, no L2CPU, no programmable DRAM-tile core, and
// Ethernet at 100 GbE rather than 400. Harvesting takes whole Tensix ROWS,
// not columns.

export const tensix = {
  id: "tensix", label: "Tensix tile", kind: "compute",
  note: "five RISC-V cores, a matrix + vector compute complex, 1.5 MB of software-managed SRAM, and two NoC routers",
  specs: [
    ["Baby RISC-V cores", "5"],
    ["L1 SRAM", "1.5 MB"],
    ["NoC routers", "2"],
  ],
  cols: 3,
  children: [
    {
      id: "baby", label: "Baby RISC-V ×5", kind: "sched", span: 2,
      note: "32-bit in-order single-issue RV32IM cores, one instruction per cycle at 1 GHz — they issue work to the compute complex rather than doing the maths themselves",
      specs: [
        ["Per tile", "5"],
        ["ISA", "RV32IM, 32-bit"],
        ["Issue", "in-order, single-issue"],
        ["Clock", "1 GHz"],
      ],
    },
    {
      id: "matrix", label: "Matrix engine (FPU)", kind: "matrix",
      note: "the dense matrix unit, and where essentially all of a model's arithmetic happens. It multiplies tiles staged in this tile's L1 SRAM and accumulates into a destination register file, one instruction per tile-sized multiply-accumulate rather than a loop of vector operations — so every dense layer, attention projection and convolution lands here. The FP8, BLOCKFP8 and FP16 throughput figures for the card are this engine multiplied by the tile count and the fidelity the format runs at. The unpacker resolves a block-float shared exponent before the data arrives, so BFP8 is not a slower path at the matrix unit itself",
    },
    {
      id: "sfpu", label: "Vector engine (SFPU)", kind: "compute",
      note: "the SIMD unit beside the matrix engine, for everything a matrix multiply cannot express: activations, normalisation, softmax, elementwise arithmetic, and the transcendentals — exponential, reciprocal, square root — those are built from. In a transformer it handles the work between the dense layers, and because it shares the same destination register file as the matrix engine, results can move between the two without a round trip through L1",
    },
    {
      id: "l1", label: "L1 SRAM", kind: "cache", span: 2,
      specs: [["Capacity", "1.5 MB per tile"]],
      note: "1.5 MB of scratchpad per tile — and the single biggest architectural difference from a GPU. It is not a cache: there is no tag array, no eviction policy and no hierarchy behind it, so nothing arrives here by accident. The program moves data in over the NOC explicitly, and every operand the compute engines read comes from this block. That makes performance predictable rather than statistical, and it makes data movement the programmer's problem",
    },
    { id: "noc0", label: "NoC router 0", kind: "io",
      note: "one of the tile's two independent NoC planes. NoC 0 travels rightwards as far as needed, turns at most once, then travels downwards — dimension-ordered, which is what keeps the mesh free of cyclic-dependency deadlock. The router runs whether or not this tile's compute does, which is why a harvested row still carries traffic",
      specs: [["Routing", "rightwards, one turn, downwards"], ["Planes on the tile", "2"]] },
    { id: "noc1", label: "NoC router 1", kind: "io",
      note: "the second plane, and deliberately not a copy: NoC 1 goes upwards then leftwards, the mirror of NoC 0. Two planes with opposite orientation let a program pick the shorter direction for a given transfer, and keep two streams from fighting over the same links",
      specs: [["Routing", "upwards, one turn, leftwards"], ["Relationship to NoC 0", "mirrored orientation"]] },
    { id: "unpack", label: "Unpacker / packer", kind: "io", span: 1,
      note: "the format engines either side of the compute complex, and the reason block-float is not a slower path at the maths. Two unpackers read tiles out of L1 and convert them into the layout the engines want, filling SrcA, SrcB and Dst — this is where a shared exponent is resolved. Four packers do the reverse, taking results from Dst back into L1. They are driven by different RISC-V cores: T0 runs the unpackers, T2 the packers, so unpack, compute and pack overlap as a three-stage pipeline",
      specs: [["Unpackers", "2"], ["Packers", "4"], ["Driven by", "T0 unpack / T2 pack"], ["L1 buffers", "32 circular buffers — 16 in, 16 out"]] },
  ],
};

// ---------------------------------------------------------------- die map
//
// The real NOC grid, not a schematic: Wormhole is 10 columns × 12 rows of
// tiles, addressed in NOC0 (x, y) coordinates, and every tile's TYPE follows
// from its position. 8 of the 10 columns are Tensix (x = 0 and x = 5 are not),
// and 10 of the 12 rows are Tensix (y = 0 and y = 6 are Ethernet) — which is
// exactly the 8 × 10 = 80 Tensix tiles on the die.
//
// Positions below are transcribed from the public tt-metal SoC descriptor
// `wormhole_b0_80_arch.yaml` and the N150 / N300 board definitions in
// `board.cpp`.

// GDDR channel -> its three NOC tiles. Two memory columns, x = 0 and x = 5,
// six channels, three tiles per channel = 18 tiles for 6 channels.
const GDDR = {
  0: [[0, 0], [0, 1], [0, 11]],
  1: [[0, 5], [0, 6], [0, 7]],
  2: [[5, 0], [5, 1], [5, 11]],
  3: [[5, 2], [5, 9], [5, 10]],
  4: [[5, 3], [5, 4], [5, 8]],
  5: [[5, 5], [5, 6], [5, 7]],
};

// Ethernet channel -> NOC tile, in the descriptor's channel order. Eight sit
// on row y = 0, eight on row y = 6.
const ETH = [
  [9, 0], [1, 0], [8, 0], [2, 0], [7, 0], [3, 0], [6, 0], [4, 0],
  [9, 6], [1, 6], [8, 6], [2, 6], [7, 6], [3, 6], [6, 6], [4, 6],
];

// The two QSFP-DD cages on an N150 / N300 board, and the two ETH channels
// each drives. Both cages live on ASIC 0.
const QSFP = {
  1: [6, 7],
  2: [0, 1],
};

// Warp 100 port 1 is on ASIC 0 for both cards. Port 2 exists only on N300,
// on ASIC 1.
const WARP = {
  1: [14, 15],
  2: [6, 7],
};

const TENSIX_X = new Set([1, 2, 3, 4, 6, 7, 8, 9]);
const TENSIX_Y = new Set([1, 2, 3, 4, 5, 7, 8, 9, 10, 11]);
const ROUTER = new Set(["0,2", "0,4", "0,8", "0,9"]);

// Wormhole harvests whole Tensix ROWS. The disable mask is indexed on an
// outside-in pairing order of Tensix Y
//   {11, 1, 10, 2, 9, 3, 8, 4, 7, 5}
// whose entries pair up as (index 2k, 2k+1). An n150 fuses off one row
// (80 → 72); an n300 fuses off two (80 → 64 per ASIC). WHICH rows varies
// per die; the pair drawn for n300 is the outermost {11, 1}, which stands
// for that shape, not for a known position.
function lookups() {
  const gddrAt = {}, ethAt = {}, qsfpAt = {};
  for (const [ch, pts] of Object.entries(GDDR)) for (const [x, y] of pts) gddrAt[`${x},${y}`] = +ch;
  ETH.forEach(([x, y], ch) => { ethAt[`${x},${y}`] = ch; });
  for (const [port, chans] of Object.entries(QSFP)) {
    for (const ch of chans) { const [x, y] = ETH[ch]; qsfpAt[`${x},${y}`] = +port; }
  }
  return { gddrAt, ethAt, qsfpAt };
}

// One die's worth of tiles.
//
// `opts.dx` / `opts.dy` shift the whole die, so two of them fit on one grid.
// `opts.flip` defaults true (NOC0 Y=0 at the bottom). `opts.pcieLive` is
// whether this die's single PCIe tile is the host path — true on an n150
// and on n300 ASIC 0; false on n300 ASIC 1, whose host path is Ethernet.
// `opts.harvestedRows` is the illustrative Tensix-Y set fused off.
// `opts.cages` claims the N150/N300 ASIC-0 QSFP-DD assignments.
export function dieTiles(pathPrefix, opts = {}) {
  const { gddrAt, ethAt, qsfpAt } = lookups();
  const dx = opts.dx || 0, dy = opts.dy || 0;
  const flip = opts.flip !== false;
  const pcieLive = opts.pcieLive !== false;
  const harvested = new Set(opts.harvestedRows || []);
  const tiles = [];
  const p = (id) => (pathPrefix ? pathPrefix + "/" + id : null);

  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 10; x++) {
      const k = `${x},${y}`;
      const base = { x: x + dx, y: (flip ? 11 - y : y) + dy, sub: `${x},${y}` };

      if (x === 0 && y === 10) {
        tiles.push({ ...base, kind: "sched", label: "ARC",
          detail: "The ARC management complex: a small always-on controller that boots the die, runs its firmware, applies the harvesting fuses that decide which Tensix rows are live, and reports clock, power, temperature and reset state to the host. It runs no user compute — it is what the host talks to before any kernel exists.",
          path: p("arc") });
      } else if (x === 0 && y === 3) {
        tiles.push(pcieLive
          ? { ...base, kind: "io", label: "PCIe", sub: `in use · ${x},${y}`,
              detail: "The die's only PCIe tile, at (0,3). Wormhole carries one PCIe 4.0 ×16 endpoint, not two: the whole host link comes from this tile.",
              specs: [["Link", "PCIe 4.0 ×16"], ["Tiles on die", "1"]],
              path: p("pcie") }
          : { ...base, kind: "off", label: "PCIe", sub: "not the host path",
              detail: "The PCIe tile this die still has, at (0,3) — every Wormhole ASIC has one. On this chip it is not the host path: the n300's second ASIC is reached over the on-board Ethernet links, and the card presents a single PCIe function for both dies.",
              specs: [["Capability", "PCIe 4.0 ×16 on its own"], ["Host path", "no — Ethernet to ASIC 0"], ["Tiles on die", "1"]] });
      } else if (k in gddrAt) {
        const ch = gddrAt[k];
        tiles.push({ ...base, kind: "memory", label: "GDDR6", sub: `ch ${ch} · ${x},${y}`,
          detail: `One of three NOC tiles serving GDDR6 channel ${ch}. It is an on-die port onto that channel, not the memory itself — the DRAM is packages on the board. The two memory columns sit at x = 0 and x = 5, so every Tensix column is at most a few hops from a bank. The DRAM tile itself has no programmable core: a Tensix issues every DRAM transfer over the NOC.`,
          specs: [["This tile", `1 of 3 NOC ports on channel ${ch}`], ["Its channel", "48 GB/s"],
                  ["Whole memory subsystem", "6 channels, 288 GB/s"], ["DRAM on the board", "12 GB GDDR6"]],
          path: p("gddr") });
      } else if (y === 0 || y === 6) {
        const ch = ethAt[k];
        const port = opts.cages ? qsfpAt[k] : undefined;
        tiles.push({ ...base, kind: "link", label: "ETH",
          sub: opts.cages ? (port ? `ch ${ch} · QSFP${port}` : `ch ${ch}`) : `ch ${ch}`,
          detail: opts.cages
            ? (port
              ? `Ethernet channel ${ch}, 100 GbE bidirectional, wired on the board to QSFP-DD cage ${port} — the cage pairs two such tiles for 200 GbE and is itself a board part, drawn outside the die. Each Ethernet tile runs its own RISC-V core, so the link is programmable rather than a fixed-function PHY.`
              : `Ethernet channel ${ch}, 100 GbE bidirectional. Each Ethernet tile runs its own RISC-V core, so the link is programmable rather than a fixed-function PHY.`)
            : `Ethernet channel ${ch}. Each Ethernet tile runs its own RISC-V core, so the link is programmable rather than a fixed-function PHY. Which channels leave this board, and through what connector, is drawn on the card map.`,
          path: p("eth") });
      } else if (TENSIX_X.has(x) && TENSIX_Y.has(y)) {
        const off = harvested.has(y);
        tiles.push(off
          ? { ...base, kind: "off", label: "Tensix", sub: "router on",
              detail: "Compute disabled — one of the Tensix tiles fused off to make this SKU's enabled count. Its five RISC-V cores and compute complex are off. Its two NOC routers are almost certainly not: harvesting takes whole rows, and a row that stopped routing would cut the die in half, so the mesh is drawn running through — the only reading the topology allows. WHICH rows go dark varies per die; this is binning. What does not vary is the shape: the disable mask is indexed on an outside-in pairing order of Tensix Y {11,1,10,2,9,3,8,4,7,5}.",
              specs: [["Compute", "disabled"], ["NOC routers", "2 — inferred still routing"], ["Harvest", "whole Tensix rows"], ["Which rows", "varies per die"]] }
          : { ...base, kind: "compute", label: "Tensix",
              detail: "One Tensix tile: five baby RISC-V cores, a matrix engine, a vector engine and 1.5 MB of software-managed SRAM, behind two NOC routers.",
              specs: [["Baby RISC-V", "5"], ["L1 SRAM", "1.5 MB"], ["NOC routers", "2"]],
              path: p("tensix") });
      } else if (ROUTER.has(k)) {
        tiles.push({ ...base, kind: "io", label: "Rtr",
          detail: "A router-only tile in the memory column. It carries the two NOC routers every grid position has, so traffic passes through it exactly as it would through a Tensix, but it has no compute engines and no L1 for a kernel to use." });
      } else {
        tiles.push({ ...base, kind: "io", label: "Rtr",
          detail: "A router-only tile. The mesh is a torus and needs a switch at every coordinate, whether or not there is anything there worth computing with." });
      }
    }
  }

  const ethRow = (y) => (flip ? 11 - y : y) + dy;
  const ethTile = (ch) => [ETH[ch][0] + dx, (flip ? 11 - ETH[ch][1] : ETH[ch][1]) + dy];
  return { tiles, arcs: [], ethRow, ethTile, dx, dy, flip };
}

const GRID_LEDE =
  "Wormhole is addressed as a 10 × 12 grid of tiles in NOC0 (x, y) coordinates, and a tile's type follows from where it sits. Columns x = 0 and x = 5 are GDDR6; rows y = 0 and y = 6 are Ethernet. The ARC sits at (0,10) and the one PCIe tile at (0,3). Everything else — 8 columns × 10 rows — is Tensix, of which whole rows are disabled to make the count this SKU ships. Which rows varies per die, but never the scheme: harvesting takes Tensix rows, not columns, indexed on an outside-in pairing order of Y.";

const MESH_NOTE =
  "The lines between tiles are the NOC — this die has no bus and no cache hierarchy, so the mesh IS the memory system. Every tile carries two NOC routers, links to its four orthogonal neighbours, and the dashed stubs at the borders are the wrap: the mesh closes into a torus, so an edge tile is not a dead end. The links run straight THROUGH the disabled Tensix rows: harvesting turns off a tile's compute, and a row that stopped routing would sever the die, so the routers must survive. Tenstorrent does not say so explicitly — it is the only reading the topology allows, not a quoted fact. The two planes are not the same route: NoC 0 travels rightwards as needed, turns at most once, then downwards; NoC 1 goes upwards then leftwards.";

const COORD_NOTE =
  "Drawn in NOC0 coordinates with Y = 11 at the top and Y = 0 at the bottom, the vendor's own convention, so a tile's label cross-references the SoC descriptor directly. Positions are real; the cells are drawn at uniform size, so a Tensix tile and a GDDR tile are not the same area on silicon.";

const SOURCE =
  "the public tt-metal SoC descriptor wormhole_b0_80_arch.yaml, the N150 and N300 board definitions in board.cpp, and UMD's wormhole_implementation.hpp";

// Compact cage placements. QSFP 2's channels sit at opposite ends of the
// Ethernet row (x = 1 and x = 9), so a span between them would cover the
// other cage; each cage is a small board tile with arcs to both channels.
const CAGE_AT = { 1: { x: 4, w: 3 }, 2: { x: 1, w: 2 } };

function cageBoxes(yBoard) {
  return Object.entries(QSFP).map(([port, chans]) => ({
    port: +port, chans, y: yBoard, ...CAGE_AT[+port],
  }));
}

// A single-ASIC card. n150 harvests one Tensix row to make 72 of 80.
export function dieMap(pathPrefix) {
  const die = dieTiles(pathPrefix, { harvestedRows: [11], cages: true, pcieLive: true });
  const BOARD = 12;

  const cages = [
    { port: 2, chans: QSFP[2], x: 1, w: 2 },
    { port: 1, chans: QSFP[1], x: 5, w: 2 },
  ];
  const warp1 = { port: 1, chans: WARP[1], x: 7, w: 2 };

  const boardTiles = [
    { x: 0, y: BOARD, w: 1, h: 1, kind: "io", label: "PCIe ×16 edge", sub: "card connector",
      detail: "The card's edge connector — a board part, not a tile on the die. It carries the die's single PCIe 4.0 ×16 interface out to the host slot.",
      path: "slot" },
    ...cages.map((c) => ({
      x: c.x, y: BOARD, w: c.w, h: 1, kind: "link",
      label: `QSFP-DD ${c.port}`, sub: "200G cage",
      detail: `One of the card's two QSFP-DD 200G cages. This is a BOARD part sitting off the die: it is wired to Ethernet channels ${c.chans.join(" and ")}, whose tiles sit on row y = 0. A cage pairs two 100 GbE tiles for 200 GbE.`,
      specs: [["Cage", `QSFP-DD ${c.port}`], ["Channels", c.chans.join(" and ")], ["Rate", "200G"]],
      path: "qsfp",
    })),
    { x: 3, y: BOARD, w: 2, h: 1, kind: "io",
      label: "Warp 100 · port 2", sub: "bridge connector",
      detail: "The card's second Warp 100 connector. Each Wormhole card takes two Warp 100 bridges. Port 1 is the connector wired to Ethernet channels 14 and 15.",
      specs: [["Port", "Warp 100 · port 2"], ["Bridges on the card", "2"]],
      path: "warp" },
    { x: warp1.x, y: BOARD, w: warp1.w, h: 1, kind: "io",
      label: "Warp 100 · port 1", sub: "bridge connector",
      detail: `The card's Warp 100 connector wired to Ethernet channels ${warp1.chans.join(" and ")} on row y = 6. Warp 100 is Tenstorrent's short-reach card-to-card link, distinct from the QSFP-DD cages.`,
      specs: [["Port", "Warp 100 · port 1"], ["Channels", warp1.chans.join(" and ")], ["Tiles", "(6,6) and (4,6)"]],
      path: "warp" },
  ];

  const arcs = [
    ...cages.flatMap((c) => c.chans.map((ch) => ({
      from: [c.x, BOARD], to: die.ethTile(ch),
      color: "var(--k-link-ink)", dip: 0.45,
      label: `QSFP-DD cage ${c.port} → Ethernet channel ${ch}`,
    }))),
    ...warp1.chans.map((ch) => ({
      from: [warp1.x, BOARD], to: die.ethTile(ch),
      color: "var(--k-io-ink)", dip: 0.45,
      label: `Warp 100 port 1 → Ethernet channel ${ch}`,
    })),
    {
      from: [0, BOARD], to: [0, 11 - 3], color: "var(--k-io-ink)", dip: 0.45,
      label: "PCIe edge connector → the die's PCIe tile at (0,3)",
    },
  ];

  return {
    title: "Die map — the real NOC grid, and the board parts it reaches",
    cols: 10, rows: 13, cell: 62, cellH: 40,
    tiles: [...die.tiles, ...boardTiles], arcs,
    mesh: { torus: true, regions: [{ x0: 0, x1: 9, y0: 0, y1: 11 }] },
    dataflow: {
      label: "Traced read",
      title: "One read: GDDR6 bank (0,7) → Tensix (8,4)",
      from: [0, 11 - 7], to: [8, 11 - 4],
      note: "The packet runs along X to the destination column, turns ONCE, then runs along Y — dimension-ordered routing. Tenstorrent documents that choice and the reason for it: letting packets turn freely reintroduces cyclic-dependency deadlock, where every router waits on the next and none of them moves. Every tile on the way just switches the packet onward; its cores never see it. The route crosses a memory column and, on this drawing, a disabled Tensix row whose compute is off but whose routers are not.",
    },
    lede: GRID_LEDE + " The bottom row is NOT part of the die: it is the board — the two QSFP-DD cages, the two Warp 100 connectors, and the PCIe edge connector — drawn where it belongs, outside the grid, with a run to each die tile it is wired to. One Tensix row is drawn disabled to make 72 of 80; the row chosen is illustrative.",
    hint: "Hover a tile for what sits there. Every tile here opens its block in the hierarchy below.",
    interconnect: MESH_NOTE + " The runs to the bottom row leave the die entirely: a QSFP-DD cage is a connector on the card, wired to two specific Ethernet channels, a Warp 100 connector takes another pair, and the PCIe edge connector carries the die's one PCIe tile to the host slot.",
    note: COORD_NOTE + " The board row underneath has no NOC coordinates and is not part of the mesh.",
    source: SOURCE,
  };
}

// The n300: two ASICs on one board. They are NOT interchangeable copies —
// only ASIC 0 has a live host PCIe function. ASIC 1 is reached over two
// Ethernet links routed across the PCB (TRACE ports). Harvest is two Tensix
// rows per die, 64 of 80 each.
export function dualDieMap() {
  const BAND = 3, TOP = 1, LOWER = TOP + 12 + BAND;
  // ASIC 0 unflipped so its y = 0 Ethernet row (the QSFP cages) faces the
  // board row above it. ASIC 1 unflipped so its y = 0 Ethernet row (TRACE
  // and Warp 100 port 2) faces the band.
  const top = dieTiles("asic0", {
    dy: TOP, flip: false, pcieLive: true, harvestedRows: [11, 1],
  });
  const bottom = dieTiles("asic1", {
    dy: LOWER, flip: false, pcieLive: false, harvestedRows: [11, 1],
  });

  const CH = [{ a0: 8, a1: 0 }, { a0: 9, a1: 1 }];
  const PHY_X = [2, 5], PHY_W = 3;
  const phyDetail = (side, ch) =>
    `The Ethernet PHY on ASIC ${side}'s side of this die-to-die link, carrying its logical channel ${ch}: the ERISC in an Ethernet tile hands packets to the MAC and PCS, which drive SerDes lanes onto the board.`;

  const qsfpTop = cageBoxes(0);

  const tiles = [
    ...top.tiles,
    ...bottom.tiles,
    ...qsfpTop.map((c) => ({
      x: c.x, y: 0, w: c.w, h: 1, kind: "link",
      label: `QSFP-DD ${c.port}`, sub: "200G cage · ASIC 0",
      detail: `One of the card's two QSFP-DD 200G cages, both wired to ASIC 0. Channels ${c.chans.join(" and ")} sit on ASIC 0's y = 0 Ethernet row, directly under this cage. The second die has no QSFP-DD of its own.`,
      specs: [["Cage", `QSFP-DD ${c.port}`], ["ASIC", "0"], ["Channels", c.chans.join(" and ")], ["Rate", "200G"]],
      path: "qsfp",
    })),
    { x: 0, y: 0, w: 1, h: 1, kind: "io", label: "PCIe ×16", sub: "card edge · one function",
      detail: "The card's edge connector. Only ASIC 0's PCIe tile is the host path, so the card enumerates as one PCIe device even though it holds two ASICs. ASIC 1 is reached over the Ethernet links in the band below.",
      specs: [["Link", "PCIe 4.0 ×16"], ["Functions", "1 — both ASICs behind it"], ["ASIC 0 tile", "(0,3)"], ["ASIC 1 host path", "Ethernet, not PCIe"]],
      path: "slot" },
    ...PHY_X.flatMap((x, i) => [
      { x, y: 13, w: PHY_W, h: 1, kind: "link", label: "MAC + PCS",
        sub: `ASIC 0 · ch ${CH[i].a0}`, detail: phyDetail(0, CH[i].a0),
        specs: [["Logical channel", String(CH[i].a0)], ["NOC tile", ETH[CH[i].a0].join(",")], ["Chain", "ERISC → MAC → PCS → SerDes"]], path: "link" },
      { x, y: 14, w: PHY_W, h: 1, kind: "link",
        label: `Link ${i + 1} — PCB trace`, sub: `ch ${CH[i].a0} ⇄ ${CH[i].a1} · stays on the card`,
        detail: `Die-to-die link ${i + 1} of 2, and it never leaves the board: SerDes lanes routed across the PCB between the two ASICs, carrying ASIC 0's logical channel ${CH[i].a0} to ASIC 1's logical channel ${CH[i].a1}. tt-metal's board definition builds exactly this as a pair of TRACE ports joined internally — a port TYPE distinct from the QSFP-DD and Warp connectors, because a trace has no connector at all. The two dies share no NOC; these two links are the only path between them, and they are also how the host reaches ASIC 1.`,
        specs: [["Link", `${i + 1} of 2`], ["Pairing", `ASIC 0 ch ${CH[i].a0} ⇄ ASIC 1 ch ${CH[i].a1}`], ["Medium", "PCB"], ["Leaves the card", "no"], ["Host path to ASIC 1", "yes — tunneled over this fabric"]],
        path: "link" },
      { x, y: 15, w: PHY_W, h: 1, kind: "link", label: "MAC + PCS",
        sub: `ASIC 1 · ch ${CH[i].a1}`, detail: phyDetail(1, CH[i].a1),
        specs: [["Logical channel", String(CH[i].a1)], ["NOC tile", ETH[CH[i].a1].join(",")], ["Chain", "SerDes → PCS → MAC → ERISC"]], path: "link" },
    ]),
    { x: 8, y: 13, w: 2, h: 1, kind: "io", label: "Warp 100 · 1", sub: `ASIC 0 ch ${WARP[1].join("/")}`,
      detail: `Warp 100 port 1, on ASIC 0, wired to Ethernet channels ${WARP[1].join(" and ")} (tiles (6,6) and (4,6)). This is the card-to-card link on the first die.`,
      specs: [["Port", "Warp 100 · port 1"], ["ASIC", "0"], ["Channels", WARP[1].join(" and ")]],
      path: "warp" },
    { x: 8, y: 15, w: 2, h: 1, kind: "io", label: "Warp 100 · 2", sub: `ASIC 1 ch ${WARP[2].join("/")}`,
      detail: `Warp 100 port 2, on ASIC 1, wired to Ethernet channels ${WARP[2].join(" and ")}. The two Warp 100 connectors take channels from DIFFERENT dies, unlike the n300's QSFP-DD cages, which are both on ASIC 0.`,
      specs: [["Port", "Warp 100 · port 2"], ["ASIC", "1"], ["Channels", WARP[2].join(" and ")]],
      path: "warp" },
  ];

  const ink = "var(--k-link-ink)", io = "var(--k-io-ink)";
  const linkArcs = PHY_X.flatMap((x, i) => {
    const mid = x + 1;
    return [
      { from: top.ethTile(CH[i].a0), to: [mid, 13], color: ink, dip: 0.3,
        label: `ASIC 0 Ethernet channel ${CH[i].a0} (${ETH[CH[i].a0].join(",")}) → PHY` },
      { from: [mid, 13], to: [mid, 14], color: ink, dip: 0.2,
        label: `ASIC 0 PHY → the PCB trace of link ${i + 1}` },
      { from: [mid, 14], to: [mid, 15], color: ink, dip: 0.2,
        label: `The PCB trace of link ${i + 1} → ASIC 1 PHY` },
      { from: [mid, 15], to: bottom.ethTile(CH[i].a1), color: ink, dip: 0.3,
        label: `PHY → ASIC 1 Ethernet channel ${CH[i].a1} (${ETH[CH[i].a1].join(",")})` },
    ];
  });

  for (const c of qsfpTop) {
    for (const ch of c.chans) {
      linkArcs.push({
        from: [c.x, 0], to: top.ethTile(ch), color: ink, dip: 0.35,
        label: `QSFP-DD cage ${c.port} → ASIC 0 Ethernet channel ${ch}`,
      });
    }
  }
  for (const ch of WARP[1]) {
    linkArcs.push({
      from: [8, 13], to: top.ethTile(ch), color: io, dip: 0.35,
      label: `Warp 100 port 1 → ASIC 0 Ethernet channel ${ch}`,
    });
  }
  for (const ch of WARP[2]) {
    linkArcs.push({
      from: [8, 15], to: bottom.ethTile(ch), color: io, dip: 0.35,
      label: `Warp 100 port 2 → ASIC 1 Ethernet channel ${ch}`,
    });
  }
  linkArcs.push({
    from: [0, 0], to: [0, TOP + 3], color: io, dip: 0.35,
    label: "PCIe edge connector → ASIC 0's PCIe tile at (0,3) — the card's only host function",
  });

  return {
    title: "One n300d card — both ASICs and the PCB between them",
    cols: 10, rows: LOWER + 12, cell: 62, cellH: 34,
    tiles,
    groups: [{ x0: 0, y0: 0, x1: 9, y1: LOWER + 11, label: "One n300d card — one PCB" }],
    dataflow: {
      label: "Traced cross-die read",
      title: "One read that leaves the die: ASIC 0 Tensix → the link → ASIC 1",
      kind: "stops",
      stops: [[3, TOP + 4], [9, TOP + 6], [3, 13], [3, 14], [3, 15], [9, LOWER], [3, LOWER + 4]],
      note: "Inside a die this would be a handful of NOC hops. Leaving it is a different kind of journey: along ASIC 0's mesh to an Ethernet tile on row y = 6, out through the MAC/PCS, across the board, and back up the same stack into ASIC 1's mesh at row y = 0. The two dies share no NOC, so there is no shorter path — and on this card that path is also how the host reaches ASIC 1, because ASIC 1 has no PCIe function of its own.",
    },
    arcs: [...top.arcs, ...bottom.arcs, ...linkArcs],
    mesh: {
      torus: true,
      regions: [
        { x0: 0, x1: 9, y0: TOP, y1: TOP + 11 },
        { x0: 0, x1: 9, y0: LOWER, y1: LOWER + 11 },
      ],
    },
    lede: GRID_LEDE + " This is ONE CARD: everything inside the outline is a single PCB. Both ASICs are drawn, stacked with the link between them, because they are not interchangeable: only ASIC 0 has a live host PCIe function, and ASIC 1 is reached by tunnelling over the two Ethernet links in the band. Two Tensix rows are drawn disabled on each die to make 64 of 80; the rows chosen are illustrative.",
    hint: "Hover a tile for what sits there. Tiles on the upper die open ASIC 0's branch of the hierarchy, tiles on the lower open ASIC 1's.",
    interconnect: MESH_NOTE + " The band between the dies is BOARD, not silicon: the TWO die-to-die links, drawn as two columns because that is what they are. Read a column downwards and you have the whole path — ASIC 0's MAC/PCS, the pairs crossing the PCB, and the same stack in reverse on ASIC 1. Neither link leaves the card, and there is no connector anywhere on that path; tt-metal types them as TRACE ports for exactly that reason. They are also the host's only path onto ASIC 1. The QSFP-DD cages sit on the top edge, both wired to ASIC 0. Each Warp 100 connector belongs to one die: port 1 to ASIC 0, port 2 to ASIC 1. The two dies share no NOC, so every byte between them takes the PCB path.",
    note: "Both dies are drawn in the DEFAULT configuration: two Tensix rows disabled on each, and ASIC 1's PCIe tile not on the host path. Each die is its own 10 × 12 coordinate space, so both grids run x = 0…9 and y = 0…11 independently, with Y = 0 at the top of each die on this map so the Ethernet rows that leave the die face the board parts they are wired to.",
    source: SOURCE + ". The band comes from tt-metal's own board definition, which builds the N300 from two TRACE ports joined internally — ASIC 0 channels 8 and 9 against ASIC 1 channels 0 and 1 — plus two Warp 100 ports and two QSFP-DD cages, the cages both on ASIC 0",
  };
}

export function asic(activeTensix, opts = {}) {
  const host = opts.host !== false;
  return {
    id: "asic", label: "Wormhole ASIC", kind: "compute",
    note: `${activeTensix} Tensix tiles enabled of the 80 on the die, plus GDDR6 and Ethernet` +
      (host ? "" : " — this die has no live host PCIe; the host reaches it over Ethernet from its twin"),
    specs: [
      ["Tensix tiles enabled", String(activeTensix)],
      ["Tensix tiles on die", "80"],
      ["Baby RISC-V cores on die", `${5 * activeTensix} in the enabled Tensix`],
      ["Big RISC-V cores", "none"],
      ["GDDR6 channels", "6"],
      ["GDDR6 capacity", "12 GB"],
      ["Ethernet tiles", "16"],
      ["PCIe tiles", host ? "1, live" : "1, not the host path"],
    ],
    cols: 4,
    children: [
      {
        ...tensix, id: "tensix", span: 2,
        count: `${activeTensix} of 80 enabled`,
        gridNote:
          `Wormhole harvests whole Tensix rows — ${activeTensix} of the die's 80 tiles are enabled on this SKU, i.e. ${(80 - activeTensix) / 8} of the 10 Tensix rows are fused off. Which rows varies from part to part, so the die map above draws all 80 rather than a particular pattern.`,
      },
      {
        id: "gddr", label: "GDDR6 memory", kind: "memory", span: 2,
        specs: [["Capacity", "12 GB"], ["Channels", "6"], ["Data rate", "12 GT/s"], ["Bandwidth", "288 GB/s"]],
        note: "12 GB of GDDR6 across 6 channels at 12 GT/s, giving 288 GB/s. The tiles do not reach it through a cache hierarchy — each channel is exposed as NOC tiles in the two memory columns, and a Tensix reads DRAM by addressing those tiles over the mesh, the same way it addresses any other tile. The DRAM tile has no programmable core of its own; every transfer is a NOC transaction issued by a Tensix",
      },
      {
        id: "eth", label: "Ethernet", kind: "link", span: 2,
        specs: [["Tiles on die", "16"], ["Per tile", "100 GbE bidirectional"], ["Per QSFP-DD port", "200 GbE — a tile pair"]],
        note: "chip-to-chip scale-out over standard Ethernet rather than a proprietary link. Each tile carries 100 GbE bidirectional and runs its own RISC-V core (an ERISC), so the link is programmable rather than a fixed-function PHY; a QSFP-DD port pairs two tiles for 200 GbE. The same fabric is what joins the two dies of an n300, as TRACE ports with no connector",
      },
      { id: "pcie", label: "PCIe 4.0 ×16", kind: "io",
        note: host
          ? "the die's host interface. Wormhole carries one PCIe tile, a full ×16 on its own, so a card gets its whole ×16 from this single tile"
          : "this die still has a PCIe tile at (0,3), but it is not the host path. The n300 presents one PCIe function, on ASIC 0; this chip is reached over the on-board Ethernet links",
        specs: [["Tiles on die", "1"], ["Link", "PCIe 4.0 ×16"], ["Host path", host ? "yes" : "no"]] },
      { id: "arc", label: "Management complex", kind: "sched",
        note: "the ARC tile — a small always-on controller that brings the die up, runs its firmware, applies the harvesting fuses that decide which Tensix rows are live, and reports clocks, power and temperature to the host. It does no user compute; it is the block the host talks to before any kernel exists, and the one that answers when a tool asks the card what it is" },
    ],
  };
}
