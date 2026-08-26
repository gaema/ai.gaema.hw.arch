// Intel Arc Pro B70 -- Xe2 "Battlemage".
// Every figure here is from a published vendor or press source; see `sources`.

import { band, field, memBand, MAP_NOTE } from "./_floorplan.js";

const xeCore = {
  id: "xe-core", label: "Xe-core", kind: "compute", count: "32 on the die",
  note: "Intel's equivalent of an SM or a compute unit, and the block a thread group is scheduled onto: eight vector engines, eight XMX matrix engines, a ray tracing unit, and 256 KB of L1 and shared local memory they all sit behind. 32 of them make this die. Everything above is replication of this block; everything below is inside it",
  specs: [
    ["Xe-cores on die", "32"],
    ["Vector engines", "8 × 512-bit"],
    ["XMX engines", "8 × 2048-bit"],
    ["Shared L1 / SLM", "256 KB"],
  ],
  cols: 4,
  children: [
    {
      id: "ve", label: "Vector Engine ×8", kind: "compute", span: 2,
      note: "the general-purpose SIMD ALUs — where ordinary shader and kernel arithmetic runs, everything that is not a matrix multiply. 512 bits wide and SIMD16-native in Xe2 (Alchemist was SIMD8), executing both SIMD16 and SIMD32 operations. Eight per Xe-core, and the reason a kernel with elementwise work between its matrix ops is not stalled waiting on XMX",
      specs: [
        ["Per Xe-core", "8"],
        ["Width", "512-bit"],
        ["Native ALU", "SIMD16"],
        ["Issue modes", "SIMD16, SIMD32"],
      ],
    },
    {
      id: "xmx", label: "XMX Engine ×8", kind: "matrix", span: 2,
      note: "Xe Matrix eXtensions: a systolic array that takes a whole small matrix multiply-accumulate as one instruction rather than as a loop of vector FMAs. This is where a transformer's dense layers, attention projections and convolutions actually execute, and where the card's INT8 and FP16 headline throughput comes from — the vector engines beside it are an order of magnitude slower at the same work. Eight per Xe-core, 256 on the die",
      specs: [
        ["Per Xe-core", "8"],
        ["On the die", "256"],
        ["Width", "2048-bit"],
        ["Card peak", "367 TOPS INT8"],
      ],
    },
    {
      id: "slm", label: "Shared L1 cache / SLM", kind: "cache", span: 2,
      specs: [["Capacity", "256 KB per Xe-core"]],
      note: "one 256 KB pool serving both the L1 and the shared-local-memory role — bigger than the 192 KB of Alchemist and of Lunar Lake's Xe2-LPG, which is the figure this is easily confused with",
    },
    { id: "ls", label: "Load / store", kind: "io",
      note: "the Xe-core's path to memory: it resolves addresses for the vector engines and moves data between them and the 256 KB L1/SLM block, coalescing lanes into as few transactions as it can. Scattered access patterns cost here before they ever reach L2" },
    { id: "thread", label: "Thread dispatch", kind: "sched",
      note: "hands threads to the eight vector engines and tracks the ones in flight. It is fed by the global command streamer at die level, so this is the local half of a two-level dispatch scheme" },
  ],
};

const renderSlice = {
  id: "slice", label: "Render Slice", kind: "compute", count: "8 on the die",
  note: "the level Intel scales the product line by: four Xe-cores, four ray tracing units, and the geometry and rasterization front end that makes it a RENDER slice rather than just a group of cores. Eight slices make the B70; a smaller part in this family is fewer slices of the same design, not a different one",
  specs: [["Xe-cores", "4"], ["Ray tracing units", "4"]],
  cols: 4,
  children: [
    { ...xeCore, id: "xc0", label: "Xe-core 0", count: null },
    { ...xeCore, id: "xc1", label: "Xe-core 1", count: null },
    { ...xeCore, id: "xc2", label: "Xe-core 2", count: null },
    { ...xeCore, id: "xc3", label: "Xe-core 3", count: null },
    { id: "rtu", label: "Ray Tracing Unit ×4", kind: "fixed", span: 2,
      note: "hardware BVH traversal and intersection, one per Xe-core. Xe2 runs THREE traversal pipelines per unit against Alchemist's two — 6 box tests each, 18 box intersections per clock — plus two triangle tests per clock at the bottom of the tree",
      specs: [["Per render slice", "4"], ["Traversal pipelines", "3 per unit"], ["Box tests", "18 per clock"], ["Triangle tests", "2 per clock"]] },
    { id: "geo", label: "Geometry + rasterizer", kind: "fixed", span: 2,
      note: "the render slice's fixed-function graphics front end — geometry setup and rasterization. One per slice, which is what makes it a RENDER slice rather than just a group of Xe-cores" },
  ],
};

const slices = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({
  ...renderSlice, id: "slice" + i, label: "Render Slice " + i, count: null,
}));

export default {
  id: "b70",
  name: "Arc Pro B70",
  vendor: "Intel",
  vendorKey: "intel",
  arch: "Xe2 (Battlemage)",
  die: "BMG-G31",
  tagline:
    "The largest discrete Xe2 part: 32 Xe-cores, 256 XMX engines and 32 GB of GDDR6, at 367 INT8 TOPS.",

  headline: [
    ["Architecture", "Xe2 “Battlemage”"],
    ["Xe-cores", "32"],
    ["Render slices", "8"],
    ["Vector engines", "256 (8 per Xe-core)"],
    ["XMX engines", "256 (8 per Xe-core)"],
    ["Ray tracing units", "32"],
    ["Graphics clock", "2,280 MHz"],
    ["Max dynamic frequency", "2,800 MHz"],
    ["FP32", "22.9 TFLOPS"],
    ["INT8", "367 TOPS"],
    ["Memory", "32 GB GDDR6"],
    ["Memory bus", "256-bit"],
    ["Memory bandwidth", "608 GB/s"],
    ["Board power", "230 W reference (160–290 W partner)"],
    ["Host interface", "PCIe 5.0 ×16"],
    ["Launch price", "$949"],
  ],

  compare: {
    "Execution unit": "Xe-core",
    "Units on die": "32 Xe-cores / 8 render slices",
    "SIMD width": "8 × 512-bit vector engines, SIMD16 native",
    "Matrix engine": "XMX, 8 per Xe-core",
    "Matrix engines total": "256",
    "Last-level cache": "L2 (capacity not published)",
    "Memory": "32 GB GDDR6",
    "Bandwidth": "608 GB/s",
    "Board power": "230 W reference",
    "Host link": "PCIe 5.0 ×16",
  },

  dieMap: {
    title: "Die map — Xe2 (Battlemage)",
    cols: 16, rows: 11, cell: 58, cellH: 42,
    lede: "All 32 Xe-cores, grouped four to a render slice. Each Xe-core carries 8 vector engines and 8 XMX engines, so the two rows of sixteen below are where all 256 XMX engines live.",
    hint: "Hover a block for detail. Every Xe-core opens at its own place in the hierarchy below.",
    dataflow: {
      label: "Trace a read",
      title: "One read: Xe-core → Xe fabric → L2 → GDDR6",
      kind: "stops",
      stops: [[6, 5], [6, 3], [6, 2], [6, 1]],
      note: "An Xe-core that misses in its own 256 KB of L1/SLM crosses the fabric to L2, and a miss there goes to a memory controller. Three stops, and one of them is the level Intel does not publish a size for — which is why this page states the path but not what fraction of it ends at L2.",
    },
    interconnect: "Drawn as the two Xe fabric bands the compute field sits between. Intel publishes the render-slice grouping but not the fabric's topology for this part, so it is a labelled band rather than a shape — the claim is only that every Xe-core reaches L2 and memory through it.",
    tiles: [
      ...band(0, [
        { w: 5, kind: "io", label: "PCIe 5.0 ×16", path: "pcie",
          detail: "The host link: 16 lanes of PCIe 5.0, about 63 GB/s each way — roughly a tenth of the 608 GB/s the card reaches its own GDDR6 at. Model weights cross here once at load; anything that has to keep crossing it during inference is in a fundamentally slower regime." },
        { w: 6, kind: "sched", label: "Command streamer", sub: "global thread dispatch", path: "cs",
          detail: "The global front end. It consumes the command buffers the driver builds and dispatches thread groups down to the render slices, where each Xe-core's own thread dispatcher takes over — a two-level scheme, this being the die-wide half." },
        { w: 5, kind: "fixed", label: "Display + Media", path: "media",
          detail: "The display engine, which scans finished framebuffers out to the physical outputs, alongside the fixed-function media block that encodes and decodes video without using the Xe-cores. Neither participates in inference." },
      ]),
      ...memBand(1, 4, 16, "GDDR6", () => `1/8 of the bus`,
        "One eighth of the 256-bit GDDR6 interface — 608 GB/s from 256 bits × 19 Gbps. Intel does not publish how that bus is divided into controllers for this die, so the eight blocks are a drawing convenience, NOT a controller count.",
        [["This block", "1 of 8 drawn — not a controller count"], ["Its share of bandwidth", "76 GB/s"],
         ["Whole memory subsystem", "256-bit, 608 GB/s"], ["DRAM on the board", "32 GB GDDR6"]]),
      ...band(2, [{ w: 16, kind: "cache", label: "L2 cache", sub: "shared across all render slices · banked", path: "l2",
        detail: "Shared last level on the die, banked into slices tied to the memory controllers rather than the single block drawn here. Intel does not publish the capacity for this SKU, so none is claimed.",
        specs: [["Capacity", "not published"], ["Physically", "banked with the memory controllers"]] }]),
      ...band(3, [{ w: 16, kind: "link", label: "Xe fabric", sub: "Xe-cores ⇄ L2 ⇄ memory controllers",
        detail: "The on-die interconnect between the render slices and the memory side. Every Xe-core reaches L2 and the memory controllers across it; Intel does not publish its topology for this part, so it is drawn as a band rather than given a shape it may not have.",
        specs: [["Reaches", "all 32 Xe-cores"], ["Topology", "not published"]] }]),
      ...field({
        y0: 4, perRow: 8, rows: 4, w: 2,
        make: (i, c, r) => {
          const slice = r * 2 + (c < 4 ? 0 : 1);
          const within = c % 4;
          return {
            kind: "compute", label: "Xe-core", sub: `slice ${slice} · ${within}`,
            path: `slice${slice}/xc${within}`,
            detail: `Xe-core ${within} of render slice ${slice}. 8 vector engines at 512-bit with SIMD16-native ALUs, 8 XMX engines at 2048-bit, and 256 KB of shared L1/SLM.`,
            specs: [["Vector engines", "8 × 512-bit"], ["XMX engines", "8 × 2048-bit"], ["Shared L1 / SLM", "256 KB"]],
          };
        },
      }),
      ...band(8, [{ w: 16, kind: "link", label: "Xe fabric", sub: "the same fabric, reaching the other memory edge",
        detail: "The compute field is drawn between two runs of the same fabric because it reaches both memory edges — the two bands are one interconnect, not two.",
        specs: [["Reaches", "all 32 Xe-cores"], ["Topology", "not published"]] }]),
      ...memBand(9, 4, 16, "GDDR6", () => `1/8 of the bus`,
        "One eighth of the 256-bit GDDR6 interface — 608 GB/s from 256 bits × 19 Gbps. Intel does not publish how that bus is divided into controllers for this die, so the eight blocks are a drawing convenience, NOT a controller count.",
        [["This block", "1 of 8 drawn — not a controller count"], ["Its share of bandwidth", "76 GB/s"],
         ["Whole memory subsystem", "256-bit, 608 GB/s"], ["DRAM on the board", "32 GB GDDR6"]]),
      ...band(10, [{ w: 16, kind: "fixed", label: "Geometry + rasterizers · 32 ray tracing units", sub: "4 per render slice",
        detail: "The fixed-function front end of each render slice, plus its four ray tracing units — 32 across the die." }]),
    ],
    note: "Nothing here is drawn as disabled: the B70 is the full 32 Xe-core configuration of the die — the cut-down part in this family is the B65 — so there is no harvest to mark, unlike the Blackwell and Blackhole pages. " + MAP_NOTE,
    source: "Intel's Xe2 architecture material and the Arc Pro B70 product specifications",
  },

  root: {
    id: "card", label: "Arc Pro B70", kind: "compute",
    note: "one Xe2 Battlemage die on a PCIe 5.0 ×16 card — the full 32 Xe-core configuration, with 32 GB of GDDR6 and 256 XMX matrix engines. The professional part of the Battlemage line: more memory than the consumer boards, aimed at inference and workstation work",
    cols: 4,
    children: [
      ...slices,
      {
        id: "l2", label: "L2 cache", kind: "cache", span: 2,
        note: "the die's shared last level, sitting between the Xe-cores' own 256 KB L1/SLM blocks and the memory controllers, and banked into slices tied to those controllers rather than being one central block. Anything that misses here goes to GDDR6 at 608 GB/s, so what fits in L2 sets how close a bandwidth-bound kernel gets to peak. Intel does not publish the capacity for this SKU, so none is claimed here",
      },
      {
        id: "gddr", label: "GDDR6 memory controllers", kind: "memory", span: 2,
        specs: [["Capacity", "32 GB"], ["Bus", "256-bit"], ["Bandwidth", "608 GB/s"]],
        note: "the controllers driving the card's 32 GB of GDDR6 — 256 bits at 19 Gbps, so 608 GB/s. This is the number that bounds token generation: in a memory-bound decode every weight is read once per token, so the model's size divided by this rate is the floor on time per token no amount of compute can undercut. Intel does not publish how the bus is split into controllers for this die",
      },
      { id: "cs", label: "Command streamer", kind: "sched",
        note: "the die-wide front end. It reads the command buffers the driver builds and dispatches thread groups out to the render slices, where each Xe-core's own thread dispatcher places them on its vector engines. Every kernel launch enters the GPU through this block" },
      { id: "pcie", label: "PCIe 5.0 ×16", kind: "io",
        note: "the host link. 16 lanes of PCIe 5.0, about 63 GB/s each way — roughly a tenth of this card's own 608 GB/s",
        specs: [["Lanes", "16"], ["Generation", "PCIe 5.0"], ["Bandwidth", "~63 GB/s per direction"]] },
      { id: "media", label: "Media engine", kind: "fixed",
        note: "fixed-function video encode and decode, independent of the Xe-cores, so a transcode runs at full rate without spending any compute. Intel's media blocks are the strongest part of these cards outside of graphics, and are entirely unused by inference" },
      { id: "display", label: "Display engine", kind: "io",
        note: "scanout — drives the physical outputs from finished framebuffers. Idle on a card doing only inference" },
    ],
  },

  sources: [
    ["Intel — Arc Pro B70 product specifications", "https://www.intel.com/content/www/us/en/products/sku/245797/intel-arc-pro-b70-graphics/specifications.html"],
    ["TechPowerUp — Intel announces Arc Pro B70 and B65", "https://www.techpowerup.com/347703/intel-announces-arc-pro-b70-and-arc-pro-b65-gpus-maxes-out-xe2-battlemage-architecture"],
    ["Tom's Hardware — Arc Pro B70 and B65 bring 32 GB to AI and pro apps", "https://www.tomshardware.com/pc-components/gpus/intel-arc-pro-b70-and-arc-pro-b65-gpus-bring-32gb-of-ram-to-ai-and-pro-apps-bigger-battlemage-finally-arrives-but-its-not-for-gaming"],
    ["Chips and Cheese — Intel's Battlemage architecture", "https://chipsandcheese.com/p/intels-battlemage-architecture"],
  ],
};
