// Intel Arc Pro B70 -- Xe2 "Battlemage", BMG-G31.
// Every figure here is from a published vendor or press source, except the L2
// capacity, which Intel does not publish and which is labelled where it appears.

import { sliceList, dieMap } from "./_battlemage.js";

const SHAPE = {
  sku: "B70",
  slices: 8,
  slicesPerRow: 2,
  xeCores: 32,
  rtUnits: 32,
  xmxOnDie: 256,
  peakTops: "367 TOPS INT8",
  dram: "GDDR6",
  mem: "32 GB",
  bus: "256-bit",
  busBits: 256,
  bw: "608 GB/s",
  memSpeed: "19 Gbps",
  memBlocksPerBand: 4,
  shareOfBw: "76 GB/s",
};

const L2_NOTE =
  "24 MiB, shared across every render slice and banked with the memory controllers. Intel publishes no L2 figure for BMG-G31 — not in the product specifications and not in any review teardown — so this is the capacity the device itself reports through the driver, which is the only way to obtain it";

export default {
  id: "b70",
  name: "Arc Pro B70",
  vendor: "Intel",
  vendorKey: "intel",
  arch: "Xe2 (Battlemage)",
  die: "BMG-G31",
  tagline:
    "The largest discrete Xe2 part: 32 Xe-cores, 256 XMX engines and 32 GB of GDDR6, at 367 INT8 TOPS.",

  spec: {
    "Architecture": "Xe2 “Battlemage”",
    "Die": "BMG-G31",
    "Process node": "TSMC N5",
    "Transistors": "27.7 B",
    "Die area": "368 mm²",
    "Execution unit": "Xe-core",
    "Units enabled": "32 of 32 — full die",
    "Matrix engines": "256 XMX engines (8 per Xe-core)",
    "On-chip memory": "24 MiB L2 — Intel publishes no figure; this is what the device reports",
    "Memory": "32 GB GDDR6",
    "Memory bus": "256-bit",
    "Memory bandwidth": "608 GB/s",
    "Board power": "230 W reference (160–290 W partner)",
    "Cooling": "Active or passive — partner designs vary (ASRock and Sparkle both ship fanless 32 GB models)",
    "Host interface": "PCIe 5.0 ×16",
    "Scale-out link": "None — PCIe only",
  },

  extra: [
    ["Render slices", "8"],
    ["Vector engines", "256 (8 per Xe-core)"],
    ["Ray tracing units", "32"],
    ["Graphics clock", "2,280 MHz"],
    ["Max dynamic frequency", "2,800 MHz"],
    ["Memory speed", "19 Gbps"],
    ["FP32", "22.9 TFLOPS"],
    ["INT8", "367 TOPS"],
    ["Launch price", "$949"],
  ],

  compare: {
    "Execution unit": "Xe-core",
    "Units on die": "32 Xe-cores / 8 render slices",
    "SIMD width": "8 × 512-bit vector engines, SIMD16 native",
    "Matrix engine": "XMX, 8 per Xe-core",
    "Matrix engines total": "256",
    "Last-level cache": "24 MiB L2 (device-reported)",
    "Memory": "32 GB GDDR6",
    "Bandwidth": "608 GB/s",
    "Board power": "230 W reference",
    "Host link": "PCIe 5.0 ×16",
  },

  dieMap: dieMap({
    ...SHAPE,
    l2Sub: "24 MiB shared across all render slices",
    l2Detail:
      "24 MiB of shared last level, banked into slices tied to the memory controllers rather than the single block drawn here. Intel publishes no L2 capacity for BMG-G31, so this is the figure the device reports through the driver — see the note under the map.",
    l2Specs: [["Capacity", "24 MiB"], ["Source", "device-reported, not published by Intel"],
              ["Physically", "banked with the memory controllers"]],
    frontEnd: () => [
      { w: 5, kind: "io", label: "PCIe 5.0 ×16", path: "pcie",
        detail: "The host link: 16 lanes of PCIe 5.0, about 63 GB/s each way — roughly a tenth of the 608 GB/s the card reaches its own GDDR6 at. Model weights cross here once at load; anything that has to keep crossing it during inference is in a fundamentally slower regime." },
      { w: 6, kind: "sched", label: "Command streamer", sub: "global thread dispatch", path: "cs",
        detail: "The global front end. It consumes the command buffers the driver builds and dispatches thread groups down to the render slices, where each Xe-core's own thread dispatcher takes over — a two-level scheme, this being the die-wide half." },
      { w: 5, kind: "fixed", label: "Display + Media", path: "media",
        detail: "The display engine, which scans finished framebuffers out to the physical outputs, alongside the fixed-function media block that encodes and decodes video without using the Xe-cores. Neither participates in inference." },
    ],
    mapNote:
      "Nothing here is drawn as disabled: the B70 is the full 32 Xe-core configuration of the die — the cut-down part in this family is the B65 — so there is no harvest to mark, unlike the Blackwell and Blackhole pages. The 24 MiB L2 is the one figure on this page Intel does not publish; it is read from the device, and is the same class of exception as the p300c's die-to-die channel numbers.",
  }),

  root: {
    id: "card", label: "Arc Pro B70", kind: "compute",
    note: "one Xe2 Battlemage die on a PCIe 5.0 ×16 card — the full 32 Xe-core configuration, with 32 GB of GDDR6 and 256 XMX matrix engines. The professional part of the Battlemage line: more memory than the consumer boards, aimed at inference and workstation work",
    cols: 4,
    children: [
      ...sliceList(SHAPE),
      {
        id: "l2", label: "L2 cache — 24 MiB", kind: "cache", span: 2,
        specs: [["Capacity", "24 MiB"], ["vs BMG-G21 (B50)", "18 MiB"],
                ["Source", "device-reported — Intel publishes none"]],
        note: L2_NOTE + ". Anything that misses here goes to GDDR6 at 608 GB/s, so what fits in L2 sets how close a bandwidth-bound kernel gets to peak — and the 33% more of it than the B50 carries (24 MiB against 18) is one of the two things, with bandwidth, that separates the two parts at the same clock",
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
    ["VideoCardz — BMG-G31 said to feature 27.7 B transistors", "https://videocardz.com/newz/intel-big-battlemage-bmg-g31-said-to-feature-27-7b-transistors-48-fewer-than-amd-navi-48"],
    ["igor'sLAB — Arc Pro B70 review: teardown, topology, material tests", "https://www.igorslab.de/en/intel-arc-pro-b70-review-teardown-topology-material-tests-workstation-ai-benchmarks/"],
  ],
};
