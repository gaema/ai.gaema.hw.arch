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
    { id: "cuda", label: "CUDA cores ×32", kind: "compute", span: 2,
      note: "the FP32/INT32 lanes. A warp is 32 threads and a partition is 32 lanes wide, so one warp issues across the block in a single cycle — the shape of the hardware is why 32 is the scheduling unit",
      specs: [["Lanes", "32"], ["Warp width", "32 threads"], ["Blocks per SM", "4"]] },
    {
      id: "tc", label: "Tensor Core", kind: "matrix", span: 2,
      note: "the matrix unit, fifth generation. It executes a small matrix multiply-accumulate as a single instruction — a tile of A times a tile of B added into an accumulator — which is the operation every dense layer, attention projection and convolution decomposes into. One per processing block, four per SM, and essentially all of a transformer's arithmetic lands here rather than on the CUDA cores. Blackwell's addition is native FP4 alongside FP8, which is why this generation's headline numbers are quoted at precisions the previous one could not execute",
      specs: [["Per processing block", "1"], ["Per SM", "4"], ["Generation", "5th"]],
    },
    { id: "warp", label: "Warp scheduler", kind: "sched",
      note: "picks one ready warp per cycle from the slots it tracks and issues a single instruction. Latency is hidden by having other warps ready, not by reordering — there is no out-of-order execution here, so occupancy IS the latency-hiding mechanism",
      specs: [["Wave slots tracked", "12 per partition"], ["Issue rate", "1 instruction/cycle"]] },
    { id: "rf", label: "Register file", kind: "cache",
      note: "64 KB per processing block, 256 KB per SM — unchanged since Ampere. It is the budget that decides occupancy: the more registers a kernel needs per thread, the fewer warps fit, and the less latency the scheduler can hide",
      specs: [["Per processing block", "64 KB"], ["Per SM", "256 KB"], ["Shared across", "12 wave slots"]] },
    { id: "l0i", label: "L0 instruction cache", kind: "cache",
      note: "the private instruction feed for this partition, backed by a 128 KB L1 instruction cache at SM level (roughly 8K instructions). Unrolled or heavily inlined kernels can miss here, which costs issue slots even when the data path is idle" },
    { id: "lsu", label: "LD/ST + SFU", kind: "io",
      note: "load/store units address the L1 and shared memory below, and the special function units handle transcendentals — reciprocal, square root, sine, exponential — at a quarter of the FP32 lane count, so transcendental-heavy code runs at a fraction of peak",
      specs: [["SFUs", "4 per partition"], ["vs FP32 lanes", "32 — an 8:1 ratio"]] },
  ],
};

export function sm(total) {
  return {
    id: "sm", label: "Streaming Multiprocessor", kind: "compute",
    count: total ? total + " enabled on the card" : null,
    note: "the streaming multiprocessor — the unit a CUDA thread block is scheduled onto, and the block NVIDIA counts when it quotes a SKU. Four processing blocks (128 CUDA cores, 4 Tensor Cores), one RT core, and 128 KB of L1 and shared memory the four partitions divide between them. Everything above this level is replication; everything below is one partition's private machinery",
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
      { id: "l1", label: "L1 data cache / shared memory", kind: "cache", span: 2,
        note: "one 128 KB block per SM, partitioned between the hardware-managed L1 and programmer-managed shared memory. A CUDA block's shared memory is carved from here, so asking for more of it directly reduces how many blocks fit on the SM",
        specs: [["Per SM", "128 KB"], ["Split", "L1 / shared, configurable"]] },
      { id: "rt", label: "RT Core", kind: "fixed",
        note: "fourth-generation fixed-function ray tracing, one per SM. It walks the bounding-volume hierarchy and tests rays against boxes and triangles in hardware — a pointer-chasing, divergent search that maps badly onto SIMT lanes, which is why it was given dedicated silicon instead of being left to the CUDA cores. Wholly idle during inference: on an AI workload this is area and power the card spends on nothing" },
      { id: "tex", label: "Texture units ×4", kind: "fixed",
        note: "filtered, interpolated sampling with addressing modes in hardware. Idle in most compute work, but the path is still there and CUDA can reach it through texture objects" },
    ],
  };
}

export function tpc(total) {
  return {
    id: "tpc", label: "Texture Processing Cluster", kind: "compute",
    note: "a texture processing cluster: two SMs plus the PolyMorph geometry front end they share. It is the granularity NVIDIA harvests at — a die with a defect disables a whole TPC, taking two SMs with it, which is why the enabled-SM counts across this family always move in twos",
    specs: [["SMs", "2"]],
    cols: 2,
    children: [
      { ...sm(total), id: "sm0", label: "SM 0", count: null },
      { ...sm(total), id: "sm1", label: "SM 1", count: null },
      { id: "pm", label: "PolyMorph engine", kind: "fixed", span: 2,
        note: "the per-TPC geometry front end — vertex fetch, tessellation, viewport transform, attribute setup. One per TPC, so geometry throughput scales with TPC count rather than being a single fixed block" },
    ],
  };
}

export function gpc(total) {
  const t = tpc(total);
  return {
    id: "gpc", label: "Graphics Processing Cluster", kind: "compute",
    count: "12 on the full GB202 die",
    note: "a graphics processing cluster: eight TPCs — sixteen SMs — behind their own raster engine. The GPC is very nearly a small GPU in its own right, with its own front end and rasterizer, and twelve of them make GB202. It is also the coarse harvesting unit: a badly-defective die loses a whole GPC rather than scattered SMs",
    specs: [["TPCs", "8"], ["SMs", "16"]],
    cols: 4,
    children: [
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ ...t, id: "tpc" + i, label: "TPC " + i })),
      { id: "raster", label: "Raster engine", kind: "fixed", span: 4,
        note: "one per GPC: turns triangles into pixel fragments — edge setup, coarse and fine rasterization, z-cull. This is the block that makes a GPC a GRAPHICS processing cluster rather than just a bag of SMs" },
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
      id: "l2", label: `L2 cache — ${opts.l2}`, kind: "cache", span: 2,
      specs: [["Capacity", opts.l2], ["On the full die", "128 MB"]],
      note: "the last level before DRAM, shared by every GPC and cut into slices — one per memory partition — reached through the GPC⇄L2 crossbar. Any GPC can hit any slice, so the cache behaves as one pool even though it is physically distributed along both memory edges. Blackwell's L2 is large enough that keeping a working set resident here, rather than re-streaming it from GDDR7, is the single biggest lever on a bandwidth-bound kernel",
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
    { id: "gigathread", label: "GigaThread engine", kind: "sched",
      note: "the die-level scheduler. It takes launched grids from the host, breaks them into thread blocks and assigns those blocks to GPCs and SMs that have room, refilling each SM as blocks retire. It is the reason a kernel launch does not need to know how many SMs the card has — the same binary spreads across 170 SMs or 188 without recompilation — and it is also what makes occupancy matter, since it can only place a block where registers and shared memory are free" },
    { id: "pcie", label: "PCIe 5.0 ×16", kind: "io",
      note: "the host link. 16 lanes of PCIe 5.0, about 63 GB/s each way — roughly 3.5% of this card's own memory bandwidth, which is why a working set that has to stream from host memory performs nothing like one that fits in VRAM",
      specs: [["Lanes", "16"], ["Generation", "PCIe 5.0"], ["Bandwidth", "~63 GB/s per direction"]] },
    { id: "nvenc", label: "NVENC / NVDEC", kind: "fixed",
      note: "dedicated video encode (NVENC) and decode (NVDEC) blocks, entirely separate from the SMs — so a transcode runs at full rate while the shader array is busy with something else, and consumes no CUDA cores doing it. Relevant to an AI card mainly at the edges of a pipeline: decoding video frames into a vision model without paying for it in compute" },
    { id: "display", label: "Display engine", kind: "io",
      note: "scanout: reads finished framebuffers and drives the physical outputs, with its own timing and colour pipeline. Entirely idle on a card used only for compute" },
  ];
}

// The GB202 die map. One column per GPC, one cell per TPC -- 12 x 8 = 96 TPCs,
// which is the die's 192 SMs. Both cards are the same die; they differ only in
// how many SMs are enabled and in the memory hung off the edges.
export function dieMap(opts) {
  return {
    title: "Die map — GB202",
    cols: 12, rows: 14, cell: 62, cellH: 40,
    lede: `Each column below is one graphics processing cluster, each cell one texture processing cluster — an SM pair. Twelve GPCs of eight TPCs is the full GB202: 96 TPCs, 192 SMs, 24,576 CUDA cores. This card gets ${opts.activeSMs} of those SMs, so ${(192 - opts.activeSMs) / 2} TPCs are drawn dark.`,
    hint: "Hover a block for detail. Every TPC opens at its own place in the hierarchy below.",
    interconnect: "Drawn as the two crossbar bands the TPC field sits between. The L2 is sliced per memory partition, so a GPC's traffic can land in any slice — the crossbar is what makes 96 or 128 MB spread along both memory edges behave as one shared cache. No NVLink on either of these cards: off-card, the only path is PCIe 5.0 ×16.",
    // A read on a GPU has no per-tile hops to trace: it is a walk down the
    // hierarchy. The stops are the real ones -- SM, crossbar, L2 slice, memory
    // controller -- and the whole point is how few there are next to Blackhole.
    dataflow: {
      label: "Traced read",
      title: "One read: TPC → crossbar → L2 → GDDR7",
      kind: "stops",
      stops: [[5, 8], [5, 3], [5, 2], [5, 1]],
      note: "Nothing here hops tile to tile. An SM that misses in its own L1 goes out across the GPC⇄L2 crossbar to whichever L2 slice owns that address, and only on a miss there does it reach a memory controller. That is the whole path: four stops, not a route. It is the opposite of the Blackhole page, where distance is measured in NOC hops and the program chooses them — here the hierarchy decides, and the only lever a programmer has is whether the data was already in L2.",
    },
    tiles: [
      ...band(0, [
        { w: 4, kind: "io", label: "PCIe 5.0 ×16", path: "pcie",
          detail: "The host link: 16 lanes of PCIe 5.0, about 63 GB/s each way. Every byte the card does not already hold — model weights at load, activations streamed from host memory, results going back — crosses here, at roughly 3.5% of the rate the same data moves once it is in VRAM." },
        { w: 4, kind: "sched", label: "GigaThread engine", sub: "work distribution", path: "gigathread",
          detail: "The die-level scheduler. It splits a launched grid into thread blocks and places them on GPCs and SMs with free registers and shared memory, refilling each SM as blocks retire — which is how one binary spreads across whatever SM count the SKU happens to have." },
        { w: 4, kind: "fixed", label: "NVENC / NVDEC + display", path: "nvenc",
          detail: "Fixed-function video encode and decode, plus the display engine that scans finished framebuffers out to the physical outputs. All three are independent of the SMs, so video work costs no CUDA cores — and all three sit idle on a card doing only inference." },
      ]),
      ...memBand(1, 4, 12, "GDDR7", (i) => `2 × 32-bit ctrl`,
        `Two of the SIXTEEN 32-bit memory controllers that make the 512-bit GDDR7 interface. NVIDIA's whitepapers say it verbatim — "sixteen 32-bit memory controllers (512-bit total)" — so this is 16 × 32, not 8 × 64.`,
        [["This block", "2 of 16 · 32-bit each"], ["Its share of bandwidth", "224 GB/s"],
         ["Whole memory subsystem", `sixteen 32-bit controllers, 512-bit, ${opts.bw}`], ["DRAM on the board", `${opts.mem} GDDR7`]], "mem"),
      ...band(2, [{ w: 12, kind: "cache", label: `L2 cache — ${opts.l2}`, sub: "shared across every GPC · sliced per memory partition", path: "l2",
        detail: `${opts.l2} of L2, ${opts.l2Note} Blackwell's L2 is partitioned into slices attached to the memory controllers, so it is physically split along both memory edges rather than being the single central band drawn here.`,
        specs: [["Capacity", opts.l2], ["On the full die", "128 MB"], ["Physically", "sliced per memory partition"]] }]),
      ...band(3, [{ w: 12, kind: "link", label: "GPC ⇄ L2 crossbar", sub: "every GPC reaches every L2 slice",
        detail: "The crossbar between the GPCs and the L2 slices. Because the L2 is sliced per memory partition, a GPC's traffic can land in any slice, so this crossbar — not a bus — is what makes the L2 look like one shared cache to all twelve GPCs.",
        specs: [["Connects", "12 GPCs"], ["To", "the L2 slices, one per memory partition"]] }]),
      // A TPC is an SM pair, so a card short of the die's 192 SMs is short of
      // whole TPCs: 170 SMs is 11 TPCs dark, 188 is 2. The die does not expose
      // WHICH, so the count is drawn at the end of the array and each such tile
      // says the position is not the claim.
      ...field({
        y0: 4, perRow: 12, rows: 8, w: 1,
        make: (i, c, r) => {
          // The GPC and TPC totals are known, not just the SM count, and
          // they do not always agree with "N TPCs somewhere": the RTX 5090 is
          // 11 GPCs of 12, so a WHOLE GPC is dark and the rest of the deficit is
          // individual TPCs inside the surviving ones. Draw that structure.
          const darkCols = 12 - opts.gpcs;                  // whole GPCs fused off
          const darkExtra = opts.gpcs * 8 - opts.tpcs;      // stragglers inside the rest
          const colDark = c >= opts.gpcs;
          const enabledIdx = r * opts.gpcs + c;
          const extraDark = !colDark && enabledIdx >= opts.gpcs * 8 - darkExtra;
          if (colDark || extraDark) {
            return {
              kind: "off", label: "TPC", sub: colDark ? "GPC dark" : "dark",
              detail: colDark
                ? `Part of an entire graphics processing cluster fused off. This card runs ${opts.gpcs} of the die's 12 GPCs, so one whole column of 8 TPCs is dark. The column drawn dark stands for the fact that one is; its position is illustrative.`
                : `One of ${darkExtra} texture processing clusters fused off inside an otherwise-live GPC. This card runs ${opts.gpcs} GPCs and ${opts.tpcs} of 96 TPCs — ${opts.activeSMs} of 192 SMs — so beyond the whole GPCs there are ${darkExtra} single TPCs missing. Their positions are illustrative.`,
              specs: [["GPCs enabled", `${opts.gpcs} of 12`], ["TPCs enabled", `${opts.tpcs} of 96`],
                      ["SMs enabled", `${opts.activeSMs} of 192`], ["Position", "illustrative"]],
            };
          }
          return {
            kind: "compute", label: "TPC", sub: `G${c}·${r}`,
            path: `gpc${c}/tpc${r}`,
            detail: `Texture processing cluster ${r} of GPC ${c}. Two SMs — 256 CUDA cores, 8 fifth-generation Tensor Cores and 2 RT cores.`,
            specs: [["SMs", "2"], ["CUDA cores", "256"], ["Tensor Cores", "8"]],
          };
        },
      }),
      ...band(12, [{ w: 12, kind: "link", label: "GPC ⇄ L2 crossbar", sub: "the same crossbar, reaching the other memory edge",
        detail: "The TPC field is drawn between two runs of the same crossbar because the L2 slices sit on both memory edges — the two bands are one interconnect, not two.",
        specs: [["Connects", "12 GPCs"], ["To", "the L2 slices, one per memory partition"]] }]),
      ...memBand(13, 4, 12, "GDDR7", (i) => `2 × 32-bit ctrl`,
        `Two of the SIXTEEN 32-bit memory controllers that make the 512-bit GDDR7 interface. NVIDIA's whitepapers say it verbatim — "sixteen 32-bit memory controllers (512-bit total)" — so this is 16 × 32, not 8 × 64.`,
        [["This block", "2 of 16 · 32-bit each"], ["Its share of bandwidth", "224 GB/s"],
         ["Whole memory subsystem", `sixteen 32-bit controllers, 512-bit, ${opts.bw}`], ["DRAM on the board", `${opts.mem} GDDR7`]], "mem"),
    ],
    note: `The full 12-GPC die is drawn, with this card's ${(192 - opts.activeSMs) / 2} dark TPCs greyed out — ${12 - opts.gpcs} whole GPC${opts.gpcs === 12 ? "s" : ""} plus ${opts.gpcs * 8 - opts.tpcs} single TPCs. The GPC, TPC and SM totals are real, so the SHAPE of the harvest is right; the positions drawn are illustrative. ${MAP_NOTE}`,
    source: "NVIDIA's RTX Blackwell architecture whitepaper and GB202 die analysis",
  };
}
