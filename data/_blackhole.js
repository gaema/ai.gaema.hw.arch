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
      note: "the dense matrix unit — what the FP8 and FP16 throughput figures are made of",
    },
    {
      id: "sfpu", label: "Vector engine (SFPU)", kind: "compute",
      note: "elementwise and transcendental work",
    },
    {
      id: "l1", label: "L1 SRAM", kind: "cache", span: 2,
      specs: [["Capacity", "1.5 MB per tile"]],
      note: "software-managed local store, not a cache — the program places data here explicitly",
    },
    { id: "noc0", label: "NoC router 0", kind: "io" },
    { id: "noc1", label: "NoC router 1", kind: "io" },
    { id: "unpack", label: "Unpacker / packer", kind: "io", span: 1 },
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
          detail: "The management complex — power, telemetry, boot and reset for the whole die.",
          path: p("arc") });
      } else if ((x === 2 || x === 11) && y === 0) {
        const off = harv && harv[0] === x && harv[1] === y;
        tiles.push(off
          ? { ...base, kind: "off", label: "PCIe",
              detail: `PCIe core (${x},${y}) — harvested on this SKU. The die has two PCIe tiles and exactly one of them is fused off, so a card's host interface is a single tile, not two.` }
          : { ...base, kind: "io", label: "PCIe", sub: `live · ${x},${y}`,
              detail: `The live PCIe 5.0 host interface, at (${x},${y}). Its twin on the other side of the bottom row is harvested.`,
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
          detail: `One of three NOC tiles serving GDDR6 channel ${ch}. The two memory columns sit at x = 0 and x = 9, so every Tensix column is at most a few hops from a bank.`,
          specs: [["Channels", "8"], ["Capacity", "32 GB"], ["Bandwidth", "512 GB/s"]],
          path: p("gddr") });
      } else if (y === 1) {
        const ch = ethAt[k];
        const port = qsfpAt[k];
        tiles.push({ ...base, kind: "link", label: "ETH",
          sub: port ? `ch ${ch} · QSFP${port}` : `ch ${ch} · idle`,
          detail: port
            ? `Ethernet channel ${ch}, wired to QSFP-DD cage ${port} on the board. Ten 400 GbE links leave the die; the four cages expose eight of the channels.`
            : `Ethernet channel ${ch}. This channel has no board connector on this card, so its ERISC sits idle.`,
          path: p("eth") });
      } else if (y >= 2) {
        tiles.push({ ...base, kind: "compute", label: "Tensix",
          detail: "One Tensix tile: five baby RISC-V cores, a matrix engine, a vector engine and 1.5 MB of software-managed SRAM, behind two NOC routers.",
          specs: [["Baby RISC-V", "5"], ["L1 SRAM", "1.5 MB"], ["NOC routers", "2"]],
          path: p("tensix") });
      } else {
        tiles.push({ ...base, kind: "io", label: "Rtr",
          detail: "A router-only tile on the bottom edge: it switches NOC traffic but carries no compute." });
      }
    }
  }

  // The QSFP-DD cages, each wired to two specific Ethernet tiles.
  const arcs = Object.entries(QSFP).map(([port, chans]) => {
    const [a, b] = chans.map((ch) => ETH[ch]);
    return {
      from: [a[0] + dx, (flip ? 11 - a[1] : a[1]) + dy],
      to: [b[0] + dx, (flip ? 11 - b[1] : b[1]) + dy],
      color: "var(--k-link-ink)", dip: 1.6,
      label: `QSFP-DD cage ${port} — Ethernet channels ${chans.join(" and ")}`,
    };
  });

  // Where this die's Ethernet row landed, so a caller can hang the die-to-die
  // link off it without re-deriving the transform.
  const ethRow = (flip ? 11 - 1 : 1) + dy;
  return { tiles, arcs, ethRow, dx, dy };
}

const GRID_LEDE =
  "Blackhole is addressed as a 17 × 12 grid of tiles in NOC0 (x, y) coordinates, and a tile's type follows from where it sits. Columns x = 0 and x = 9 are GDDR6; row y = 1 is Ethernet; row y = 0 is routers plus the ARC and the PCIe tiles. Column x = 8 is the management column that bisects the die — mostly plain routers, with the ARC at the bottom, the security core above it, and just four L2CPU clusters at y = 3, 5, 7 and 9. Everything else — 14 columns × 10 rows — is Tensix.";

const MESH_NOTE =
  "The lines between tiles are the NOC — this die has no bus and no cache hierarchy, so the mesh IS the memory system. Every tile carries two NOC routers, links to its four orthogonal neighbours, and the dashed stubs at the borders are the wrap: the mesh closes into a torus, so an edge tile is not a dead end. The four curved runs on each die are the QSFP-DD cages, each wired to two specific Ethernet tiles.";

const COORD_NOTE =
  "Drawn in NOC0 coordinates with Y = 11 at the top and Y = 0 at the bottom, the vendor's own convention, so a tile's label cross-references the SoC descriptor directly. Positions are real; the cells are drawn at uniform size, so a Tensix tile and a GDDR tile are not the same area on silicon.";

const SOURCE =
  "the public tt-metal SoC descriptor blackhole_140_arch.yaml, the P150 board definition in board.cpp, the PCIe-harvest assertions in UMD's soc_descriptor.cpp, and p300_mesh_graph_descriptor.textproto";

// A single-ASIC card. P150 fuses off PCIe core (11,0), so (2,0) is the live one.
export function dieMap(pathPrefix) {
  const { tiles, arcs } = dieTiles(pathPrefix, { pcieHarvested: [11, 0] });
  return {
    title: "Die map — the real NOC grid",
    cols: 17, rows: 12, cell: 54, cellH: 40,
    tiles, arcs, mesh: { torus: true },
    lede: GRID_LEDE,
    hint: "Hover a tile for what sits there. Every tile here opens its block in the hierarchy below.",
    interconnect: MESH_NOTE,
    note: COORD_NOTE,
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

  // The two PHY stacks, one per link, sitting between the dies. Each Ethernet
  // port drives 8 SerDes lanes; the bring-up order in the vendor's own
  // firmware postcodes is SERDES -> ETH_CTRL -> MACPCS -> PACKET.
  const PHY_X = [3, 10], PHY_W = 4;
  const phyDetail = (side) =>
    `The Ethernet PHY on ASIC ${side}'s side of one die-to-die link: the ERISC in an Ethernet tile hands packets to the MAC and PCS, which drive 8 SerDes lanes onto the board. The vendor's own bring-up postcodes run SERDES → ETH_CTRL → MACPCS → PACKET, and NUM_SERDES_LANES is 8.`;

  const tiles = [
    ...top.tiles,
    ...bottom.tiles,
    ...PHY_X.flatMap((x, i) => [
      { x, y: 12, w: PHY_W, h: 1, kind: "link", label: "MAC + PCS · SerDes ×8",
        sub: `ASIC 0 · link ${i}`, detail: phyDetail(0),
        specs: [["SerDes lanes", "8"], ["Chain", "ERISC → MAC → PCS → SerDes"]], path: "link" },
      { x, y: 14, w: PHY_W, h: 1, kind: "link", label: "MAC + PCS · SerDes ×8",
        sub: `ASIC 1 · link ${i}`, detail: phyDetail(1),
        specs: [["SerDes lanes", "8"], ["Chain", "SerDes → PCS → MAC → ERISC"]], path: "link" },
    ]),
    { x: 0, y: 13, w: 3, h: 1, kind: "link", label: "on-board", sub: "PCB traces",
      detail: "The die-to-die link never leaves the card: it runs as differential pairs on the PCB between the two ASICs' SerDes, instead of out through a QSFP-DD cage.",
      path: "link" },
    { x: 7, y: 13, w: 3, h: 1, kind: "link", label: "2 × Ethernet", sub: "die ⇄ die",
      detail: "Two Ethernet channels join the ASICs — tt-metal's mesh graph for this board declares a 1 × 2 device topology with channel count 2. WHICH two of the 14 channels carry it is not in any published table: UMD discovers the pairing at bring-up by reading board_id, asic_location and eth_id out of each Ethernet core and matching same-board, different-ASIC pairs. So the runs below mark the Ethernet ROW, not two specific channels.",
      specs: [["Channels", "2"], ["Device topology", "1 × 2"], ["Pairing", "discovered at bring-up"]],
      path: "link" },
    { x: 14, y: 13, w: 3, h: 1, kind: "link", label: "on-board", sub: "PCB traces",
      detail: "The die-to-die link never leaves the card: it runs as differential pairs on the PCB between the two ASICs' SerDes, instead of out through a QSFP-DD cage.",
      path: "link" },
  ];

  // ETH row -> PHY -> PHY -> ETH row, for each of the two links. The ETH ends
  // are anchored on the row, deliberately not on a named channel.
  const linkArcs = PHY_X.flatMap((x, i) => {
    const mid = x + Math.floor(PHY_W / 2);
    const c = "var(--k-link-ink)";
    return [
      { from: [mid, top.ethRow], to: [mid, 12], color: c, dip: 0.3,
        label: `ASIC 0 Ethernet row → PHY, link ${i}` },
      { from: [mid, 12], to: [mid, 14], color: c, dip: 0.3,
        label: `Die-to-die link ${i} — 8 SerDes lanes over the PCB` },
      { from: [mid, 14], to: [mid, bottom.ethRow], color: c, dip: 0.3,
        label: `PHY → ASIC 1 Ethernet row, link ${i}` },
    ];
  });

  return {
    title: "Die map — both ASICs, stacked, and the link between them",
    cols: 17, rows: 12 + BAND + 12, cell: 54, cellH: 34,
    tiles,
    arcs: [...top.arcs, ...bottom.arcs, ...linkArcs],
    // Two closed meshes, one per die — never tied across the band.
    mesh: { torus: true, regions: [{ x0: 0, x1: 16, y0: 0, y1: 11 }, { x0: 0, x1: 16, y0: LOWER, y1: LOWER + 11 }] },
    lede: GRID_LEDE + " Both of the card's ASICs are drawn, stacked with the link between them, because they are not interchangeable: each fuses off a DIFFERENT one of the two PCIe tiles, so their host interfaces mirror each other.",
    hint: "Hover a tile for what sits there. Tiles on the upper die open ASIC 0's branch of the hierarchy, tiles on the lower open ASIC 1's.",
    interconnect: MESH_NOTE + " The two dies do NOT share a NOC: each mesh is closed on its own edges, and the only path between them is the band in the middle — two Ethernet channels, each running out of an Ethernet tile's ERISC through a MAC/PCS and 8 SerDes lanes onto the board, and back up the same stack on the other die.",
    note: COORD_NOTE + " Each die is its own 17 × 12 coordinate space, so both grids run x = 0…16 and y = 0…11 independently. ASIC 1 is drawn MIRRORED — Y = 0 at its top — so that its Ethernet row faces the link; read each die's tile labels, not the page, for its true orientation.",
    source: SOURCE,
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
          `Blackhole harvests whole Tensix columns — ${activeTensix} of the die's 140 tiles are enabled on this SKU, i.e. ${(140 - activeTensix) / 10} of the 14 columns are fused off. Which columns is a per-part property and is not published, so the die map above draws all 140 rather than guessing at a pattern.`,
      },
      {
        id: "bigrv", label: "Big RISC-V complex", kind: "sched", span: 2,
        specs: [["Cores", "16"], ["Core", "SiFive X280"]],
        note: "16 application-class RISC-V cores — Blackhole can run the host program itself rather than depending on an x86 host",
      },
      {
        id: "gddr", label: "GDDR6 memory", kind: "memory", span: 2,
        specs: [["Capacity", "32 GB"], ["Channels", "8"], ["Data rate", "16 GT/s"], ["Bandwidth", "512 GB/s"]],
        note: "8 channels, 32 GB, 512 GB/s",
      },
      {
        id: "eth", label: "Ethernet", kind: "link", span: 2,
        specs: [["Tiles on die", "14"], ["Usable", "12 — 2 are harvested"], ["Wired on a p150a", "8, to 4 QSFP-DD cages"]],
        note: "chip-to-chip scale-out over standard Ethernet rather than a proprietary link. Each Ethernet tile runs its own RISC-V core (an ERISC) — the link is programmable, not a fixed-function PHY",
      },
      { id: "pcie", label: "PCIe 5.0 ×16", kind: "io" },
      { id: "arc", label: "Management complex", kind: "sched", note: "power, telemetry, boot" },
    ],
  };
}
