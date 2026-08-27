// Tenstorrent Blackhole p300c -- two Blackhole ASICs on one card.
// Every figure here is from a published vendor or press source; see `sources`.

import { asic, dualDieMap, quietBoxMap } from "./_blackhole.js";

export default {
  id: "p300c",
  name: "Blackhole p300c",
  vendor: "Tenstorrent",
  vendorKey: "tt",
  arch: "Blackhole",
  die: "2 × Blackhole ASIC",
  tagline:
    "Two Blackhole ASICs on one liquid-cooled board — 240 Tensix tiles and 64 GB of GDDR6 at 600 W — joined by two Ethernet links routed across the PCB, not by a shared NOC. Each die fuses off a different one of its two PCIe tiles, so the pair are mirror images rather than copies. Off the card there are two Warp 400 connector positions and the p300c fits one. It is not sold on its own: it is the card inside TT-QuietBox 2.",

  spec: {
    "Architecture": "Blackhole",
    "Die": "Blackhole ASIC × 2",
    "Process node": "6 nm",
    "Transistors": "—",
    "Die area": "—",
    "Execution unit": "Tensix tile",
    "Units enabled": "240 of 280 — 120 of 140 per ASIC",
    "Matrix engines": "240 (1 per Tensix tile)",
    "On-chip memory": "360 MB SRAM — 1.5 MB per tile, software-managed, no cache hierarchy",
    "Memory": "64 GB GDDR6 — 32 GB per ASIC",
    "Memory bus": "256-bit per ASIC — 8 channels at 16 GT/s",
    "Memory bandwidth": "1,024 GB/s board · 512 GB/s per ASIC",
    "Board power": "600 W TBP",
    "Cooling": "Liquid",
    "Host interface": "PCIe 5.0 ×16",
    "Scale-out link": "Warp 400 card-to-card — 2 positions on the board, 1 fitted; Samtec ARP6-series cable, no QSFP-DD cages",
  },

  extra: [
    ["ASICs on card", "2"],
    ["Baby RISC-V per tile", "5 (RV32IM, 1.35 GHz)"],
    ["Big RISC-V cores", "32 (16 per ASIC) — Tenstorrent's own p300c table still marks this “TBD”"],
    ["Die-to-die link", "2 Ethernet channels on the PCB — ch 3 ⇄ 8 and ch 2 ⇄ 9, no connector"],
    ["Card-to-card ports", "2 Warp 400 positions on the board — 1 fitted on the p300c"],
    ["PCIe tiles", "2 per die, each ×16-capable — one used, one idle"],
    ["PCIe mirroring", "left die uses (2,0), right die uses (11,0)"],
    ["Availability", "not sold separately — ships in TT-QuietBox 2"],
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
    "Board power": "600 W TBP",
    "Host link": "PCIe 5.0 ×16",
  },

  // Two maps, two scales. The card is what the hierarchy below describes; the
  // box is what actually ships, and without it the card map reads as though the
  // Warp 400 connector joined something on the same PCB.
  dieMaps: [dualDieMap(), quietBoxMap()],

  root: {
    id: "card", label: "Blackhole p300c", kind: "compute",
    note: "two Blackhole ASICs on one liquid-cooled board, behind a single PCIe 5.0 ×16 edge connector — but each die keeps its OWN live PCIe interface, so they do not share one. How the board fans two endpoints onto one connector is not drawn",
    cols: 2,
    children: [
      {
        ...asic(120), id: "asic0", label: "Blackhole ASIC 0", count: "the left chip",
        note: "PCIe core (11,0) is fused off here, so this die's live host interface is (2,0) — the mirror of ASIC 1",
      },
      {
        ...asic(120), id: "asic1", label: "Blackhole ASIC 1", count: "the right chip",
        note: "PCIe core (2,0) is fused off here, so this die's live host interface is (11,0) — the mirror of ASIC 0",
      },
      {
        id: "link", label: "On-board die-to-die link", kind: "link", span: 2,
        specs: [["Links", "2, independent"], ["Pairing", "ASIC 0 ch 3 ⇄ ASIC 1 ch 8 · ch 2 ⇄ ch 9"], ["Lanes each", "8 SerDes"], ["Device topology", "1 × 2"], ["Connector", "none — PCB trace"], ["Fabric", "Ethernet, the same one used between cards"]],
        note: "the two ASICs are joined by TWO independent Ethernet links — the same fabric that runs card to card, but routed as differential pairs on the PCB instead of through a connector. tt-metal types them separately for that reason: a TRACE port, not a Warp or QSFP-DD one. The two dies do NOT share a NOC; each mesh is closed and these two links are the only path between them",
      },
      {
        id: "warp", label: "Warp 400 card-to-card ports", kind: "io", span: 2,
        specs: [["Positions on the board", "2"], ["Fitted on the p300c", "1"], ["Channels each", "4 — 2 from each ASIC"], ["Cable", "Samtec ARP6 series"], ["QSFP-DD cages", "none"]],
        note: "the only way OFF the card. The board carries two connector positions and a p300c populates one of them — a single connector takes channels from BOTH dies, not one per die. tt-metal's board definition declares both positions and does not distinguish the variants (p300a and p300c share one board type), so software describes a board with two where this card has one, and the channels the empty position would drive simply idle",
      },
      {
        id: "slot", label: "PCIe 5.0 ×16 edge", kind: "io", span: 2,
        note: "the card's edge connector — a board part. Each ASIC has its own live PCIe tile, so the card carries two endpoints behind one connector; the board-level fan-out is not drawn",
      },
    ],
  },

  sources: [
    ["Tenstorrent — Blackhole p300c card specifications", "https://docs.tenstorrent.com/aibs/blackhole/p300.html"],
    ["Tenstorrent — Blackhole cards", "https://tenstorrent.com/hardware/blackhole"],
    ["Tenstorrent — Blackhole & TT-Metalium, Hot Chips 2024 (PDF)", "https://hc2024.hotchips.org/assets/program/conference/day1/88_HC2024.Tenstorrent.Jasmina.Davor.v7.pdf"],
    ["Tenstorrent — tt-isa-documentation, Blackhole A0 tile inventory", "https://github.com/tenstorrent/tt-isa-documentation/blob/main/BlackholeA0/README.md"],
    ["Tenstorrent — tt-metal, P300 board definition (Warp 400 + TRACE ports)", "https://github.com/tenstorrent/tt-metal/blob/main/tools/scaleout/board/board.cpp"],
    ["Tenstorrent — tt-umd, P300 cluster descriptor example", "https://github.com/tenstorrent/tt-metal/blob/main/tt_metal/third_party/umd/tests/cluster_descriptor_examples/blackhole_P300_both_mmio.yaml"],
  ],
};
