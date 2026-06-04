"use client";

import { useState, useRef } from "react";
import { Download, Image, Printer, ChevronDown } from "lucide-react";

type DownloadButtonProps = {
  targetId: string;          // ID of the DOM element to capture
  filename?: string;         // base filename (no extension)
  label?: string;
};

export function DownloadButton({ targetId, filename = "pulsenet-report", label = "Download" }: DownloadButtonProps) {
  const [open, setOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  async function saveImage() {
    setCapturing(true);
    setOpen(false);
    try {
      const el = document.getElementById(targetId);
      if (!el) {
        console.error(`DownloadButton: element #${targetId} not found`);
        setCapturing(false);
        return;
      }

      // Scroll element to top of viewport so it renders fully
      el.scrollIntoView({ block: "start", behavior: "instant" });
      await new Promise((r) => setTimeout(r, 250));

      const rect = el.getBoundingClientRect();

      // Temporarily set overflow:visible on all descendants so SVG glow filters
      // (which extend beyond their parent bounds) aren't clipped in the capture
      const overflowEls: Array<{ node: HTMLElement; orig: string }> = [];
      el.querySelectorAll<HTMLElement>("*").forEach((node) => {
        const computed = getComputedStyle(node).overflow;
        if (computed === "hidden" || computed === "clip") {
          overflowEls.push({ node, orig: node.style.overflow });
          node.style.overflow = "visible";
        }
      });

      await new Promise((r) => setTimeout(r, 50));

      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#f5f5f7",
        logging: false,
        width: Math.ceil(rect.width),
        height: el.scrollHeight,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        // Let html2canvas calculate position from element; no manual offsets
        ignoreElements: (node) => (node as HTMLElement).classList?.contains("pn-no-print"),
      });

      // Restore overflow values
      overflowEls.forEach(({ node, orig }) => { node.style.overflow = orig; });

      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `${filename}.png`;
      link.href = dataUrl;
      // Must append to DOM for Firefox + Safari compatibility
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("DownloadButton capture failed:", msg);
      alert(`Export failed: ${msg}`);
    } finally {
      setCapturing(false);
    }
  }

  function printPDF() {
    setOpen(false);
    // Add print class to target element for scoped print styles
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
