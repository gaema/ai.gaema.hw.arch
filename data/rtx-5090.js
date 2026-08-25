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

  headline: [
    ["Architecture", "Blackwell"],
    ["Die", "GB202, TSMC 4N"],
    ["SMs enabled", "170 of 192"],
    ["CUDA cores", "21,760"],
    ["Tensor Cores", "680 (5th gen)"],
    ["RT Cores", "170 (4th gen)"],
    ["Base clock", "2.01 GHz"],
    ["Boost clock", "2.41 GHz"],
    ["Memory", "32 GB GDDR7"],
    ["Memory bus", "512-bit"],
    ["Memory bandwidth", "1,792 GB/s"],
    ["Memory controllers", "16 × 32-bit"],
    ["GPCs enabled", "11 of 12"],
    ["TPCs enabled", "85 of 96"],
    ["L2 cache", "96 MB (of the die's 128 MB)"],
    ["Board power", "575 W"],
    ["Host interface", "PCIe 5.0 ×16"],
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
    note: "one GB202 die with 170 of its 192 SMs enabled, on a PCIe 5.0 ×16 card",
    cols: 4,
    children: die({
      activeSMs: 170,
      memLabel: "GDDR7 memory controllers",
      mem: "32 GB",
      bus: "512-bit",
      bw: "1,792 GB/s",
      memNote: "512-bit bus, 32 GB of GDDR7, 1,792 GB/s",
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
