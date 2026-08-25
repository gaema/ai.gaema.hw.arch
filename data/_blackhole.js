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

// A schematic 14 × 10 Tensix grid. Blackhole harvests whole columns, so the
// two rightmost columns stand in for the 20 disabled tiles on a 120-core part.
export function tensixGrid(activeCols) {
  const rows = 10, cols = 14, out = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const on = c < activeCols;
      out.push(on
        ? { ...tensix, id: `t-${r}-${c}`, label: `T${c},${r}`, dense: true }
        : { id: `t-${r}-${c}`, label: `T${c},${r}`, kind: "off", dense: true,
            note: "harvested — disabled on this SKU" });
    }
  }
  return out;
}

export function asic(activeTensix) {
  const activeCols = activeTensix / 10;
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
        id: "grid", label: "Tensix grid", kind: "compute", span: 4,
        note: `${activeTensix} of 140 tiles enabled — click through to the array`,
        specs: [["Enabled", String(activeTensix)], ["On the die", "140"]],
        cols: 14,
        gridNote:
          "Schematic, not a die floorplan. Blackhole harvests whole Tensix columns; the greyed columns stand in for the disabled tiles, not for a published harvest pattern.",
        children: tensixGrid(activeCols),
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
        id: "eth", label: "Ethernet", kind: "io", span: 2,
        specs: [["Links", "10 × 400 GbE"], ["Aggregate", "~1 TB/s"]],
        note: "chip-to-chip scale-out over standard Ethernet rather than a proprietary link",
      },
      { id: "pcie", label: "PCIe 5.0 ×16", kind: "io" },
      { id: "arc", label: "Management complex", kind: "sched", note: "power, telemetry, boot" },
    ],
  };
}
