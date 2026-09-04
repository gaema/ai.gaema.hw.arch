// Tenstorrent Wormhole n300d -- two Wormhole ASICs on one card.
// Every figure here is from a published vendor or press source; see `sources`.

import { asic, dualDieMap } from "./_wormhole.js";

export default {
  id: "n300d",
  name: "Wormhole n300d",
  vendor: "Tenstorrent",
  vendorKey: "tt",
  arch: "Wormhole",
  die: "2 × Wormhole ASIC",
  tagline:
    "Two Wormhole ASICs on one actively cooled board — 128 Tensix tiles and 24 GB of GDDR6 at 300 W — joined by two Ethernet links routed across the PCB, not by a shared NOC. Only the first die has a live PCIe function; the second is reached over those links. Off the card there are two Warp 100 connectors and two QSFP-DD 200G cages.",

  spec: {
    "Architecture": "Wormhole B0",
    "Die": "Wormhole ASIC × 2",
    "Process node": "12 nm",
    "Transistors": "—",
    "Die area": "—",
    "Execution unit": "Tensix tile",
    "Units enabled": "128 of 160 — 64 of 80 per ASIC",
    "Matrix engines": "128 (1 per Tensix tile)",
    "On-chip memory": "192 MB SRAM — 1.5 MB per tile, software-managed, no cache hierarchy",
    "Memory": "24 GB GDDR6 — 12 GB per ASIC",
    "Memory bus": "192-bit per ASIC — 6 channels at 12 GT/s",
    "Memory bandwidth": "576 GB/s board · 288 GB/s per ASIC",
    "Board power": "300 W TBP",
    "Cooling": "Active (axial fan)",
    "Host interface": "PCIe 4.0 ×16 — one function for both ASICs",
    "Scale-out link": "2 × Warp 100 + 2 × QSFP-DD 200G; 200G chip-to-chip on the PCB",
  },

  extra: [
    ["ASICs on card", "2"],
    ["AI clock", "1 GHz"],
    ["Baby RISC-V per tile", "5 (RV32IM, 1 GHz)"],
    ["Big RISC-V cores", "none"],
    ["Die-to-die link", "2 Ethernet channels on the PCB — ASIC 0 ch 8,9 ⇄ ASIC 1 ch 0,1, no connector"],
    ["Second-die attach", "Ethernet-tunneled — the card is one PCIe function, not two"],
    ["Card-to-card ports", "Warp 100 port 1 on ASIC 0 ch 14,15 · port 2 on ASIC 1 ch 6,7"],
    ["QSFP-DD cages", "both on ASIC 0 — ch 6,7 and ch 0,1"],
    ["Ethernet tiles", "16 per die"],
    ["PCIe tiles", "1 per die — only ASIC 0 is the host path"],
    ["FP8", "466 TFLOPS"],
    ["BLOCKFP8", "262 TFLOPS"],
    ["FP16", "131 TFLOPS"],
  ],

  compare: {
    "Execution unit": "Tensix tile",
    "Units on die": "128 Tensix (64 per ASIC, 2 ASICs)",
    "SIMD width": "n/a — 5 scalar RISC-V cores issue to a compute complex",
    "Matrix engine": "Matrix engine (FPU), 1 per tile",
    "Matrix engines total": "128",
    "Last-level cache": "none — 1.5 MB software-managed SRAM per tile",
    "Memory": "24 GB GDDR6",
    "Bandwidth": "288 GB/s per ASIC",
    "Board power": "300 W TBP",
    "Host link": "PCIe 4.0 ×16 — 1 function",
  },

  dieMaps: [dualDieMap()],

  root: {
    id: "card", label: "Wormhole n300d", kind: "compute",
    note: "two Wormhole ASICs on one actively cooled board, behind a single PCIe 4.0 ×16 function — the second die is not a second PCIe device",
    cols: 2,
    children: [
      {
        ...asic(64), id: "asic0", label: "Wormhole ASIC 0", count: "the MMIO chip",
        note: "the die the host enumerates. Its PCIe tile at (0,3) is the card's only host function; the QSFP-DD cages and Warp 100 port 1 are on this chip too",
      },
      {
        ...asic(64, { host: false }), id: "asic1", label: "Wormhole ASIC 1", count: "the remote chip",
        note: "reached over the two on-board Ethernet links, not as a second PCIe function. Warp 100 port 2 lives here. Opening the card as one device still has to talk to this die across the PCB",
      },
      {
        id: "link", label: "On-board die-to-die link", kind: "link", span: 2,
        specs: [["Links", "2, independent"], ["Pairing", "ASIC 0 ch 8 ⇄ ASIC 1 ch 0 · ch 9 ⇄ ch 1"], ["Connector", "none — PCB trace"], ["Fabric", "Ethernet, the same one used between cards"], ["Host path to ASIC 1", "these two links"]],
        note: "the two ASICs are joined by TWO independent Ethernet links — the same fabric that runs card to card, but routed as differential pairs on the PCB instead of through a connector. tt-metal types them separately for that reason: a TRACE port, not a Warp or QSFP-DD one. The two dies do NOT share a NOC; each mesh is closed and these two links are the only path between them, and the only path the host has onto ASIC 1",
      },
      {
        id: "qsfp", label: "2 × QSFP-DD 200G", kind: "io",
        note: "both cages are wired to ASIC 0. They do not take channels from the second die",
        specs: [["Cage 1", "ASIC 0 ch 6, 7"], ["Cage 2", "ASIC 0 ch 0, 1"], ["Rate", "200G each"]],
      },
      {
        id: "warp", label: "2 × Warp 100", kind: "io",
        note: "one connector per die, not a pair that mixes both. Port 1 is ASIC 0 channels 14 and 15; port 2 is ASIC 1 channels 6 and 7",
        specs: [["Port 1", "ASIC 0 ch 14, 15"], ["Port 2", "ASIC 1 ch 6, 7"]],
      },
      {
        id: "slot", label: "PCIe 4.0 ×16 edge", kind: "io", span: 2,
        note: "the card's edge connector — a board part. Only ASIC 0's PCIe tile is live on the host, so the card is one function, two dies",
        specs: [["Lanes", "16"], ["Generation", "PCIe 4.0"], ["Functions", "1"]],
      },
    ],
  },

  sources: [
    ["Tenstorrent — Wormhole n150d / n300d specifications", "https://docs.tenstorrent.com/aibs/wormhole/specifications.html"],
    ["Tenstorrent — Wormhole cards", "https://tenstorrent.com/hardware/wormhole"],
    ["Tenstorrent — tt-isa-documentation, Wormhole B0 tile inventory", "https://github.com/tenstorrent/tt-isa-documentation/blob/main/WormholeB0/README.md"],
    ["Tenstorrent — tt-metal, N300 board definition (Warp 100 + TRACE ports)", "https://github.com/tenstorrent/tt-metal/blob/main/tools/scaleout/board/board.cpp"],
    ["Tenstorrent — tt-metal, Wormhole B0 SoC descriptor", "https://github.com/tenstorrent/tt-metal/blob/main/tt_metal/soc_descriptors/wormhole_b0_80_arch.yaml"],
    ["Tenstorrent — Community highlight, Wormhole physicalities (n300 E8↔E0, E9↔E1; row harvest)", "https://tenstorrent.com/vision/community-highlight-tenstorrent-wormhole-series-part-1-physicalities"],
    ["EPCC — Tenstorrent at HPC Asia 2025 (12 nm, 80 Tensix, 16 × 100 GbE)", "https://riscv.epcc.ed.ac.uk/assets/files/hpcasia25/Tenstorrent.pdf"],
  ],
};
