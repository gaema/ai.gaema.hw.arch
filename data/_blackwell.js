import { band, field, memBand, MAP_NOTE } from "./_floorplan.js";

// Shared Blackwell (GB202) hierarchy, used by both GB202 cards.
// The GPC → TPC → SM → processing-block nesting is common to the die; the two
// SKUs differ only in how much of it is enabled, and in the memory attached.

export const processingBlock = {
  id: "pb", label: "Processing block", kind: "compute", count: "4 per SM",
  note: "32 CUDA cores and one 5th-generation Tensor Core, with their own scheduler and register file",
  specs: [
    ["Per SM", "4"],
    ["CUDA cores", "32"],
    ["Tensor Cores", "1 (5th gen)"],
  ],
  cols: 4,
  children: [
    { id: "cuda", label: "CUDA cores ×32", kind: "compute", span: 2 },
    {
      id: "tc", label: "Tensor Core", kind: "matrix", span: 2,
      note: "5th generation — the matrix engine behind the card's low-precision throughput",
      specs: [["Per processing block", "1"], ["Per SM", "4"], ["Generation", "5th"]],
    },
    { id: "warp", label: "Warp scheduler", kind: "sched" },
    { id: "rf", label: "Register file", kind: "cache" },
    { id: "l0i", label: "L0 instruction cache", kind: "cache" },
    { id: "lsu", label: "LD/ST + SFU", kind: "io" },
  ],
};

export function sm(total) {
  return {
    id: "sm", label: "Streaming Multiprocessor", kind: "compute",
    count: total ? total + " enabled on the card" : null,
    note: "4 processing blocks (128 CUDA cores, 4 Tensor Cores) plus one RT core",
    specs: [
      ["Processing blocks", "4"],
      ["CUDA cores", "128"],
      ["Tensor Cores", "4 (5th gen)"],
      ["RT core", "1 (4th gen)"],
    ],
    cols: 4,
    children: [
      { ...processingBlock, id: "pb0", label: "Processing block 0", count: null },
      { ...processingBlock, id: "pb1", label: "Processing block 1", count: null },
      { ...processingBlock, id: "pb2", label: "Processing block 2", count: null },
      { ...processingBlock, id: "pb3", label: "Processing block 3", count: null },
      { id: "l1", label: "L1 data cache / shared memory", kind: "cache", span: 2 },
      { id: "rt", label: "RT Core", kind: "fixed", note: "4th generation" },
      { id: "tex", label: "Texture units ×4", kind: "fixed" },
    ],
  };
}

export function tpc(total) {
  return {
    id: "tpc", label: "Texture Processing Cluster", kind: "compute",
    note: "an SM pair",
    specs: [["SMs", "2"]],
    cols: 2,
    children: [
      { ...sm(total), id: "sm0", label: "SM 0", count: null },
      { ...sm(total), id: "sm1", label: "SM 1", count: null },
      { id: "pm", label: "PolyMorph engine", kind: "fixed", span: 2 },
    ],
  };
}

export function gpc(total) {
  const t = tpc(total);
  return {
    id: "gpc", label: "Graphics Processing Cluster", kind: "compute",
    count: "12 on the full GB202 die",
    note: "8 TPCs (16 SMs) behind a raster engine",
    specs: [["TPCs", "8"], ["SMs", "16"]],
    cols: 4,
    children: [
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ ...t, id: "tpc" + i, label: "TPC " + i })),
      { id: "raster", label: "Raster engine", kind: "fixed", span: 4 },
    ],
  };
}

// The die-level view: the GPC array plus everything outside it.
export function die(opts) {
  const g = gpc(opts.activeSMs);
  return [
    ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => ({
      ...g, id: "gpc" + i, label: "GPC " + i, count: null,
    })),
    {
      id: "l2", label: "L2 cache", kind: "cache", span: 2,
      note: "shared across every GPC; NVIDIA does not publish the capacity for this SKU",
    },
    {
      id: "mem", label: opts.memLabel, kind: "memory", span: 2,
      specs: [
        ["Capacity", opts.mem],
        ["Bus", opts.bus],
        ["Bandwidth", opts.bw],
      ],
      note: opts.memNote,
    },
    { id: "gigathread", label: "GigaThread engine", kind: "sched", note: "work distribution" },
    { id: "pcie", label: "PCIe 5.0 ×16", kind: "io" },
    { id: "nvenc", label: "NVENC / NVDEC", kind: "fixed", note: "video encode / decode" },
    { id: "display", label: "Display engine", kind: "io" },
  ];
}

// The GB202 die map. One column per GPC, one cell per TPC -- 12 x 8 = 96 TPCs,
// which is the die's 192 SMs. Both cards are the same die; they differ only in
// how many SMs are enabled and in the memory hung off the edges.
export function dieMap(opts) {
  return {
    title: "Die map — GB202",
    cols: 12, rows: 12, cell: 62, cellH: 40,
    lede: "Each column below is one graphics processing cluster, each cell one texture processing cluster — an SM pair. Twelve GPCs of eight TPCs is the full GB202: 96 TPCs, 192 SMs, 24,576 CUDA cores.",
    hint: "Hover a block for detail. Every TPC opens at its own place in the hierarchy below.",
    tiles: [
      ...band(0, [
        { w: 4, kind: "io", label: "PCIe 5.0 ×16", path: "pcie",
          detail: "Host interface. PCIe 5.0 ×16." },
        { w: 4, kind: "sched", label: "GigaThread engine", sub: "work distribution", path: "gigathread",
          detail: "Distributes work across the GPCs." },
        { w: 4, kind: "fixed", label: "NVENC / NVDEC + display", path: "nvenc",
          detail: "Video encode and decode blocks, and the display engine." },
      ]),
      ...memBand(1, 6, 12, "GDDR7", (i) => `ctrl ${i * 2}–${i * 2 + 1}`,
        `Part of the 512-bit GDDR7 interface — sixteen 32-bit controllers, ${opts.mem} at ${opts.bw}. Half are drawn on each edge.`,
        [["Capacity", opts.mem], ["Bus", "512-bit"], ["Bandwidth", opts.bw]], "mem"),
      ...band(2, [{ w: 12, kind: "cache", label: "L2 cache", sub: "shared across every GPC · banked", path: "l2",
        detail: "Shared last level on the die. Blackwell's L2 is partitioned into slices attached to the memory controllers, so it is physically split along both memory edges rather than being the single central band drawn here. NVIDIA does not publish the capacity for this SKU, so none is claimed.",
        specs: [["Capacity", "not published"], ["Physically", "sliced per memory partition"]] }]),
      ...field({
        y0: 3, perRow: 12, rows: 8, w: 1,
        make: (i, c, r) => ({
          kind: "compute", label: "TPC", sub: `G${c}·${r}`,
          path: `gpc${c}/tpc${r}`,
          detail: `Texture processing cluster ${r} of GPC ${c}. Two SMs — 256 CUDA cores, 8 fifth-generation Tensor Cores and 2 RT cores.`,
          specs: [["SMs", "2"], ["CUDA cores", "256"], ["Tensor Cores", "8"]],
        }),
      }),
      ...memBand(11, 6, 12, "GDDR7", (i) => `ctrl ${12 + i * 2}–${13 + i * 2}`,
        `Part of the 512-bit GDDR7 interface — sixteen 32-bit controllers, ${opts.mem} at ${opts.bw}. Half are drawn on each edge.`,
        [["Capacity", opts.mem], ["Bus", "512-bit"], ["Bandwidth", opts.bw]], "mem"),
    ],
    note: `The full 192-SM die is drawn. This card enables ${opts.activeSMs} of them, and NVIDIA does not publish which are fused off — so no particular TPC here is marked as harvested. ${MAP_NOTE}`,
    source: "NVIDIA's RTX Blackwell architecture whitepaper and published GB202 die analysis",
  };
}
