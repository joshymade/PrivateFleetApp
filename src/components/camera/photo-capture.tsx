"use client";

import { Camera, ImageIcon, Info } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
} from "react";

type PhotoCaptureProps = {
  /** Single-photo mode. Ignored when `multiple` is true. */
  value?: File | null;
  onChange?: (file: File | null) => void;
  /** Multi-photo grid mode (damage reports use up to 8 for tractor and trailer). */
  multiple?: boolean;
  values?: File[];
  onChangeMultiple?: (files: File[]) => void;
  disabled?: boolean;
  /** How many grid slots to show when `multiple` is true (default 8). */
  maxFiles?: number;
  /** When set, each filled photo shows a location picker. */
  locationOptions?: readonly { value: string; label: string }[];
  locations?: (string | null)[];
  onLocationsChange?: (locations: (string | null)[]) => void;
  /** Require a location on each photo before submit (trailer). */
  requireLocation?: boolean;
};

type PreviewItem = {
  key: string;
  url: string;
};

/**
 * Mobile-friendly photo grid.
 *
 * - "Open Camera" → hidden input with `capture="environment"` via `<label htmlFor>`
 *   so iOS treats it as a direct user gesture (programmatic `.click()` often opens
 *   the gallery and ignores `capture`).
 * - Slot clicks / "Choose from library" → separate input without `capture` (gallery).
 * Camera snaps fill the next empty slot; slot picks replace/fill that slot.
 */
export function PhotoCapture({
  value = null,
  onChange,
  multiple = false,
  values = [],
  onChangeMultiple,
  disabled,
  maxFiles = 8,
  locationOptions,
  locations,
  onLocationsChange,
  requireLocation = false,
}: PhotoCaptureProps) {
  const tipId = useId();
  const cameraInputId = useId();
  const libraryInputId = useId();
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const tipRootRef = useRef<HTMLSpanElement>(null);
  /** Slot index that triggered the file picker (replace filled, or append from empty). */
  const targetSlotRef = useRef<number | null>(null);
  const [tipOpen, setTipOpen] = useState(false);

  const slotCount = multiple ? maxFiles : 1;
  const files = multiple ? values : value ? [value] : [];
  const canAddMore = files.length < slotCount;
  const filesIdentity = files
    .map((f) => `${f.name}:${f.size}:${f.lastModified}`)
    .join("|");

  const previews = useMemo<PreviewItem[]>(
    () =>
      files.map((file, index) => ({
        key: `${file.name}-${file.size}-${file.lastModified}-${index}`,
        url: URL.createObjectURL(file),
      })),
    // Intentionally keyed by file identity, not `files` reference
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filesIdentity],
  );

  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [previews]);

  useEffect(() => {
    if (!tipOpen) return;

    function onPointerDown(e: PointerEvent) {
      if (!tipRootRef.current?.contains(e.target as Node)) {
        setTipOpen(false);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setTipOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [tipOpen]);

  /** Gallery only — never the camera input. */
  function openLibraryPicker(slotIndex: number) {
    if (disabled) return;
    targetSlotRef.current = slotIndex;
    libraryInputRef.current?.click();
  }

  function openLibraryPrimary() {
    if (disabled || !canAddMore) return;
    openLibraryPicker(files.length);
  }

  function handleCameraLabelClick(event: MouseEvent<HTMLLabelElement>) {
    if (disabled || !canAddMore) {
      event.preventDefault();
      return;
    }
    // Next empty slot — must run before the file dialog from the label→input gesture.
    targetSlotRef.current = files.length;
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files;
    const slotIndex = targetSlotRef.current ?? files.length;
    targetSlotRef.current = null;

    if (!selected || selected.length === 0) {
      event.target.value = "";
      return;
    }

    if (multiple) {
      const incoming = Array.from(selected);
      if (incoming.length === 0) {
        event.target.value = "";
        return;
      }

      // Filled slot: replace that photo only. Empty slot: append up to capacity.
      if (slotIndex < values.length) {
        const next = [...values];
        next[slotIndex] = incoming[0]!;
        onChangeMultiple?.(next);
        if (onLocationsChange && locations) {
          const nextLocs = [...locations];
          while (nextLocs.length < next.length) nextLocs.push(null);
          nextLocs[slotIndex] = null;
          onLocationsChange(nextLocs.slice(0, next.length));
        }
      } else {
        const room = slotCount - values.length;
        const next = [...values, ...incoming.slice(0, room)].slice(
          0,
          slotCount,
        );
        onChangeMultiple?.(next);
        if (onLocationsChange) {
          const prev = locations ?? [];
          const nextLocs = next.map((_, i) =>
            i < values.length ? (prev[i] ?? null) : null,
          );
          onLocationsChange(nextLocs);
        }
      }
    } else {
      onChange?.(selected[0] ?? null);
    }

    // Allow re-selecting the same file later.
    event.target.value = "";
  }

  function removeAt(index: number) {
    if (multiple) {
      onChangeMultiple?.(values.filter((_, i) => i !== index));
      if (onLocationsChange && locations) {
        onLocationsChange(locations.filter((_, i) => i !== index));
      }
    } else {
      onChange?.(null);
    }
  }

  function setLocationAt(index: number, next: string) {
    if (!onLocationsChange) return;
    const prev = locations ?? [];
    const aligned = values.map((_, i) => prev[i] ?? null);
    aligned[index] = next || null;
    onLocationsChange(aligned);
  }

  const showLocations =
    Boolean(locationOptions?.length) && Boolean(onLocationsChange);

  const gridClass =
    slotCount === 1
      ? "grid grid-cols-1 gap-2 max-w-[11rem]"
      : showLocations
        ? "grid grid-cols-2 gap-3"
        : "grid grid-cols-4 gap-2";

  const cameraLabelDisabled = disabled || !canAddMore;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        <span className="text-sm font-medium text-foreground">
          Photos
          {slotCount > 1 ? (
            <span className="font-normal text-muted-foreground">
              {" "}
              ({files.length}/{slotCount})
            </span>
          ) : null}
        </span>
        <span
          ref={tipRootRef}
          className="relative inline-flex"
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse") setTipOpen(true);
          }}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") setTipOpen(false);
          }}
        >
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-brand focus-visible:ring-2 focus-visible:ring-ring/40"
            aria-label="Photo lighting tip"
            aria-expanded={tipOpen}
            aria-controls={tipId}
            onClick={() => setTipOpen((v) => !v)}
          >
            <Info className="h-4 w-4" aria-hidden />
          </button>
          {tipOpen ? (
            <span
              id={tipId}
              role="tooltip"
              className="absolute left-0 top-full z-20 mt-1 w-48 rounded-lg border border-border bg-card px-3 py-2 text-xs leading-snug text-foreground shadow-md"
            >
              Ensure lighting is clear
            </span>
          ) : null}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {/*
          Label→input (not button + input.click()) so mobile Safari/Chrome honor
          capture="environment" and open the camera instead of the photo library.
        */}
        <label
          htmlFor={cameraLabelDisabled ? undefined : cameraInputId}
          onClick={handleCameraLabelClick}
          aria-disabled={cameraLabelDisabled}
          className={`flex w-full min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition hover:border-brand/40 hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
            cameraLabelDisabled
              ? "pointer-events-none cursor-not-allowed opacity-50"
              : ""
          }`}
        >
          <Camera aria-hidden className="size-5 shrink-0 text-brand" strokeWidth={2} />
          Open Camera & Snap Photo
        </label>
        <button
          type="button"
          disabled={disabled || !canAddMore}
          onClick={openLibraryPrimary}
          className="flex w-full min-h-11 items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:border-brand/40 hover:bg-brand/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50"
        >
          <ImageIcon aria-hidden className="size-4 shrink-0" strokeWidth={2} />
          Choose from library
        </button>
      </div>

      <ul
        className={gridClass}
        aria-label={`Photo slots, ${files.length} of ${slotCount} filled`}
      >
        {Array.from({ length: slotCount }, (_, index) => {
          const preview = previews[index];

          if (preview) {
            const locValue = locations?.[index] ?? "";
            const locMissing = requireLocation && !locValue;
            return (
              <li key={`filled-${preview.key}`} className="space-y-1.5">
                <div className="relative">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => openLibraryPicker(index)}
                    aria-label={`Replace photo ${index + 1} of ${slotCount}`}
                    className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview.url}
                      alt={`Selected damage photo ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => removeAt(index)}
                    aria-label={`Remove photo ${index + 1} of ${slotCount}`}
                    className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-sm font-medium text-foreground shadow-sm ring-1 ring-border disabled:opacity-50"
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </div>
                {showLocations && locationOptions ? (
                  <label className="block space-y-1">
                    <span className="sr-only">
                      Damage location for photo {index + 1}
                    </span>
                    <select
                      value={locValue}
                      disabled={disabled}
                      required={requireLocation}
                      onChange={(e) => setLocationAt(index, e.target.value)}
                      aria-invalid={locMissing || undefined}
                      className={[
                        "w-full min-h-10 rounded-lg border bg-background px-2 py-2 text-xs text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-50",
                        locMissing
                          ? "border-destructive/60"
                          : "border-border",
                      ].join(" ")}
                    >
                      <option value="">Damage location</option>
                      {locationOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </li>
            );
          }

          return (
            <li key={`empty-${index}`}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => openLibraryPicker(index)}
                aria-label={`Add photo ${index + 1} of ${slotCount}`}
                className="flex aspect-square w-full items-center justify-center rounded-xl border border-dashed border-border bg-muted text-muted-foreground transition hover:border-foreground/30 hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50"
              >
                <span aria-hidden="true" className="text-2xl font-light leading-none">
                  +
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Camera only — capture=environment; never triggered by slots/library UI. */}
      <input
        id={cameraInputId}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        disabled={disabled}
        onChange={handleFileChange}
        tabIndex={-1}
        aria-hidden
      />
      {/* Gallery only — no capture; slots + "Choose from library" only. */}
      <input
        id={libraryInputId}
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="sr-only"
        disabled={disabled}
        onChange={handleFileChange}
        tabIndex={-1}
        aria-hidden
      />
    </div>
  );
}
