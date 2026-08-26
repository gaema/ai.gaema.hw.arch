// NVIDIA GeForce RTX 5090 -- GB202, 170 of 192 SMs enabled.
// Every figure here is from a published vendor or press source; see `sources`.

import { die, dieMap } from "./_blackwell.js";

export default {
  id: "rtx-5090",
  name: "GeForce RTX 5090",
  vendor: "NVIDIA",
  vendorKey: "nvidia",
  arch: "Blackwell",
  die: "GB202",
  tagline:
    "The consumer GB202: 170 of 192 SMs, 21,760 CUDA cores, and 32 GB of GDDR7 on the same 512-bit bus as its workstation sibling.",

  spec: {
    "Architecture": "Blackwell",
    "Die": "GB202",
    "Process node": "TSMC 4N",
    "Transistors": "92.2 B",
    "Die area": "~750 mm²",
    "Execution unit": "Streaming Multiprocessor (SM)",
    "Units enabled": "170 of 192",
    "Matrix engines": "680 Tensor Cores (5th gen, 4 per SM)",
    "On-chip memory": "96 MB L2 — of the die's 128 MB",
    "Memory": "32 GB GDDR7",
    "Memory bus": "512-bit",
    "Memory bandwidth": "1,792 GB/s",
    "Board power": "575 W",
    "Cooling": "Active — dual flow-through on the Founders Edition",
    "Host interface": "PCIe 5.0 ×16",
    "Scale-out link": "None — PCIe only",
  },

  extra: [
    ["CUDA cores", "21,760"],
    ["RT Cores", "170 (4th gen)"],
    ["GPCs enabled", "11 of 12"],
    ["TPCs enabled", "85 of 96"],
    ["Memory controllers", "16 × 32-bit"],
    ["Base clock", "2.01 GHz"],
    ["Boost clock", "2.41 GHz"],
  ],

  compare: {
    "Execution unit": "Streaming Multiprocessor (SM)",
    "Units on die": "170 SM enabled (192 on the die)",
    "SIMD width": "4 × 32-wide processing blocks per SM",
    "Matrix engine": "Tensor Core (5th gen), 4 per SM",
    "Matrix engines total": "680",
    "Last-level cache": "96 MB L2 (die has 128 MB)",
    "Memory": "32 GB GDDR7",
    "Bandwidth": "1,792 GB/s",
    "Board power": "575 W",
    "Host link": "PCIe 5.0 ×16",
  },

  dieMap: dieMap({
    activeSMs: 170, gpcs: 11, tpcs: 85, mem: "32 GB", bw: "1,792 GB/s",
    l2: "96 MB", l2Note: "cut down from the die's full 128 MB — the same harvest that takes the SM count to 170.",
  }),

  root: {
    id: "card", label: "GeForce RTX 5090", kind: "compute",
    note: "one GB202 die on a PCIe 5.0 ×16 card, with 170 of its 192 SMs enabled — the consumer flagship of the Blackwell generation. Same silicon as the RTX PRO 6000, harvested harder and paired with 32 GB of non-ECC GDDR7 instead of 96 GB of ECC, which is the difference that decides which models fit rather than how fast they run",
    cols: 4,
    children: die({
      activeSMs: 170,
      memLabel: "GDDR7 memory controllers",
      mem: "32 GB",
      bus: "512-bit",
      bw: "1,792 GB/s",
      memNote: "sixteen 32-bit controllers making a 512-bit interface onto 32 GB of GDDR7, for 1,792 GB/s. In a memory-bound decode this rate, not the FLOPS, sets the floor on time per token — every weight is read once per token — and the 32 GB sets the harder limit of which models fit on the card at all",
    }),
  },

  dieNote:
    "The GPC array below is drawn as the full 12-GPC GB202. This card enables 170 of the die's 192 SMs; NVIDIA does not publish the exact harvest pattern, so no particular SM here is marked off.",

  sources: [
    ["NVIDIA — GeForce RTX 5090", "https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/"],
    ["TechPowerUp — GB202 die shot: 24,576 CUDA cores at 128 per SM", "https://www.techpowerup.com/331657/nvidia-gb202-blackwell-die-exposed-shows-the-massive-24-576-cuda-core-configuration"],
    ["Chips and Cheese — Blackwell: NVIDIA's massive GPU", "https://chipsandcheese.com/p/blackwell-nvidias-massive-gpu"],
  ],
};
