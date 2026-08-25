// Tenstorrent Blackhole p300c -- two Blackhole ASICs on one card.
// Every figure here is from a published vendor or press source; see `sources`.

import { asic, dieMap } from "./_blackhole.js";

export default {
  id: "p300c",
  name: "Blackhole p300c",
  vendor: "Tenstorrent",
  vendorKey: "tt",
  arch: "Blackhole",
  die: "2 × Blackhole ASIC",
  tagline:
    "Two Blackhole ASICs on one board: 240 Tensix tiles and 64 GB of GDDR6, inside a 550 W board limit.",

  headline: [
    ["Architecture", "Blackhole"],
    ["ASICs on card", "2"],
    ["Tensix tiles", "240 (120 per ASIC)"],
    ["Baby RISC-V per tile", "5 (RV32IM, 1 GHz)"],
    ["SRAM per tile", "1.5 MB"],
    ["SRAM on card", "360 MB"],
    ["Big RISC-V cores", "32 (16 per ASIC)"],
    ["Memory", "64 GB GDDR6 (32 GB per ASIC)"],
    ["Memory bandwidth", "512 GB/s per ASIC"],
    ["Board power limit", "550 W"],
    ["Cooling", "passive"],
    ["Host interface", "PCIe 5.0 ×16"],
  ],

  compare: {
    "Execution unit": "Tensix tile",
    "Units on die": "240 Tensix (120 per ASIC, 2 ASICs)",
    "SIMD width": "n/a — 5 scalar RISC-V cores issue to a compute complex",
    "Matrix engine": "Matrix engine (FPU), 1 per tile",
    "Matrix engines total": "240",
    "Last-level cache": "none — 1.5 MB software-managed SRAM per tile",
    "Memory": "64 GB GDDR6",
    "Bandwidth": "512 GB/s per ASIC",
    "Board power": "550 W (board limit)",
    "Host link": "PCIe 5.0 ×16",
  },

  dieMap: {
    ...dieMap("asic0"),
    title: "Die map — the real NOC grid, per ASIC",
    note: "One die is drawn. The p300c carries two identical Blackhole ASICs, so the map applies to each; the tiles link into ASIC 0's branch of the hierarchy. Grid positions are real NOC coordinates, but the cells are drawn at uniform size — a Tensix tile and a GDDR tile are not the same area on silicon.",
  },

  root: {
    id: "card", label: "Blackhole p300c", kind: "compute",
    note: "two Blackhole ASICs on one passively cooled board, sharing a PCIe 5.0 ×16 edge",
    cols: 2,
    children: [
      { ...asic(120), id: "asic0", label: "Blackhole ASIC 0" },
      { ...asic(120), id: "asic1", label: "Blackhole ASIC 1" },
      {
        id: "link", label: "On-board die-to-die link", kind: "link", span: 2,
        specs: [["Links", "2 Ethernet channels"], ["Fabric", "the same one used between cards"]],
        note: "the two ASICs are joined on the board over two of the Ethernet channels — the same fabric that runs card to card, just routed on the PCB instead of through a cage",
      },
      { id: "slot", label: "PCIe 5.0 ×16 edge", kind: "io", span: 2 },
    ],
  },

  sources: [
    ["Tenstorrent — Blackhole p300c card specifications", "https://docs.tenstorrent.com/aibs/blackhole/p300.html"],
    ["Tenstorrent — Blackhole cards", "https://tenstorrent.com/hardware/blackhole"],
    ["Tenstorrent — Blackhole & TT-Metalium, Hot Chips 2024 (PDF)", "https://hc2024.hotchips.org/assets/program/conference/day1/88_HC2024.Tenstorrent.Jasmina.Davor.v7.pdf"],
  ],
};
