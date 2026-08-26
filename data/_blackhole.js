// Shared Blackhole ASIC hierarchy, used by both Blackhole cards.
// Blackhole is not a GPU: there is no warp scheduler and no hardware cache
// hierarchy. Each Tensix tile is an independent little computer with its own
// software-managed SRAM, and the interesting structure is the NoC between them.

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
      note: "32-bit in-order single-issue RV32IM cores, one instruction per cycle at 1.35 GHz — they issue work to the compute complex rather than doing the maths themselves",
      specs: [
        ["Per tile", "5"],
        ["ISA", "RV32IM, 32-bit"],
        ["Issue", "in-order, single-issue"],
        ["Clock", "1.35 GHz"],
      ],
    },
    {
      id: "matrix", label: "Matrix engine (FPU)", kind: "matrix",
      note: "the dense matrix unit, and where essentially all of a model's arithmetic happens. It multiplies tiles staged in this tile's L1 SRAM and accumulates into a destination register file, one instruction per tile-sized multiply-accumulate rather than a loop of vector operations — so every dense layer, attention projection and convolution lands here. The FP8 and FP16 throughput figures for the card are this engine multiplied by the tile count; BFP8 runs at the same rate as bf16 because the unpacker resolves the shared exponent before the data arrives",
    },
    {
      id: "sfpu", label: "Vector engine (SFPU)", kind: "compute",
      note: "the SIMD unit beside the matrix engine, for everything a matrix multiply cannot express: activations, normalisation, softmax, elementwise arithmetic, and the transcendentals — exponential, reciprocal, square root — those are built from. In a transformer it handles the work between the dense layers, and because it shares the same destination register file as the matrix engine, results can move between the two without a round trip through L1",
    },
    {
      id: "l1", label: "L1 SRAM", kind: "cache", span: 2,
      specs: [["Capacity", "1.5 MB per tile"]],
      note: "1.5 MB of scratchpad per tile — and the single biggest architectural difference from a GPU. It is not a cache: there is no tag array, no eviction policy and no hierarchy behind it, so nothing arrives here by accident. The program moves data in over the NOC explicitly, and every operand the compute engines read comes from this block. That makes performance predictable rather than statistical, and it makes data movement the programmer's problem: 120 tiles × 1.5 MB is 180 MB of addressable on-chip memory, but only if the kernel places its tiles there itself",
    },
    { id: "noc0", label: "NoC router 0", kind: "io",
      note: "one of the tile's two independent NoC planes. NoC 0 travels rightwards as far as needed, turns at most once, then travels downwards — dimension-ordered, which is what keeps the mesh free of cyclic-dependency deadlock. The router runs whether or not this tile's compute does, which is why a harvested column still carries traffic",
      specs: [["Routing", "rightwards, one turn, downwards"], ["Planes on the tile", "2"]] },
    { id: "noc1", label: "NoC router 1", kind: "io",
      note: "the second plane, and deliberately not a copy: NoC 1 goes upwards then leftwards, the mirror of NoC 0. Two planes with opposite orientation let a program pick the shorter direction for a given transfer, and keep two streams from fighting over the same links",
      specs: [["Routing", "upwards, one turn, leftwards"], ["Relationship to NoC 0", "mirrored orientation"]] },
    { id: "unpack", label: "Unpacker / packer", kind: "io", span: 1,
      note: "the format engines either side of the compute complex, and the reason block-float costs nothing at the maths. The UNPACKER reads tiles out of L1 and converts them into the layout the engines want, filling SrcA, SrcB and Dst — this is where a shared exponent is resolved, so BFP8 and bf16 reach the matrix unit at the same rate. The PACKER does the reverse, taking results from Dst back into L1. They are driven by different RISC-V cores: TRISC0 runs the unpackers, TRISC2 the packer, so unpack, compute and pack overlap as a three-stage pipeline",
      specs: [["Unpacker feeds", "SrcA, SrcB, Dst"], ["Packer writes", "Dst → L1"], ["Driven by", "TRISC0 / TRISC2"], ["L1 buffers", "32 circular buffers — 16 in, 16 out"]] },
  ],
};

// ---------------------------------------------------------------- die map
//
// The real NOC grid, not a schematic: Blackhole is 17 columns x 12 rows of
// tiles, addressed in NOC0 (x, y) coordinates, and every tile's TYPE follows
// from its position. 14 of the 17 columns are Tensix (x = 0, 8 and 9 are not),
// and 10 of the 12 rows are Tensix (y = 0 and 1 are not) -- which is exactly
// the 14 x 10 = 140 Tensix tiles on the die.
//
// Positions below are transcribed from the public tt-metal SoC descriptor
// `blackhole_140_arch.yaml` and the P150 board definition in `board.cpp`.

// GDDR channel -> its three NOC tiles. Two memory columns, x = 0 and x = 9,
// four channels each, three tiles per channel = 24 tiles for 8 channels.
const GDDR = {
  0: [[0, 0], [0, 1], [0, 11]],
  1: [[0, 2], [0, 10], [0, 3]],
  2: [[0, 9], [0, 4], [0, 8]],
  3: [[0, 5], [0, 7], [0, 6]],
  4: [[9, 0], [9, 1], [9, 11]],
  5: [[9, 2], [9, 10], [9, 3]],
  6: [[9, 9], [9, 4], [9, 8]],
  7: [[9, 5], [9, 7], [9, 6]],
};

// Ethernet channel -> NOC tile, in the descriptor's channel order. All sit on
// row y = 1.
const ETH = [
  [1, 1], [16, 1], [2, 1], [15, 1], [3, 1], [14, 1], [4, 1],
  [13, 1], [5, 1], [12, 1], [6, 1], [11, 1], [7, 1], [10, 1],
];

// The four QSFP-DD cages on a P150 board, and the two ETH channels each drives.
const QSFP = {
  1: [9, 11], 2: [8, 10], 3: [5, 7], 4: [4, 6],
};

// Column 8 is the management column, and it is NOT uniform. Only four of its
// tiles are L2CPU clusters -- NOC0 y = 3, 9, 5, 7 are clusters 0, 1, 2, 3.
// (tt-metal's SoC descriptor lists the whole column as `router_only` because
// tt-metal does not use the L2CPU; that is a software classification, not the
// silicon.) Source: Tenstorrent's own tt-bh-linux `console/l2cpu.cpp` and
// `boot.py`, both carrying l2cpu_tile_mapping = {0:(8,3), 1:(8,9), 2:(8,5),
// 3:(8,7)}, and the per-cluster device tree, which enumerates cpu@0..cpu@3 as
// `sifive,x280` -- four cores per cluster, 16 on the die.
const L2CPU_Y = { 3: 0, 9: 1, 5: 2, 7: 3 };

// Two Tensix columns are disabled to make 120 of 140. WHICH two varies per die
// -- the public tt-umd P150 example carries harvest_mask 192 (columns 4 and 13)
// while other parts read different pairs, so this is per-die binning and there
// is no fixed "default" position. An earlier revision of this file claimed the
// stock configuration always took a specific pair; that was wrong.
//
// What IS structural is the SHAPE. The mask is indexed on the die's outside-in
// pairing order
//   {1, 16, 2, 15, 3, 14, 4, 13, 5, 12, 6, 11, 7, 10}
// whose entries pair up as (index 2k, 2k+1), and every such pair sums to 17:
// {1,16} {2,15} {3,14} {4,13} {5,12} {6,11} {7,10}. So a two-column harvest is
// always a MIRRORED pair, symmetric about the die's centre line -- one column
// in each half, never two neighbours at one edge. 7 and 10 is one real such
// pair (the innermost); it stands for the shape, not for a known position.
const HARVESTED_TENSIX_X = [7, 10];

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
// `opts.dx` shifts the whole die right, so two of them fit on one grid.
// `opts.pcieHarvested` is the PCIe core this SKU fuses off -- NOT cosmetic:
// UMD asserts it. A P150 and a P300 LEFT chip must have (11,0) harvested; a
// P300 RIGHT chip must have (2,0) harvested. So the two dies of a p300c are
// mirror images of each other in their host interface, and every Blackhole
// card here has exactly ONE live PCIe tile, not two.
export function dieTiles(pathPrefix, opts = {}) {
  const { gddrAt, ethAt, qsfpAt } = lookups();
  const dx = opts.dx || 0, dy = opts.dy || 0;
  // NOC0 puts Y=0 at the bottom, so a die normally draws flipped. A second die
  // stacked below the first is drawn UNflipped, which mirrors it about the
  // horizontal axis and turns its Ethernet row to face the link between them.
  const flip = opts.flip !== false;
  const harv = opts.pcieHarvested;
  const tiles = [];
  const p = (id) => (pathPrefix ? pathPrefix + "/" + id : null);

  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 17; x++) {
      const k = `${x},${y}`;
      // The label keeps the true (x, y) so it cross-references tt-metal
      // directly, whichever way the die is drawn.
      const base = { x: x + dx, y: (flip ? 11 - y : y) + dy, sub: `${x},${y}` };

      if (x === 8 && y === 0) {
        tiles.push({ ...base, kind: "sched", label: "ARC",
          detail: "The ARC management complex: a small always-on controller that boots the die, runs its firmware, applies the harvesting fuses that decide which Tensix columns and which PCIe tile are live, and reports clock, power, temperature and reset state to the host. It runs no user compute — it is what the host talks to before any kernel exists.",
          path: p("arc") });
      } else if ((x === 2 || x === 11) && y === 0) {
        const off = harv && harv[0] === x && harv[1] === y;
        tiles.push(off
          ? { ...base, kind: "off", label: "PCIe", sub: "idle",
              detail: `PCIe tile (${x},${y}) — present and capable, but idle. Tenstorrent's own wording is that the die carries "2x PCI Express tile, for PCI Express 5.0 x16 connectivity with a host system. One of these tiles will be in use; the other will be permanently idle (at least in current products)." So this is not a cut-down link: EACH tile is x16 on its own, and a card gets its full x16 from the single tile that is wired. UMD enforces which one — a P150 and a P300 left die use (2,0); a P300 right die uses (11,0).`,
              specs: [["Capability", "PCIe 5.0 ×16 on its own"], ["State", "idle, not cut down"], ["Tiles on die", "2, one used"]] }
          : { ...base, kind: "io", label: "PCIe", sub: `in use · ${x},${y}`,
              detail: `The PCIe tile this card actually uses, at (${x},${y}). It carries the whole PCIe 5.0 ×16 link by itself — the die's second PCIe tile is equally capable and simply sits idle, which is the vendor's own description rather than a harvest.`,
              specs: [["Link", "PCIe 5.0 ×16"], ["Provided by", "this tile alone"], ["Tiles on die", "2, one used"]],
              path: p("pcie") });
      } else if (x === 8 && y === 2) {
        tiles.push({ ...base, kind: "sched", label: "Security",
          detail: "The security core, in the same column as the ARC and the L2CPU clusters. Multicast writes to Tensix skip this whole column.",
          path: p("arc") });
      } else if (x === 8 && L2CPU_Y[y] !== undefined) {
        tiles.push({ ...base, kind: "sched", label: "L2CPU", sub: `cluster ${L2CPU_Y[y]} · ${x},${y}`,
          detail: `L2CPU cluster ${L2CPU_Y[y]} — four SiFive X280 cores behind a single NOC2AXI port. Four such clusters, at y = 3, 5, 7 and 9 only, make the die's 16 big RISC-V cores; the rest of this column is plain NOC routers.`,
          specs: [["Cores in this cluster", "4 × SiFive X280"], ["Clusters on die", "4"], ["Big RISC-V cores on die", "16"]],
          path: p("bigrv") });
      } else if (x === 8) {
        tiles.push({ ...base, kind: "io", label: "Rtr",
          detail: "A router-only tile in the management column. This column bisects the two Tensix halves and relays NOC traffic; only four of its tiles are L2CPU clusters." });
      } else if (k in gddrAt) {
        const ch = gddrAt[k];
        tiles.push({ ...base, kind: "memory", label: "GDDR6", sub: `ch ${ch} · ${x},${y}`,
          detail: `One of three NOC tiles serving GDDR6 channel ${ch}. It is an on-die port onto that channel, not the memory itself — the DRAM is packages on the board. The two memory columns sit at x = 0 and x = 9, so every Tensix column is at most a few hops from a bank.`,
          specs: [["This tile", `1 of 3 NOC ports on channel ${ch}`], ["Its channel", "64 GB/s"],
                  ["Whole memory subsystem", "8 channels, 512 GB/s"], ["DRAM on the board", "32 GB GDDR6"]],
          path: p("gddr") });
      } else if (y === 1) {
        const ch = ethAt[k];
        // Cage assignments come from the P150 board definition, so they are
        // only claimed on a board that definition describes.
        const port = opts.cages ? qsfpAt[k] : undefined;
        tiles.push({ ...base, kind: "link", label: "ETH",
          sub: opts.cages ? (port ? `ch ${ch} · QSFP${port}` : `ch ${ch} · idle`) : `ch ${ch}`,
          detail: opts.cages
            ? (port
              ? `Ethernet channel ${ch}, 400 GbE bidirectional, wired on the board to QSFP-DD cage ${port} — the cage pairs two such tiles for 800 GbE and is itself a board part, drawn below the die. Each Ethernet tile runs its own RISC-V core, so the link is programmable rather than a fixed-function PHY.`
              : `Ethernet channel ${ch}, 400 GbE bidirectional. No board connector is cabled to this channel on this card — 8 of the 12 usable channels reach a cage — so it can neither send nor receive, though its RISC-V core and L1 remain usable.`)
            : `Ethernet channel ${ch}. Each Ethernet tile runs its own RISC-V core, so the link is programmable rather than a fixed-function PHY. Which channels leave this board, and through what connector, is not drawn for this SKU.`,
          path: p("eth") });
      } else if (y >= 2) {
        // Blackhole harvests whole Tensix COLUMNS -- UMD tests the mask as
        // `tensix_harvesting_mask & (1 << x)`. A P150/P300 ships 120 of 140,
        // i.e. two of the fourteen columns fused off. WHICH two is a per-part
        // property that varies per part, so the count is drawn at a fixed
        // place and every such tile says the position is not the claim.
        const off = HARVESTED_TENSIX_X.includes(x);
        tiles.push(off
          ? { ...base, kind: "off", label: "Tensix", sub: "router on",
              detail: `Compute disabled — one of the 20 Tensix tiles that take this SKU from 140 to 120. Its five RISC-V cores and compute complex are off. Its two NOC routers are almost certainly not: harvesting takes whole columns, and a column that stopped routing would cut the die in half, so the mesh is drawn running through — the only reading the topology allows. WHICH two columns go dark varies per die; this is binning. What does not vary is the shape: the disable mask is indexed on the die's outside-in pairing order {1,16,2,15,3,14,4,13,5,12,6,11,7,10}, whose pairs each sum to 17, so the two columns are always MIRRORED about the die's centre — one in each half. The pair drawn here is real but stands for that shape, not for a known position.`,
              specs: [["Compute", "disabled"], ["NOC routers", "2 — inferred still routing"], ["Columns disabled", "2 of 14, a mirrored pair"], ["Tiles", "20 of 140"], ["Which pair", "varies per die"]] }
          : { ...base, kind: "compute", label: "Tensix",
              detail: "One Tensix tile: five baby RISC-V cores, a matrix engine, a vector engine and 1.5 MB of software-managed SRAM, behind two NOC routers.",
              specs: [["Baby RISC-V", "5"], ["L1 SRAM", "1.5 MB"], ["NOC routers", "2"]],
              path: p("tensix") });
      } else {
        tiles.push({ ...base, kind: "io", label: "Rtr",
          detail: "A router-only tile on the bottom edge. It carries the two NOC routers every grid position has, so traffic passes through it exactly as it would through a Tensix, but it has no compute engines and no L1 for a kernel to use. Its purpose is topological: the mesh is a torus and needs a switch at every coordinate, whether or not there is anything there worth computing with." });
      }
    }
  }

  // Where this die's Ethernet row landed, so a caller can hang board-level
  // parts off it without re-deriving the transform. A cage is NOT emitted here:
  // it is a board part and belongs outside the die block, which is the caller's
  // job to place.
  const ethRow = (flip ? 11 - 1 : 1) + dy;
  const ethTile = (ch) => [ETH[ch][0] + dx, (flip ? 11 - ETH[ch][1] : ETH[ch][1]) + dy];
  return { tiles, arcs: [], ethRow, ethTile, dx, dy };
}

const GRID_LEDE =
  "Blackhole is addressed as a 17 × 12 grid of tiles in NOC0 (x, y) coordinates, and a tile's type follows from where it sits. Columns x = 0 and x = 9 are GDDR6; row y = 1 is Ethernet; row y = 0 is routers plus the ARC and the PCIe tiles. Column x = 8 is the management column that bisects the die — mostly plain routers, with the ARC at the bottom, the security core above it, and just four L2CPU clusters at y = 3, 5, 7 and 9. Everything else — 14 columns × 10 rows — is Tensix, of which two columns are disabled to make the 120 this SKU ships. Which two varies per die, but never their shape: the disable mask is indexed on an outside-in pairing order whose pairs each sum to 17, so the two are always mirrored about the die's centre — one column in each half.";

const MESH_NOTE =
  "The lines between tiles are the NOC — this die has no bus and no cache hierarchy, so the mesh IS the memory system. Every tile carries two NOC routers, links to its four orthogonal neighbours, and the dashed stubs at the borders are the wrap: the mesh closes into a torus, so an edge tile is not a dead end. The links run straight THROUGH the two disabled Tensix columns: harvesting turns off a tile's compute, and a column that stopped routing would sever the die, so the routers must survive. Tenstorrent does not say so explicitly — it is the only reading the topology allows, not a quoted fact. The two planes are not the same route: NoC 0 travels rightwards as needed, turns at most once, then downwards; NoC 1 goes upwards then leftwards.";

const COORD_NOTE =
  "Drawn in NOC0 coordinates with Y = 11 at the top and Y = 0 at the bottom, the vendor's own convention, so a tile's label cross-references the SoC descriptor directly. Positions are real; the cells are drawn at uniform size, so a Tensix tile and a GDDR tile are not the same area on silicon.";

const SOURCE =
  "the public tt-metal SoC descriptor blackhole_140_arch.yaml, the P150 board definition in board.cpp, the PCIe-harvest assertions in UMD's soc_descriptor.cpp, and p300_mesh_graph_descriptor.textproto";

// A single-ASIC card. P150 fuses off PCIe core (11,0), so (2,0) is the live one.
export function dieMap(pathPrefix) {
  const die = dieTiles(pathPrefix, { pcieHarvested: [11, 0], cages: true });
  const BOARD = 12;   // one row under the die, for the parts that are not on it

  // The cages are BOARD parts. Each sits under the pair of Ethernet tiles it is
  // wired to, outside the die block, with a run to each of its two channels.
  const cages = Object.entries(QSFP).map(([port, chans]) => {
    const xs = chans.map((ch) => die.ethTile(ch)[0]).sort((a, b) => a - b);
    return { port: +port, chans, x: xs[0], w: xs[1] - xs[0] + 1 };
  });

  const boardTiles = [
    { x: 0, y: BOARD, w: 3, h: 1, kind: "io", label: "PCIe ×16 edge", sub: "card connector",
      detail: "The card's edge connector — a board part, not a tile on the die. It carries the die's single live PCIe interface out to the host slot.",
      path: "slot" },
    ...cages.map((c) => ({
      x: c.x, y: BOARD, w: c.w, h: 1, kind: "link",
      label: `QSFP-DD ${c.port}`, sub: "800G cage",
      detail: `One of the card's four QSFP-DD 800G cages. This is a BOARD part sitting off the die: it is wired to Ethernet channels ${c.chans.join(" and ")}, whose tiles sit directly above it. Eight of the die's fourteen Ethernet channels reach a cage on this card; the rest have no connector and idle.`,
      specs: [["Cage", `QSFP-DD ${c.port}`], ["Channels", c.chans.join(" and ")], ["Rate", "800G"]],
      // A board part opens the CARD-level node, not one inside the ASIC.
      path: "qsfp",
    })),
  ];

  // Board part -> the die tiles it is wired to.
  const arcs = cages.flatMap((c) => c.chans.map((ch) => ({
    from: [c.x, BOARD], to: die.ethTile(ch),
    color: "var(--k-link-ink)", dip: 0.45,
    label: `QSFP-DD cage ${c.port} → Ethernet channel ${ch}`,
  })));
  arcs.push({
    from: [0, BOARD], to: [2, 11], color: "var(--k-io-ink)", dip: 0.45,
    label: "PCIe edge connector → the die's live PCIe tile at (2,0)",
  });

  return {
    title: "Die map — the real NOC grid, and the board parts it reaches",
    cols: 17, rows: 13, cell: 54, cellH: 40,
    tiles: [...die.tiles, ...boardTiles], arcs,
    // The mesh is the DIE. The board row is not part of it.
    mesh: { torus: true, regions: [{ x0: 0, x1: 16, y0: 0, y1: 11 }] },
    // A read from a GDDR6 bank on the far side of the die to a Tensix tile:
    // NOC0 (0, 6) -> (12, 4), drawn in flipped rows. It crosses the management
    // spine AND a disabled Tensix column, which is the point.
    dataflow: {
      label: "Traced read",
      title: "One read: GDDR6 bank (0,6) → Tensix (12,4)",
      from: [0, 11 - 6], to: [12, 11 - 4],
      note: "The packet runs along X to the destination column, turns ONCE, then runs along Y — dimension-ordered routing. Tenstorrent documents that choice and the reason for it: letting packets turn freely reintroduces cyclic-dependency deadlock, where every router waits on the next and none of them moves. Every tile on the way just switches the packet onward; its cores never see it. Note what the route passes straight through — the management spine at x = 8, and a disabled Tensix column, whose compute is off but whose routers are not.",
    },
    lede: GRID_LEDE + " The bottom row is NOT part of the die: it is the board — the four QSFP-DD cages and the PCIe edge connector — drawn where it belongs, outside the grid, with a run to each die tile it is wired to.",
    hint: "Hover a tile for what sits there. Every tile here opens its block in the hierarchy below.",
    interconnect: MESH_NOTE + " The runs to the bottom row leave the die entirely: a QSFP-DD cage is a connector on the card, wired to two specific Ethernet channels, and the PCIe edge connector carries the die's one live PCIe tile to the host slot.",
    note: COORD_NOTE + " The board row underneath has no NOC coordinates and is not part of the mesh.",
    source: SOURCE,
  };
}

// The p300c: two ASICs on one board, drawn together, because the whole point of
// the card is the pair. They are NOT interchangeable copies -- UMD asserts that
// the left chip has PCIe (11,0) harvested and the right chip has (2,0)
// harvested, so their host interfaces are mirror images. The gutter between
// them carries the die-to-die link.
export function dualDieMap() {
  // Stacked, not side by side: the two dies face each other across the link,
  // which is the only thing joining them. ASIC 1 is drawn mirrored so its
  // Ethernet row turns toward the band instead of away from it.
  const BAND = 3, LOWER = 12 + BAND;
  const top = dieTiles("asic0", { pcieHarvested: [11, 0] });
  const bottom = dieTiles("asic1", { dy: LOWER, flip: false, pcieHarvested: [2, 0] });

  // The band is drawn as TWO SELF-CONTAINED LINKS, not as one wide bar with the
  // PHYs beside it. There really are two independent die-to-die links, and the
  // earlier drawing -- a single full-width "die <-> die" bar running behind both
  // PHY stacks -- merged them into one undifferentiated hatched region, so the
  // count was invisible and no PHY could be told which trace it drove. Each link
  // now occupies one column of the band and reads top to bottom in the order the
  // signal travels: ASIC 0's PHY, the PCB trace, ASIC 1's PHY.
  const PHY_X = [4, 10], PHY_W = 4;
  // Two channels, and the pairing is PUBLIC in two independent places that
  // agree: tt-metal's board.cpp gives the P300's TRACE ports as ASIC 1 channels
  // 8,9 and ASIC 0 channels 3,2, joined internally; UMD's own P300 cluster
  // descriptor example lists chip0 ch2 <-> chip1 ch9 and chip0 ch3 <-> chip1 ch8.
  const CH = [{ a0: 3, a1: 8 }, { a0: 2, a1: 9 }];
  const phyDetail = (side, ch) =>
    `The Ethernet PHY on ASIC ${side}'s side of this die-to-die link, carrying its logical channel ${ch}: the ERISC in an Ethernet tile hands packets to the MAC and PCS, which drive 8 SerDes lanes onto the board. The vendor's own bring-up postcodes run SERDES → ETH_CTRL → MACPCS → PACKET, and NUM_SERDES_LANES is 8.`;

  const tiles = [
    ...top.tiles,
    ...bottom.tiles,
    // One link per column: PHY, trace, PHY. Reading down a column is the path a
    // packet takes, and the two columns are the two links.
    ...PHY_X.flatMap((x, i) => [
      { x, y: 12, w: PHY_W, h: 1, kind: "link", label: "MAC + PCS · SerDes ×8",
        sub: `ASIC 0 · ch ${CH[i].a0}`, detail: phyDetail(0, CH[i].a0),
        specs: [["Logical channel", String(CH[i].a0)], ["SerDes lanes", "8"], ["Chain", "ERISC → MAC → PCS → SerDes"]], path: "link" },
      { x, y: 13, w: PHY_W, h: 1, kind: "link",
        label: `Link ${i + 1} — PCB trace`, sub: `ch ${CH[i].a0} ⇄ ${CH[i].a1} · 8 pairs · stays on the card`,
        detail: `Die-to-die link ${i + 1} of 2, and it never leaves the board: eight differential pairs routed across the PCB between the two ASICs' SerDes, carrying ASIC 0's logical channel ${CH[i].a0} to ASIC 1's logical channel ${CH[i].a1}. tt-metal's board definition builds exactly this as a pair of TRACE ports joined internally — a port TYPE distinct from the QSFP-DD and Warp connectors, because a trace has no connector at all. Read the column: ASIC 0's PHY above, this trace, ASIC 1's PHY below. The channel numbers are LOGICAL ids, renumbered by Ethernet harvesting, so they do not index the SoC descriptor's tile list and no NOC coordinate is claimed for them.`,
        specs: [["Link", `${i + 1} of 2`], ["Pairing", `ASIC 0 ch ${CH[i].a0} ⇄ ASIC 1 ch ${CH[i].a1}`], ["Medium", "PCB differential pairs"], ["Lanes", "8"], ["Leaves the card", "no"]],
        path: "link" },
      { x, y: 14, w: PHY_W, h: 1, kind: "link", label: "MAC + PCS · SerDes ×8",
        sub: `ASIC 1 · ch ${CH[i].a1}`, detail: phyDetail(1, CH[i].a1),
        specs: [["Logical channel", String(CH[i].a1)], ["SerDes lanes", "8"], ["Chain", "SerDes → PCS → MAC → ERISC"]], path: "link" },
    ]),
    // The band between the dies is BOARD, not silicon, and it holds two KINDS of
    // thing: the die-to-die links above, which never leave the card, and the
    // card-to-card connectors, which are the only way off it.
    //
    // There are TWO connector positions, one at each end of the band, and they
    // are drawn full height because each carries channels from BOTH dies -- not
    // one connector per die. On the p300c only one is fitted; the other is a
    // populated-on-some-variants footprint, drawn struck through like the
    // harvested Tensix columns, for the same reason: the cut should be visible.
    { x: 0, y: 12, w: 3, h: 3, kind: "io", label: "Warp 400", sub: "card ⇄ card · fitted",
      detail: "One of the board's two card-to-card connector positions, and the one a p300c ships with populated. It is NOT a QSFP-DD cage: tt-metal types the P300's off-card ports as WARP400, and Tenstorrent joins the two p300c cards inside a TT-QuietBox 2 with a Samtec ARP6-series high-performance cable. Channels from BOTH dies leave through this one connector — the board definition wires each Warp 400 position to two Ethernet channels on each ASIC, four in all — which is why it is drawn spanning the whole band rather than sitting under one die.",
      specs: [["Port type", "Warp 400"], ["Cable", "Samtec ARP6 series"], ["Not", "QSFP-DD"], ["Channels", "4 — 2 from each ASIC"], ["Fitted on p300c", "yes"]],
      path: "link" },
    { x: 14, y: 12, w: 3, h: 3, kind: "off", label: "Warp 400", sub: "second position · not fitted",
      detail: "The board's SECOND card-to-card connector position — present in the design, not populated on a p300c. tt-metal's board definition gives the P300 two Warp 400 ports, each wired to two Ethernet channels on each ASIC, and it does not distinguish the variants: p300a and p300c both map to the same board type, so software sees two positions where this card has one. That is why it is drawn here rather than omitted — an absent connector you cannot see looks like a board that never had one, and the eight Ethernet channels it would have driven are idle on this card, not missing.",
      specs: [["Port type", "Warp 400"], ["Positions on the board", "2"], ["Fitted on p300c", "no"], ["Channels it would carry", "4 — 2 from each ASIC"]],
      path: "link" },
  ];

  // ETH row -> PHY -> PHY -> ETH row, for each of the two links. The ETH ends
  // are anchored on the row, deliberately not on a named channel.
  const linkArcs = PHY_X.flatMap((x, i) => {
    const mid = x + Math.floor(PHY_W / 2);
    const c = "var(--k-link-ink)";
    return [
      { from: [mid, top.ethRow], to: [mid, 12], color: c, dip: 0.3,
        label: `ASIC 0 Ethernet row → PHY (logical channel ${CH[i].a0}; which tile that is depends on harvest renumbering, so the run anchors on the row)` },
      // Through the trace tile rather than past it, so the run and the tile it
      // names are the same object on screen.
      { from: [mid, 12], to: [mid, 13], color: c, dip: 0.2,
        label: `ASIC 0 PHY → the PCB trace of link ${i + 1} (logical channel ${CH[i].a0}, 8 SerDes lanes)` },
      { from: [mid, 13], to: [mid, 14], color: c, dip: 0.2,
        label: `The PCB trace of link ${i + 1} → ASIC 1 PHY (logical channel ${CH[i].a1}, 8 SerDes lanes)` },
      { from: [mid, 14], to: [mid, bottom.ethRow], color: c, dip: 0.3,
        label: `PHY → ASIC 1 Ethernet row (logical channel ${CH[i].a1}; which tile that is depends on harvest renumbering, so the run anchors on the row)` },
    ];
  });

  // Ethernet also leaves the CARD, through the FITTED Warp 400 connector, from
  // both dies. Only the fitted one gets runs: the second position has nothing
  // wired to it on this card, and drawing runs into an empty footprint would say
  // the opposite of what the struck-through tile says.
  linkArcs.push(
    { from: [1, top.ethRow], to: [1, 13], color: "var(--k-io-ink)", dip: 0.3,
      label: "ASIC 0 Ethernet → the fitted Warp 400 card-to-card connector" },
    { from: [1, 13], to: [1, bottom.ethRow], color: "var(--k-io-ink)", dip: 0.3,
      label: "The fitted Warp 400 connector → ASIC 1 Ethernet" },
  );

  return {
    title: "Die map — both ASICs, the PCB between them, and what leaves the card",
    cols: 17, rows: 12 + BAND + 12, cell: 54, cellH: 34,
    tiles,
    // A read that has to cross to the OTHER die: Tensix on ASIC 0, down its own
    // mesh to the Ethernet row, across the link, and on into ASIC 1.
    dataflow: {
      label: "Traced cross-die read",
      title: "One read that leaves the die: ASIC 0 Tensix → the link → ASIC 1",
      kind: "stops",
      // Through row 13 as well: the PCB trace is a stop on the journey, and
      // skipping it would step over the one part that is not silicon.
      stops: [[5, 11 - 6], [5, 11 - 1], [5, 12], [5, 13], [5, 14], [5, LOWER + 1], [5, LOWER + 6]],
      note: "Inside a die this would be a handful of NOC hops. Leaving it is a different kind of journey: down ASIC 0's mesh to an Ethernet tile, out through the MAC/PCS and 8 SerDes lanes, across the board, and back up the same stack into ASIC 1's mesh. The two dies share no NOC, so there is no shorter path — which is why the pair behaves as two devices that talk, rather than as one big grid.",
    },
    arcs: [...top.arcs, ...bottom.arcs, ...linkArcs],
    // Two closed meshes, one per die — never tied across the band.
    mesh: { torus: true, regions: [{ x0: 0, x1: 16, y0: 0, y1: 11 }, { x0: 0, x1: 16, y0: LOWER, y1: LOWER + 11 }] },
    lede: GRID_LEDE + " Both of the card's ASICs are drawn, stacked with the link between them, because they are not interchangeable: each fuses off a DIFFERENT one of the two PCIe tiles, so their host interfaces mirror each other.",
    hint: "Hover a tile for what sits there. Tiles on the upper die open ASIC 0's branch of the hierarchy, tiles on the lower open ASIC 1's.",
    interconnect: MESH_NOTE + " The band between the dies is BOARD, not silicon, and it holds two different KINDS of thing. In the middle are the TWO die-to-die links, drawn as two columns because that is what they are — read a column downwards and you have the whole path: ASIC 0's MAC/PCS driving 8 SerDes lanes, the differential pairs crossing the PCB, and the same stack in reverse on ASIC 1. Neither link leaves the card. At each end of the band is a Warp 400 card-to-card connector, the only way OFF the card, drawn full height because a single connector carries channels from BOTH dies rather than belonging to one. The board has two such positions and a p300c fits ONE; the second is drawn struck through, like a harvested Tensix column, because a footprint you simply omit reads as a board that never had one. The two dies share no NOC, so every byte between them takes the PCB path.",
    note: "Both dies are drawn in the DEFAULT configuration: two Tensix columns disabled on each, and the mirrored PCIe harvest. " + COORD_NOTE + " Each die is its own 17 × 12 coordinate space, so both grids run x = 0…16 and y = 0…11 independently. ASIC 1 is drawn MIRRORED — Y = 0 at its top — so that its Ethernet row faces the link; read each die's tile labels, not the page, for its true orientation.",
    source: SOURCE + ". The band comes from tt-metal's own board definition, which builds the P300 from two TRACE ports joined internally — ASIC 1 channels 8 and 9 against ASIC 0 channels 3 and 2 — plus two Warp 400 ports, each wired to two Ethernet channels on each ASIC. UMD's published P300 cluster-descriptor example agrees channel for channel: chip 0 ch 2 ⇄ chip 1 ch 9, chip 0 ch 3 ⇄ chip 1 ch 8. That same example carries the mirrored PCIe harvest drawn above, one die masking core 1 and the other core 0. Which of the two Warp 400 positions is populated is a property of the BOARD VARIANT and not of that definition, which maps p300a and p300c to one board type",
  };
}

export function asic(activeTensix) {
  return {
    id: "asic", label: "Blackhole ASIC", kind: "compute",
    note: `${activeTensix} Tensix tiles enabled of the 140 on the die, plus the big RISC-V complex, GDDR6 and Ethernet`,
    specs: [
      ["Tensix tiles enabled", String(activeTensix)],
      ["Tensix tiles on die", "140"],
      ["Baby RISC-V cores on die", "752 total (700 in Tensix)"],
      ["Big RISC-V cores", "16 (SiFive X280)"],
      ["GDDR6 channels", "8"],
      ["GDDR6 capacity", "32 GB"],
      ["Ethernet tiles", "14 on the die, 12 usable"],
      ["PCIe tiles", "2 on the die, 1 live"],
    ],
    cols: 4,
    children: [
      {
        ...tensix, id: "tensix", span: 2,
        count: `${activeTensix} of 140 enabled`,
        gridNote:
          `Blackhole harvests whole Tensix columns — ${activeTensix} of the die's 140 tiles are enabled on this SKU, i.e. ${(140 - activeTensix) / 10} of the 14 columns are fused off. Which columns varies from part to part, so the die map above draws all 140 rather than a particular pattern.`,
      },
      {
        id: "bigrv", label: "Big RISC-V complex", kind: "sched", span: 2,
        specs: [["Cores", "16"], ["Core", "SiFive X280"]],
        note: "16 application-class RISC-V cores — Blackhole can run the host program itself rather than depending on an x86 host",
      },
      {
        id: "gddr", label: "GDDR6 memory", kind: "memory", span: 2,
        specs: [["Capacity", "32 GB"], ["Channels", "8"], ["Data rate", "16 GT/s"], ["Bandwidth", "512 GB/s"]],
        note: "32 GB of GDDR6 across 8 channels at 16 GT/s, giving 512 GB/s. The tiles do not reach it through a cache hierarchy — each channel is exposed as NOC tiles in the two memory columns, and a Tensix reads DRAM by addressing those tiles over the mesh, the same way it addresses any other tile. On a memory-bound decode this rate sets the floor on time per token: the weights cross it once per token unless they already live in tile SRAM",
      },
      {
        id: "eth", label: "Ethernet", kind: "link", span: 2,
        specs: [["Tiles on die", "14"], ["Usable", "12 — 2 are harvested"], ["Per tile", "400 GbE bidirectional"], ["Per QSFP-DD port", "800 GbE — a tile pair"], ["Cabled on a p150a", "8 of the 12"]],
        note: "chip-to-chip scale-out over standard Ethernet rather than a proprietary link. Each tile carries 400 GbE bidirectional and runs its own RISC-V core (an ERISC), so the link is programmable rather than a fixed-function PHY; a QSFP-DD port pairs two tiles for 800 GbE. Only 8 of the 12 usable tiles are cabled on a p150a — the other four keep their RISC-V and L1 but cannot send or receive",
      },
      { id: "pcie", label: "PCIe 5.0 ×16", kind: "io",
        note: "the die's host interface. Two PCIe tiles exist and each is a full ×16 on its own; one is used and the other sits permanently idle on current products, so a card gets its whole ×16 from a single tile rather than splitting the link across both",
        specs: [["Tiles on die", "2, one used"], ["Link", "PCIe 5.0 ×16 from one tile"], ["Bandwidth", "~63 GB/s per direction"]] },
      { id: "arc", label: "Management complex", kind: "sched",
        note: "the ARC tile — a small always-on controller that brings the die up, runs its firmware, applies the harvesting fuses that decide which Tensix columns and which PCIe tile are live, and reports clocks, power and temperature to the host. It does no user compute; it is the block the host talks to before any kernel exists, and the one that answers when a tool asks the card what it is" },
    ],
  };
}
