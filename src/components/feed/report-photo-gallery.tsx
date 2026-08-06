"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { damageLocationLabel } from "@/lib/damage/locations";

export type GalleryPhoto = {
  url: string;
  /** Stable damage location key, if set. */
  damageLocation?: string | null;
};

type ReportPhotoGalleryProps = {
  photos: GalleryPhoto[];
  altPrefix: string;
};

function subscribeNoop() {
  return () => {};
}

export function ReportPhotoGallery({
  photos,
  altPrefix,
}: ReportPhotoGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  const urls = photos.map((p) => p.url);

  useEffect(() => {
    if (activeIndex == null) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveIndex(null);
        return;
      }
      if (urls.length < 2) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setActiveIndex((i) =>
          i == null ? i : (i - 1 + urls.length) % urls.length,
        );
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setActiveIndex((i) => (i == null ? i : (i + 1) % urls.length));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeIndex, urls.length]);

  if (photos.length === 0) return null;

  const activePhoto = activeIndex != null ? photos[activeIndex] : null;
  const activeUrl = activePhoto?.url ?? null;
  const activeLoc = activePhoto?.damageLocation
    ? damageLocationLabel(activePhoto.damageLocation)
    : null;
  const multi = photos.length > 1;

  return (
    <>
      <div
        className={multi ? "mt-4 columns-2 gap-2" : "mt-4"}
        role="group"
        aria-label="Damage photos"
      >
        {photos.map((photo, index) => {
          const locLabel = photo.damageLocation
            ? damageLocationLabel(photo.damageLocation)
            : null;
          return (
            <button
              key={`${photo.url}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`${multi ? "mb-2" : ""} block w-full break-inside-avoid overflow-hidden rounded-lg bg-muted text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
              aria-label={`View ${altPrefix}${multi ? ` photo ${index + 1} of ${photos.length}` : ""}${locLabel ? `, ${locLabel}` : ""} larger`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- R2 public URLs */}
              <img
                src={photo.url}
                alt={`${altPrefix}${multi ? ` ${index + 1}` : ""}${locLabel ? ` — ${locLabel}` : ""}`}
                className="w-full"
                loading={index === 0 ? "eager" : "lazy"}
              />
              {locLabel ? (
                <span className="block border-t border-border bg-card px-2 py-1.5 text-center text-xs font-medium text-foreground">
                  {locLabel}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {mounted &&
        activeUrl != null &&
        activeIndex != null &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={() => setActiveIndex(null)}
          >
            <p id={titleId} className="sr-only">
              {altPrefix}
              {multi ? ` photo ${activeIndex + 1} of ${photos.length}` : ""}
              {activeLoc ? ` — ${activeLoc}` : ""}
            </p>

            <button
              ref={closeRef}
              type="button"
              onClick={() => setActiveIndex(null)}
              className="absolute right-3 top-3 z-10 flex size-11 items-center justify-center rounded-lg bg-black/50 text-white hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Close photo"
            >
              <X className="size-6" aria-hidden />
            </button>

            {multi ? (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveIndex(
                      (activeIndex - 1 + photos.length) % photos.length,
                    );
                  }}
                  className="absolute left-2 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg bg-black/50 text-white hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:left-4"
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="size-6" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveIndex((activeIndex + 1) % photos.length);
                  }}
                  className="absolute right-2 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg bg-black/50 text-white hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:right-4"
                  aria-label="Next photo"
                >
                  <ChevronRight className="size-6" aria-hidden />
                </button>
              </>
            ) : null}

            {/* eslint-disable-next-line @next/next/no-img-element -- R2 public URLs */}
            <img
              src={activeUrl}
              alt={`${altPrefix}${multi ? ` ${activeIndex + 1}` : ""}${activeLoc ? ` — ${activeLoc}` : ""}`}
              className="max-h-[min(92vh,100%)] max-w-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />

            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1">
              {activeLoc ? (
                <p className="rounded-md bg-black/50 px-2.5 py-1 text-xs font-medium text-white">
                  {activeLoc}
                </p>
              ) : null}
              {multi ? (
                <p className="rounded-md bg-black/50 px-2.5 py-1 text-xs tabular-nums text-white">
                  {activeIndex + 1} / {photos.length}
                </p>
              ) : null}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
