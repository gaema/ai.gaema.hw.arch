// Intel Arc Pro B50 -- Xe2 "Battlemage", BMG-G21.
// Every figure here is from Intel's own B50 data sheet or another published
// source, except the L2 capacity, which Intel does not publish and which is
// labelled where it appears.

import { sliceList, dieMap } from "./_battlemage.js";

const SHAPE = {
  sku: "B50",
  slices: 5,          // BMG-G21 is a 5-slice, 20-Xe-core die
  slicesPerRow: 1,
  xeCores: 20,        // on the die; 16 are enabled on this SKU
  rtUnits: 16,
  xmxOnDie: 128,      // 16 enabled Xe-cores × 8
  peakTops: "170 TOPS INT8",
  dram: "GDDR6",
  mem: "16 GB",
  bus: "128-bit",
  busBits: 128,
  bw: "224 GB/s",
  memSpeed: "14 Gbps",
  memBlocksPerBand: 2,
  shareOfBw: "56 GB/s",
};

export default {
  id: "b50",
  name: "Arc Pro B50",
  vendor: "Intel",
  vendorKey: "intel",
  arch: "Xe2 (Battlemage)",
  die: "BMG-G21",
  tagline:
    "The small half of the Battlemage professional line: 16 Xe-cores and 16 GB of GDDR6 inside 70 W, on a half-height card with no power connector at all — the same Xe-core as the B70, at half the width.",

  spec: {
    "Architecture": "Xe2 “Battlemage”",
    "Die": "BMG-G21",
    "Process node": "TSMC N5",
    "Transistors": "19.6 B",
    "Die area": "272 mm²",
    "Execution unit": "Xe-core",
    "Units enabled": "16 of 20 on the die",
    "Matrix engines": "128 XMX engines (8 per Xe-core)",
    "On-chip memory": "16 MiB L2 — Intel publishes no figure; this is what the device reports",
    "Memory": "16 GB GDDR6",
    "Memory bus": "128-bit",
    "Memory bandwidth": "224 GB/s",
    "Board power": "70 W — no power connector required",
    "Cooling": "Active — single blower, dual slot, half height and half length",
    "Host interface": "PCIe 5.0 ×16 mechanical, ×8 electrical",
    "Scale-out link": "None — PCIe only",
  },

  extra: [
    ["Render slices", "5 on the die"],
    ["Base clock", "1,700 MHz"],
    ["Vector engines", "128 (8 per Xe-core)"],
    ["Ray tracing units", "16"],
    ["Max dynamic frequency", "2,600 MHz"],
    ["FP32", "10.65 TFLOPS"],
    ["INT8", "170 TOPS"],
    ["Media", "AV1, HEVC, H.264, VP9 — full encode and decode"],
    ["Outputs", "4 × mini-DisplayPort 2.1"],
    ["Dimensions", "168 × 69 mm, dual slot"],
  ],

  compare: {
    "Execution unit": "Xe-core",
    "Units on die": "16 Xe-cores enabled (20 on the die) / 5 render slices",
    "SIMD width": "8 × 512-bit vector engines, SIMD16 native",
    "Matrix engine": "XMX, 8 per Xe-core",
    "Matrix engines total": "128",
    "Last-level cache": "16 MiB L2 (device-reported)",
    "Memory": "16 GB GDDR6",
    "Bandwidth": "224 GB/s",
    "Board power": "70 W",
    "Host link": "PCIe 5.0 ×8",
  },

  dieMap: dieMap({
    ...SHAPE,
    disabledIndices: [16, 17, 18, 19],
    disabledDetail:
      "One of the four Xe-cores disabled on the B50 — the die carries 20 and this SKU enables 16. Intel publishes neither WHICH four are cut nor whether they are grouped, and the B570 (18 of the same 20) shows the harvest is done per-Xe-core rather than per-render-slice. These four are drawn together only so the count is legible; their position is not a claim.",
    l2Sub: "16 MiB shared across all render slices",
    l2Detail:
      "16 MiB of shared last level, banked into slices tied to the memory controllers rather than the single block drawn here. Intel publishes no L2 capacity for BMG-G21 in the B50's data sheet, so this is the figure the device reports through the driver — see the note under the map.",
    l2Specs: [["Capacity", "16 MiB"], ["Source", "device-reported, not published by Intel"],
              ["Physically", "banked with the memory controllers"]],
    frontEnd: () => [
      { w: 3, kind: "io", label: "PCIe 5.0 ×8", path: "pcie",
        detail: "The host link. The connector is a mechanical ×16 but only eight lanes are wired, so about 31 GB/s each way — a seventh of the 224 GB/s the card reaches its own GDDR6 at, and half the host bandwidth of the ×16 parts on this site." },
      { w: 3, kind: "sched", label: "Command streamer", sub: "global thread dispatch", path: "cs",
        detail: "The global front end. It consumes the command buffers the driver builds and dispatches thread groups down to the four render slices, where each Xe-core's own thread dispatcher takes over." },
      { w: 2, kind: "fixed", label: "Display + Media", path: "media",
        detail: "The display engine driving four mini-DisplayPort 2.1 outputs, alongside the fixed-function media block — AV1, HEVC, H.264 and VP9, full encode and decode. Neither participates in inference." },
    ],
    mapNote:
      "The B50 enables 16 of BMG-G21's 20 Xe-cores, so four are drawn disabled — but their POSITION is not published, and the B570's 18-of-20 shows Intel harvests per-Xe-core, so do not read the grouping here as a whole-slice cut. The count is real; the placement is for legibility. The 16 MiB L2 is the one figure on this page Intel does not publish; it is read from the device.",
  }),

  root: {
    id: "card", label: "Arc Pro B50", kind: "compute",
    note: "one BMG-G21 die on a half-height, half-length card that draws 70 W entirely from the slot — no power connector. 16 Xe-cores and 16 GB of GDDR6, aimed at workstations and small-form-factor machines where the constraint is the chassis and the power budget rather than the die",
    cols: 4,
    children: [
      ...sliceList(SHAPE),
      {
        id: "l2", label: "L2 cache — 16 MiB", kind: "cache", span: 2,
        specs: [["Capacity", "16 MiB"], ["vs BMG-G31 (B70)", "24 MiB"],
                ["Source", "device-reported — Intel publishes none"]],
        note: "16 MiB shared across every render slice and banked with the memory controllers. Intel publishes no L2 figure for BMG-G21, so this is the capacity the device itself reports through the driver. It matters more here than on the B70: with only 224 GB/s behind it, a working set that spills L2 falls a long way, and the B70's extra 8 MiB is one of the two things — with bandwidth — that separates the parts at the same clock",
      },
      {
        id: "gddr", label: "GDDR6 memory controllers", kind: "memory", span: 2,
        specs: [["Capacity", "16 GB"], ["Bus", "128-bit"], ["Bandwidth", "224 GB/s"]],
        note: "the controllers driving the card's 16 GB of GDDR6 across a 128-bit bus, for 224 GB/s. This is the ceiling that decides what this card is good at: it holds a large model comfortably for its price, but in a memory-bound decode every weight crosses this bus once per token, so it generates at roughly a third the rate of the 608 GB/s B70 on the same weights",
      },
      { id: "cs", label: "Command streamer", kind: "sched",
        note: "the die-wide front end. It reads the command buffers the driver builds and dispatches thread groups out to the four render slices, where each Xe-core's own thread dispatcher places them on its vector engines. Every kernel launch enters the GPU through this block" },
      { id: "pcie", label: "PCIe 5.0 ×8", kind: "io",
        note: "the host link, and the clearest sign of where this card sits: a mechanical ×16 connector with eight lanes wired, so about 31 GB/s each way instead of 63. Loading weights takes twice as long as on a ×16 card, and any workload that streams from host memory is bounded by half as much",
        specs: [["Lanes", "8 electrical (×16 mechanical)"], ["Generation", "PCIe 5.0"], ["Bandwidth", "~31 GB/s per direction"]] },
      { id: "media", label: "Media engine", kind: "fixed",
        note: "full fixed-function encode and decode for AV1, HEVC, H.264 and VP9, independent of the Xe-cores. On a card this size it is a large part of the value: media pipelines run at full rate while the compute side is busy or idle" },
      { id: "display", label: "Display engine", kind: "io",
        note: "scanout to four mini-DisplayPort 2.1 outputs — up to two 8K displays at 60 Hz, or four 4K. Idle on a card doing only inference, but the reason this part ships in workstations" },
    ],
  },

  sources: [
    ["Intel — Arc Pro B50 GPU data sheet (PDF)", "https://download.intel.com/newsroom/2025/client-computing/Intel-Arc-Pro-B50-Data-Sheet.pdf"],
    ["Intel — Arc Pro B50 product specifications", "https://www.intel.com/content/www/us/en/products/sku/242615/intel-arc-pro-b50-graphics/specifications.html"],
    ["StorageReview — Arc Pro B50 review", "https://www.storagereview.com/review/intel-arc-pro-b50-gpu-review-an-affordable-low-power-workstation-gpu"],
    ["Puget Systems — Arc Pro B50 review", "https://www.pugetsystems.com/labs/articles/intel-arc-pro-b50-review/"],
    ["Chips and Cheese — Intel's Battlemage architecture", "https://chipsandcheese.com/p/intels-battlemage-architecture"],
  ],
};
