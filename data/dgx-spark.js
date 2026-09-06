// NVIDIA DGX Spark -- the GB10 Grace Blackwell Superchip: an Arm CPU die and a
// Blackwell GPU die on one package, sharing one pool of LPDDR5X.
// Every figure here is from a published vendor or press source; see `sources`.
//
// The unusual thing about this part, and the reason it is on this site next to
// nine discrete cards, is that it has NO framebuffer of its own. Every other
// entry here budgets memory as a private pool the host copies into over PCIe;
// on GB10 the GPU's memory IS the system memory, so capacity is shared with the
// operating system and bandwidth is shared with the CPU.

import { band, field, memBand, MAP_NOTE } from "./_floorplan.js";
import { sm } from "./_blackwell.js";

const SM_COUNT = 48;

export default {
  id: "dgx-spark",
  name: "DGX Spark",
  vendor: "NVIDIA",
  vendorKey: "nvidia",
  arch: "Grace Blackwell",
  die: "GB10",
  tagline:
    "Two 3 nm dies on one package — twenty Arm cores and a 48-SM Blackwell GPU — reading the same 128 GB of LPDDR5X. There is no framebuffer here: the GPU's memory is the system memory.",

  spec: {
    "Architecture": "NVIDIA Grace Blackwell",
    "Die": "GB10 Superchip — an Arm CPU die and a Blackwell GPU die on one package",
    "Process node": "TSMC 3 nm — both dies",
    "Transistors": "—",
    "Die area": "—",
    "Execution unit": "Streaming Multiprocessor (SM)",
    "Units enabled": "48 SMs — the die's full count is not published",
    "Matrix engines": "192 Tensor Cores (5th gen, 4 per SM)",
    "On-chip memory": "24 MB GPU L2 · 32 MB CPU L3 (16 MB per 10-core cluster)",
    "Memory": "128 GB LPDDR5X — coherent unified system memory, shared with the CPU",
    "Memory bus": "256-bit",
    "Memory bandwidth": "273 GB/s",
    "Board power": "140 W SoC TDP — 240 W system power supply",
    "Cooling": "Active — integrated in a 150 × 150 × 50.5 mm desktop chassis",
    "Host interface": "None — the CPU is on the package, over NVLink-C2C",
    "Scale-out link": "ConnectX-7 NIC at 200 Gb/s, on PCIe 5.0 ×8 from the SoC",
  },

  extra: [
    ["CUDA cores", "6,144"],
    ["CPU", "20 Arm v9.2 cores — 10 Cortex-X925 + 10 Cortex-A725"],
    ["CPU clusters", "2 × 10 cores, 16 MB L3 each"],
    ["Die-to-die link", "NVLink-C2C"],
    ["FP4 (NVFP4)", "Up to 1 PFLOP"],
    ["FP32", "31 TFLOPS"],
    ["Compute capability", "12.1 (sm_121)"],
    ["Architecture-specific target", "sm_121a — the `a` suffix is what enables the complete architecture-specific feature set; a family target (`f`) gets a superset of the baseline but a subset of those"],
    ["Storage", "4 TB self-encrypting NVMe"],
    ["Display", "1 × HDMI 2.1a, up to 3 × DisplayPort over USB-C"],
  ],

  compare: {
    "Execution unit": "Streaming Multiprocessor (SM)",
    "Units on die": "48 SM",
    "SIMD width": "4 × 32-wide processing blocks per SM",
    "Matrix engine": "Tensor Core (5th gen), 4 per SM",
    "Matrix engines total": "192",
    "Last-level cache": "24 MB L2 (GPU die)",
    "Memory": "128 GB LPDDR5X, unified with the CPU",
    "Bandwidth": "273 GB/s",
    "Board power": "140 W (SoC)",
    "Host link": "None — CPU on package, NVLink-C2C",
  },

  dieMap: {
    title: "Die map — GB10 Superchip",
    cols: 12, rows: 11, cell: 62, cellH: 40,
    lede:
      "Two dies, drawn one above the other with the die-to-die link between "
      + "them: twenty Arm cores in two clusters of ten on top, forty-eight "
      + "Blackwell SMs below. Both reach the same 128 GB of LPDDR5X through the "
      + "same coherent fabric, which is why this map has no PCIe host link and "
      + "no separate frame buffer to draw.",
    hint: "Hover a block for detail. Every block opens at its own place in the hierarchy below.",
    interconnect:
      "NVLink-C2C joins the two dies, and the memory fabric above both of them "
      + "carries every access to the LPDDR5X on the package. The GPU's 24 MB L2 "
      + "is the last level before that fabric. Off the box, the only path is the "
      + "ConnectX-7 NIC, hung off the SoC on PCIe 5.0 ×8.",
    dataflow: {
      label: "Traced read",
      title: "One read: SM → L2 → memory fabric → LPDDR5X",
      kind: "stops",
      stops: [[5, 7], [5, 6], [5, 2], [5, 1]],
      note:
        "Four stops, and the last one is system memory. On every discrete card "
        + "on this site the equivalent read ends in DRAM the GPU owns, and "
        + "anything the host holds has to be copied across PCIe first. Here "
        + "there is nothing to copy: the CPU wrote that address into the same "
        + "coherent pool the SM is reading it from. The cost moves rather than "
        + "disappearing — capacity is shared with the operating system, and the "
        + "273 GB/s is shared with the CPU rather than being the GPU's alone.",
    },
    tiles: [
      ...band(0, [
        { w: 4, kind: "io", label: "ConnectX-7 NIC", sub: "200 Gb/s", path: "nic",
          detail: "The scale-out link, and the only high-rate path off the box: a ConnectX-7 NIC at 200 Gb/s, attached to the SoC over PCIe 5.0 ×8." },
        { w: 4, kind: "io", label: "NVMe storage", sub: "4 TB, self-encrypting", path: "nvme",
          detail: "4 TB of self-encrypting NVMe. On a part whose memory is measured in tens of gigabytes rather than hundreds, the weights of anything larger start here." },
        { w: 4, kind: "io", label: "Display + USB-C", sub: "HDMI 2.1a · 3 × DP over USB-C", path: "display",
          detail: "One HDMI 2.1a output and up to three DisplayPort streams over USB-C. Idle on a box doing only inference, and drawn here because it is one of the things that makes this a desktop rather than a card." },
      ]),
      ...memBand(1, 4, 12, "LPDDR5X", () => "2 × 32-bit",
        "Two of the eight 32-bit LPDDR5X interfaces that make the 256-bit bus. This is not a frame buffer: it is the machine's system memory, and the CPU beside it on the package is reading the same addresses.",
        [["This block", "2 of 8 · 32-bit each"],
         ["Whole memory subsystem", "256-bit, 273 GB/s"],
         ["DRAM on the package", "128 GB LPDDR5X, unified and coherent"]], "mem"),
      ...band(2, [{ w: 12, kind: "link", label: "Coherent memory fabric", sub: "one address space for both dies", path: "fabric",
        detail: "Every access from either die reaches LPDDR5X through here, and both dies see one coherent view of it. This is the block that removes the host copy: there is no device pointer to allocate and no transfer to schedule, because the GPU is already addressing the memory the CPU wrote.",
        specs: [["Serves", "the CPU die and the GPU die"], ["Behind it", "128 GB LPDDR5X at 273 GB/s"]] }]),
      ...band(3, [
        ...Array.from({ length: 10 }, (_, i) => ({
          w: 1, kind: "compute", label: "X925", sub: `core ${i}`, path: "cpu/c0",
          detail: "One Arm Cortex-X925 core. Ten of them make one of the SoC's two ten-core clusters; each core has its own L2 behind the cluster's shared L3.",
          specs: [["Cluster", "10 cores"], ["Architecture", "Arm v9.2"]],
        })),
        { w: 2, kind: "cache", label: "L3 — 16 MB", sub: "cluster 0", path: "cpu/l3",
          detail: "16 MB of L3 shared by one ten-core cluster; 32 MB across the two. The GPU's own 24 MB L2 sits on the other die and is not part of this.",
          specs: [["Per cluster", "16 MB"], ["Total", "32 MB"]] },
      ]),
      ...band(4, [
        ...Array.from({ length: 10 }, (_, i) => ({
          w: 1, kind: "compute", label: "A725", sub: `core ${i}`, path: "cpu/c1",
          detail: "One Arm Cortex-A725 core — the efficiency half of the twenty. NVIDIA states two clusters of ten and ten cores of each type; drawing one type per cluster row follows that split, and the row is the claim rather than any core's position.",
          specs: [["Cluster", "10 cores"], ["Architecture", "Arm v9.2"]],
        })),
        { w: 2, kind: "cache", label: "L3 — 16 MB", sub: "cluster 1", path: "cpu/l3",
          detail: "The second cluster's 16 MB of L3.",
          specs: [["Per cluster", "16 MB"], ["Total", "32 MB"]] },
      ]),
      ...band(5, [{ w: 12, kind: "link", label: "NVLink-C2C", sub: "die to die, inside the package", path: "c2c",
        detail: "The chip-to-chip link between the Arm CPU die and the Blackwell GPU die. It is what makes the pair one coherent machine rather than a CPU with an accelerator bolted to it — and it is inside the package, so nothing about it is a slot a user can see.",
        specs: [["Joins", "CPU die ⇄ GPU die"], ["Bandwidth", "—"]] }]),
      ...band(6, [{ w: 12, kind: "cache", label: "GPU L2 — 24 MB", sub: "shared by all 48 SMs · last level before the fabric", path: "gpu/l2",
        detail: "24 MB of L2 on the GPU die, the last level an SM sees before its read leaves for the memory fabric. On a part with 273 GB/s behind it rather than four figures of it, keeping a working set resident here is a larger lever than it is on any discrete card on this site.",
        specs: [["Capacity", "24 MB"], ["Shared by", "48 SMs"]] }]),
      ...field({
        y0: 7, perRow: 12, rows: 4, w: 1,
        make: (i) => ({
          kind: "compute", label: "SM", sub: `#${i}`,
          path: "gpu/sm",
          detail: `Streaming multiprocessor ${i} of ${SM_COUNT}. Four processing blocks — 128 CUDA cores and four fifth-generation Tensor Cores — one RT core, and 128 KB of L1 and shared memory.`,
          specs: [["CUDA cores", "128"], ["Tensor Cores", "4 (5th gen)"], ["L1 / shared", "128 KB"]],
        }),
      }),
    ],
    note:
      "The two dies are drawn stacked with NVLink-C2C between them; the SM "
      + "field is the GPU die's 48 SMs and the two rows above the link are the "
      + "CPU die's twenty cores. No harvest is drawn, because the full GB10 die's "
      + "SM count is not published — 48 is what the part exposes, not 48 of a "
      + "stated total. " + MAP_NOTE,
    source: "NVIDIA's DGX Spark specifications and its Hot Chips 2025 GB10 presentation",
  },

  root: {
    id: "card", label: "DGX Spark", kind: "compute",
    note: "one GB10 Superchip — an Arm CPU die and a Blackwell GPU die joined by NVLink-C2C — with 128 GB of LPDDR5X that both dies address coherently. The architectural fact worth carrying away is the one that has no analogue on the discrete cards here: there is no separate GPU memory. Capacity is shared with the operating system rather than reserved, and the 273 GB/s is the whole machine's, not the GPU's",
    cols: 4,
    children: [
      {
        id: "gpu", label: "Blackwell GPU die", kind: "compute", span: 2,
        note: "the GPU half of the package: 48 streaming multiprocessors — 6,144 CUDA cores and 192 fifth-generation Tensor Cores — behind 24 MB of L2. NVIDIA quotes it at up to 1 PFLOP of NVFP4 and 31 TFLOPS of FP32",
        specs: [["SMs", "48"], ["CUDA cores", "6,144"], ["Tensor Cores", "192 (5th gen)"], ["L2", "24 MB"]],
        cols: 2,
        children: [
          { ...sm(SM_COUNT), count: SM_COUNT + " on the die" },
          { id: "l2", label: "L2 cache — 24 MB", kind: "cache",
            note: "the last level before the memory fabric, shared by every SM. Behind it is LPDDR5X at 273 GB/s shared with the CPU — a fraction of what a discrete card of this generation has to itself — so the working set that fits here is the difference between arithmetic-bound and memory-bound",
            specs: [["Capacity", "24 MB"], ["Shared by", "48 SMs"]] },
        ],
      },
      {
        id: "cpu", label: "Arm CPU die", kind: "compute", span: 2,
        note: "twenty Arm v9.2 cores in two clusters of ten — ten Cortex-X925 and ten Cortex-A725 — with 16 MB of L3 per cluster. It is the machine's host processor, not a helper: the GPU has no other CPU to be attached to",
        specs: [["Cores", "20"], ["Clusters", "2 × 10"], ["L3", "16 MB per cluster, 32 MB total"], ["Architecture", "Arm v9.2"]],
        cols: 2,
        children: [
          { id: "c0", label: "Cortex-X925 ×10", kind: "compute",
            note: "the performance half of the twenty cores" },
          { id: "c1", label: "Cortex-A725 ×10", kind: "compute",
            note: "the efficiency half of the twenty cores" },
          { id: "l3", label: "L3 — 16 MB per cluster", kind: "cache", span: 2,
            note: "16 MB shared inside each ten-core cluster, 32 MB across the die. Separate from the GPU die's 24 MB L2",
            specs: [["Per cluster", "16 MB"], ["Total", "32 MB"]] },
        ],
      },
      {
        id: "c2c", label: "NVLink-C2C", kind: "link", span: 2,
        note: "the die-to-die interconnect inside the package, and the reason the two dies behave as one coherent machine. Every other part on this site reaches its host across PCIe and pays a copy to do it",
        specs: [["Joins", "CPU die ⇄ GPU die"], ["Bandwidth", "—"]],
      },
      {
        id: "fabric", label: "Coherent memory fabric", kind: "link", span: 2,
        note: "one address space over the LPDDR5X, seen the same way by both dies. This is what a unified-memory part means in practice: no device allocation, no transfer, and no second copy of the weights",
        specs: [["Serves", "both dies"], ["Behind it", "128 GB LPDDR5X"]],
      },
      {
        id: "mem", label: "128 GB LPDDR5X", kind: "memory", span: 2,
        note: "the system memory, and the GPU's memory, and the same bytes. 256 bits wide for 273 GB/s. Budgeting it as a private GPU pool is the mistake this part invites: the operating system and every process on the box are drawing from the same 128 GB, and the CPU's traffic and the GPU's share one 273 GB/s",
        specs: [["Capacity", "128 GB"], ["Bus", "256-bit"], ["Bandwidth", "273 GB/s"], ["Owned by", "both dies, coherently"]],
      },
      { id: "nic", label: "ConnectX-7 NIC — 200 Gb/s", kind: "io",
        note: "the scale-out link, attached to the SoC over PCIe 5.0 ×8. It is how two of these are paired, and the only high-rate path off the box" },
      { id: "nvme", label: "NVMe — 4 TB", kind: "io",
        note: "4 TB of self-encrypting NVMe storage" },
      { id: "display", label: "Display outputs", kind: "io",
        note: "HDMI 2.1a plus up to three DisplayPort streams over USB-C; idle on a box doing only inference" },
    ],
  },

  dieNote:
    "GB10 is drawn as two dies on one package. The 48 SMs are the count the part exposes; NVIDIA does not publish a full-die SM count, so no harvest is shown.",

  sources: [
    ["NVIDIA — DGX Spark specifications", "https://www.nvidia.com/en-us/products/workstations/dgx-spark/"],
    ["NVIDIA — Grace Blackwell on every desk (GB10 announcement)", "https://nvidianews.nvidia.com/news/nvidia-puts-grace-blackwell-on-every-desk-and-at-every-ai-developers-fingertips"],
    ["NVIDIA — CUDA Programming Guide: compute capabilities, architecture- and family-specific targets", "https://docs.nvidia.com/cuda/cuda-programming-guide/05-appendices/compute-capabilities.html"],
    ["ServeTheHome — NVIDIA outlines the GB10 SoC architecture at Hot Chips 2025", "https://www.servethehome.com/nvidia-outlines-gb10-soc-architecture-at-hot-chips-2025/"],
    ["Chips and Cheese — Analyzing NVIDIA GB10's GPU", "https://chipsandcheese.com/p/analyzing-nvidia-gb10s-gpu"],
  ],
};
