// Intel Arc Pro B70 -- Xe2 "Battlemage".
// Every figure here is from a published vendor or press source; see `sources`.

import { band, field, memBand, MAP_NOTE } from "./_floorplan.js";

const xeCore = {
  id: "xe-core", label: "Xe-core", kind: "compute", count: "32 on the die",
  note: "8 vector engines + 8 XMX engines behind 192 KB of shared L1/SLM",
  specs: [
    ["Xe-cores on die", "32"],
    ["Vector engines", "8 × 512-bit"],
    ["XMX engines", "8 × 2048-bit"],
    ["Shared L1 / SLM", "192 KB"],
  ],
  cols: 4,
  children: [
    {
      id: "ve", label: "Vector Engine ×8", kind: "compute", span: 2,
      note: "512-bit, SIMD16-native ALUs (SIMD16 and SIMD32 ops)",
      specs: [
        ["Per Xe-core", "8"],
        ["Width", "512-bit"],
        ["Native ALU", "SIMD16"],
        ["Issue modes", "SIMD16, SIMD32"],
      ],
    },
    {
      id: "xmx", label: "XMX Engine ×8", kind: "matrix", span: 2,
      note: "Xe Matrix eXtensions — the systolic array that carries INT8/FP16 matrix work",
      specs: [
        ["Per Xe-core", "8"],
        ["On the die", "256"],
        ["Width", "2048-bit"],
        ["Card peak", "367 TOPS INT8"],
      ],
    },
    {
      id: "slm", label: "Shared L1 cache / SLM", kind: "cache", span: 2,
      specs: [["Capacity", "192 KB per Xe-core"]],
      note: "one 192 KB pool serving both the L1 and the shared-local-memory role",
    },
    { id: "ls", label: "Load / store", kind: "io" },
    { id: "thread", label: "Thread dispatch", kind: "sched" },
  ],
};

const renderSlice = {
  id: "slice", label: "Render Slice", kind: "compute", count: "8 on the die",
  note: "4 Xe-cores + 4 ray tracing units",
  specs: [["Xe-cores", "4"], ["Ray tracing units", "4"]],
  cols: 4,
  children: [
    { ...xeCore, id: "xc0", label: "Xe-core 0", count: null },
    { ...xeCore, id: "xc1", label: "Xe-core 1", count: null },
    { ...xeCore, id: "xc2", label: "Xe-core 2", count: null },
    { ...xeCore, id: "xc3", label: "Xe-core 3", count: null },
    { id: "rtu", label: "Ray Tracing Unit ×4", kind: "fixed", span: 2 },
    { id: "geo", label: "Geometry + rasterizer", kind: "fixed", span: 2 },
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
    ["Graphics clock", "2,800 MHz"],
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
    interconnect: "Drawn as the two Xe fabric bands the compute field sits between. Intel publishes the render-slice grouping but not the fabric's topology for this part, so it is a labelled band rather than a shape — the claim is only that every Xe-core reaches L2 and memory through it.",
    tiles: [
      ...band(0, [
        { w: 5, kind: "io", label: "PCIe 5.0 ×16", path: "pcie",
          detail: "Host interface. PCIe 5.0 ×16." },
        { w: 6, kind: "sched", label: "Command streamer", sub: "global thread dispatch", path: "cs",
          detail: "Takes work from the host and dispatches threads across the render slices." },
        { w: 5, kind: "fixed", label: "Display + Media", path: "media",
          detail: "Display engine and the media block — video encode and decode." },
      ]),
      ...memBand(1, 4, 16, "GDDR6", (i) => `32-bit ctrl ${i}`,
        "One of the eight 32-bit controllers that make the 256-bit GDDR6 interface: 32 GB at 608 GB/s (256 bits × 19 Gbps). Four are drawn on each edge.",
        [["Controllers", "8 × 32-bit"], ["Capacity", "32 GB"], ["Bus", "256-bit"], ["Bandwidth", "608 GB/s"]]),
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
            detail: `Xe-core ${within} of render slice ${slice}. 8 vector engines at 512-bit with SIMD16-native ALUs, 8 XMX engines at 2048-bit, and 192 KB of shared L1/SLM.`,
            specs: [["Vector engines", "8 × 512-bit"], ["XMX engines", "8 × 2048-bit"], ["Shared L1 / SLM", "192 KB"]],
          };
        },
      }),
      ...band(8, [{ w: 16, kind: "link", label: "Xe fabric", sub: "the same fabric, reaching the other memory edge",
        detail: "The compute field is drawn between two runs of the same fabric because it reaches both memory edges — the two bands are one interconnect, not two.",
        specs: [["Reaches", "all 32 Xe-cores"], ["Topology", "not published"]] }]),
      ...memBand(9, 4, 16, "GDDR6", (i) => `32-bit ctrl ${4 + i}`,
        "One of the eight 32-bit controllers that make the 256-bit GDDR6 interface: 32 GB at 608 GB/s (256 bits × 19 Gbps). Four are drawn on each edge.",
        [["Controllers", "8 × 32-bit"], ["Capacity", "32 GB"], ["Bus", "256-bit"], ["Bandwidth", "608 GB/s"]]),
      ...band(10, [{ w: 16, kind: "fixed", label: "Geometry + rasterizers · 32 ray tracing units", sub: "4 per render slice",
        detail: "The fixed-function front end of each render slice, plus its four ray tracing units — 32 across the die." }]),
    ],
    note: MAP_NOTE,
    source: "Intel's Xe2 architecture material and the Arc Pro B70 product specifications",
  },

  root: {
    id: "card", label: "Arc Pro B70", kind: "compute",
    note: "single Xe2 Battlemage die on a PCIe 5.0 ×16 card",
    cols: 4,
    children: [
      ...slices,
      {
        id: "l2", label: "L2 cache", kind: "cache", span: 2,
        note: "shared across all render slices; Intel does not publish the capacity for this SKU",
      },
      {
        id: "gddr", label: "GDDR6 memory controllers", kind: "memory", span: 2,
        specs: [["Capacity", "32 GB"], ["Bus", "256-bit"], ["Bandwidth", "608 GB/s"]],
        note: "256-bit bus, 32 GB, 608 GB/s",
      },
      { id: "cs", label: "Command streamer", kind: "sched", note: "global thread dispatch" },
      { id: "pcie", label: "PCIe 5.0 ×16", kind: "io" },
      { id: "media", label: "Media engine", kind: "fixed", note: "encode / decode" },
      { id: "display", label: "Display engine", kind: "io" },
    ],
  },

  sources: [
    ["Intel — Arc Pro B70 product specifications", "https://www.intel.com/content/www/us/en/products/sku/245797/intel-arc-pro-b70-graphics/specifications.html"],
    ["TechPowerUp — Intel announces Arc Pro B70 and B65", "https://www.techpowerup.com/347703/intel-announces-arc-pro-b70-and-arc-pro-b65-gpus-maxes-out-xe2-battlemage-architecture"],
    ["Tom's Hardware — Arc Pro B70 and B65 bring 32 GB to AI and pro apps", "https://www.tomshardware.com/pc-components/gpus/intel-arc-pro-b70-and-arc-pro-b65-gpus-bring-32gb-of-ram-to-ai-and-pro-apps-bigger-battlemage-finally-arrives-but-its-not-for-gaming"],
    ["Chips and Cheese — Intel's Battlemage architecture", "https://chipsandcheese.com/p/intels-battlemage-architecture"],
  ],
};
