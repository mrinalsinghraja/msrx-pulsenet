"use client";

import { useState, useRef } from "react";
import { Download, Image, Printer, ChevronDown } from "lucide-react";

type DownloadButtonProps = {
  targetId: string;
  filename?: string;
  label?: string;
};

// ── Color patch: convert oklch/lab → rgb so html-to-image doesn't choke ──────
// Both html2canvas and html-to-image parse CSS colors in JS — neither supports
// CSS Color Level 4 (oklch/lab/lch). Tailwind v4 uses oklch internally.
// Fix: use the browser's own canvas to convert any modern color to rgb BEFORE
// capture, then restore inline styles after.

const PATCH_PROPS = [
  "color", "background-color",
  "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
  "outline-color", "text-decoration-color", "caret-color",
  "fill", "stroke",
];

let _cvs: HTMLCanvasElement | null = null;
let _ctx: CanvasRenderingContext2D | null = null;

function resolveToRgb(color: string): string {
  if (!_cvs) {
    _cvs = document.createElement("canvas");
    _cvs.width = _cvs.height = 1;
    _ctx = _cvs.getContext("2d");
  }
  const ctx = _ctx!;
  try {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    if (a === 0) return "transparent";
    if (a === 255) return `rgb(${r},${g},${b})`;
    return `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`;
  } catch {
    return color;
  }
}

function isModern(v: string) {
  return v.includes("lab(") || v.includes("oklch(") || v.includes("lch(") || v.includes("oklab(");
}

function patchColors(root: HTMLElement): () => void {
  const patches: { el: HTMLElement; prop: string; orig: string }[] = [];
  const els = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  for (const el of els) {
    const cs = getComputedStyle(el);
    for (const prop of PATCH_PROPS) {
      const val = cs.getPropertyValue(prop).trim();
      if (val && isModern(val)) {
        patches.push({ el, prop, orig: el.style.getPropertyValue(prop) });
        el.style.setProperty(prop, resolveToRgb(val), "important");
      }
    }
  }
  return () => {
    for (const { el, prop, orig } of patches) {
      if (orig) el.style.setProperty(prop, orig);
      else el.style.removeProperty(prop);
    }
  };
}
// ─────────────────────────────────────────────────────────────────────────────

export function DownloadButton({ targetId, filename = "pulsenet-report", label = "Download" }: DownloadButtonProps) {
  const [open, setOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  async function saveImage() {
    setCapturing(true);
    setOpen(false);
    let restore: (() => void) | null = null;
    try {
      const el = document.getElementById(targetId);
      if (!el) {
        alert("Content not ready — wait for data to load then try again");
        setCapturing(false);
        return;
      }

      el.scrollIntoView({ block: "start", behavior: "instant" });
      await new Promise((r) => setTimeout(r, 300));

      // Convert all modern CSS colors to rgb before capture
      restore = patchColors(el);
      await new Promise((r) => setTimeout(r, 100));

      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(el, {
        pixelRatio: 2,
        backgroundColor: "#f5f5f7",
        quality: 1,
        filter: (node) => {
          const n = node as HTMLElement;
          return !n.classList?.contains?.("pn-no-print");
        },
      });

      restore();
      restore = null;

      const link = document.createElement("a");
      link.download = `${filename}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      restore?.();
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Export failed:", msg);
      alert(`Export failed: ${msg}`);
    } finally {
      setCapturing(false);
    }
  }

  function printPDF() {
    setOpen(false);
    const el = document.getElementById(targetId);
    if (el) el.classList.add("pn-print-target");
    window.print();
    setTimeout(() => el?.classList.remove("pn-print-target"), 500);
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={capturing}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium bg-white border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-all"
      >
        <Download size={11} className={capturing ? "animate-bounce" : ""} />
        {capturing ? "Capturing…" : label}
        <ChevronDown size={10} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 z-20 bg-white border border-[var(--border)] rounded-xl overflow-hidden w-44"
            style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
            <button
              onClick={saveImage}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors"
            >
              <Image size={13} className="text-blue-500 shrink-0" />
              Save as Image
            </button>
            <div className="h-px bg-[var(--border)]" />
            <button
              onClick={printPDF}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors"
            >
              <Printer size={13} className="text-violet-500 shrink-0" />
              Print / Save PDF
            </button>
          </div>
        </>
      )}
    </div>
  );
}
