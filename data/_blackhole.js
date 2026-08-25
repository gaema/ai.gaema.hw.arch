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

export function dieMap(pathPrefix) {
  const { gddrAt, ethAt, qsfpAt } = lookups();
  const tiles = [];
  const p = (id) => (pathPrefix ? pathPrefix + "/" + id : null);

  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 17; x++) {
      const k = `${x},${y}`;
      // NOC0 puts Y=0 at the BOTTOM, so the grid row is flipped to draw the
      // die the way the vendor's own coordinates read. The label keeps the
      // true (x, y) so it cross-references tt-metal directly.
      const base = { x, y: 11 - y, sub: `${x},${y}` };

      if (x === 8 && y === 0) {
        tiles.push({ ...base, kind: "sched", label: "ARC",
          detail: "The management complex — power, telemetry, boot and reset for the whole die.",
          path: p("arc") });
      } else if ((x === 2 || x === 11) && y === 0) {
        tiles.push({ ...base, kind: "io", label: "PCIe",
          detail: "PCIe 5.0 host interface. Two PCIe tiles sit on the bottom router row.",
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

  return {
    title: "Die map — the real NOC grid",
    cols: 17, rows: 12, cell: 54, cellH: 40,
    tiles,
    lede: "Blackhole is addressed as a 17 × 12 grid of tiles in NOC0 (x, y) coordinates, and a tile's type follows from where it sits. Columns x = 0 and x = 9 are GDDR6; row y = 1 is Ethernet; row y = 0 is routers plus the ARC and the two PCIe tiles. Column x = 8 is the management column that bisects the die — mostly plain routers, with the ARC at the bottom, the security core above it, and just four L2CPU clusters at y = 3, 5, 7 and 9. Everything else — 14 columns × 10 rows — is Tensix.",
    hint: "Hover a tile for what sits there. Every tile here opens its block in the hierarchy below.",
    note: "Drawn in NOC0 coordinates with Y = 11 at the top and Y = 0 at the bottom, the vendor's own convention, so a tile's label cross-references the SoC descriptor directly. Positions are real; the cells are drawn at uniform size, so a Tensix tile and a GDDR tile are not the same area on silicon.",
    source: "the public tt-metal SoC descriptor blackhole_140_arch.yaml, and the P150 board definition in board.cpp",
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
      ["Ethernet", "10 × 400 GbE"],
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
        specs: [["Links", "10 × 400 GbE"], ["Aggregate", "~1 TB/s"]],
        note: "chip-to-chip scale-out over standard Ethernet rather than a proprietary link",
      },
      { id: "pcie", label: "PCIe 5.0 ×16", kind: "io" },
      { id: "arc", label: "Management complex", kind: "sched", note: "power, telemetry, boot" },
    ],
  };
}
