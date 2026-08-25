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
