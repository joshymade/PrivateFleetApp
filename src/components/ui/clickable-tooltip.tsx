"use client";

import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";

type ClickableTooltipProps = {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  content: ReactNode;
  tooltipAlign?: "start" | "end";
};

export function ClickableTooltip({
  ariaLabel,
  children,
  className,
  content,
  tooltipAlign = "start",
}: ClickableTooltipProps) {
  const tooltipId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span
      ref={rootRef}
      className="relative inline-flex"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setOpen(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setOpen(false);
      }}
    >
      <button
        type="button"
        className={`inline-flex items-center gap-1 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${className ?? ""}`}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={tooltipId}
        onClick={() => setOpen((value) => !value)}
      >
        {children}
        <Info className="size-3.5 shrink-0" aria-hidden />
      </button>
      {open ? (
        <span
          id={tooltipId}
          role="tooltip"
          className={`absolute top-full z-20 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-card px-3 py-2 text-xs font-normal leading-snug text-foreground shadow-md ${
            tooltipAlign === "end" ? "right-0 left-auto" : "left-0"
          }`}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
