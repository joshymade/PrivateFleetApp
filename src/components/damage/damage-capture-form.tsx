"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { PhotoCapture } from "@/components/camera/photo-capture";
import { pageTitleClassName } from "@/components/ui/page-title";
import {
  driverNeedsProfileSetup,
  PROFILE_INCOMPLETE_MESSAGE,
} from "@/lib/auth/profile-complete";
import {
  DAMAGE_LOCATION_OPTIONS,
  sanitizeDamageLocations,
  type DamageLocationValue,
} from "@/lib/damage/locations";
import { uploadDamagePhoto } from "@/lib/damage-upload";
import { readGeolocation } from "@/lib/geolocation";
import {
  formatTractorNumber,
  isValidTractorNumber,
  TRACTOR_NUMBER_PLACEHOLDER,
} from "@/lib/tractor-number";
import { createClient } from "@/lib/supabase/client";
import type { AssetType, DamageReport, UserRole } from "@/types/database";

export type ActiveUnitLinkOption = {
  loadId: string;
  truckNumber: string | null;
  trailerNumber: string | null;
  routeNumber?: string | null;
};

type DamageCaptureFormProps = {
  /** Prefill from `?type=` when deep-linking from old tractor/trailer routes. */
  initialAssetType?: AssetType;
  /** Show success banner after redirect from submit. */
  submittedId?: string;
  /** Current active load truck/trailer for auto-select. */
  activeUnit?: ActiveUnitLinkOption | null;
};

type SubmitState = "idle" | "locating" | "uploading" | "saving";
type ActiveUnitKind = "" | "tractor" | "trailer";

const MAX_PHOTOS = 8;
const TRAILER_NUMBER_PLACEHOLDER = "313243";

export function DamageCaptureForm({
  initialAssetType = "tractor",
  submittedId,
  activeUnit = null,
}: DamageCaptureFormProps) {
  const router = useRouter();
  const [assetType, setAssetType] = useState<AssetType>(initialAssetType);
  const [assetNumber, setAssetNumber] = useState("");
  const [reportComment, setReportComment] = useState("");
  const [damageLocations, setDamageLocations] = useState<
    DamageLocationValue[]
  >([]);
  const [activeUnitKind, setActiveUnitKind] = useState<ActiveUnitKind>("");
  const [selectedLoadId, setSelectedLoadId] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoLocations, setPhotoLocations] = useState<(string | null)[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<SubmitState>("idle");

  const isTractor = assetType === "tractor";
  const isTrailer = assetType === "trailer";
  const busy = phase !== "idle";
  const assetNumberLabel =
    assetType === "tractor" ? "Tractor Number" : "Trailer Number";
  const assetNumberPlaceholder =
    assetType === "tractor"
      ? TRACTOR_NUMBER_PLACEHOLDER
      : TRAILER_NUMBER_PLACEHOLDER;
  const assetNumberHelper = isTractor
    ? `Six digits, hyphen optional (e.g. ${TRACTOR_NUMBER_PLACEHOLDER}).`
    : null;

  const currentTruck = activeUnit?.truckNumber?.trim() || null;
  const currentTrailer = activeUnit?.trailerNumber?.trim() || null;
  const hasActiveUnits = Boolean(currentTruck || currentTrailer);

  function applyActiveUnit(kind: ActiveUnitKind) {
    setActiveUnitKind(kind);
    if (!kind || !activeUnit) {
      setSelectedLoadId("");
      return;
    }
    if (kind === "tractor" && currentTruck) {
      const typeChanged = assetType !== "tractor";
      setAssetType("tractor");
      setAssetNumber(formatTractorNumber(currentTruck));
      setSelectedLoadId(activeUnit.loadId);
      if (typeChanged) {
        setDamageLocations([]);
        setPhotoLocations([]);
        setPhotos([]);
      }
      setError(null);
      return;
    }
    if (kind === "trailer" && currentTrailer) {
      const typeChanged = assetType !== "trailer";
      setAssetType("trailer");
      setAssetNumber(currentTrailer);
      setSelectedLoadId(activeUnit.loadId);
      if (typeChanged) {
        setPhotos([]);
        setPhotoLocations([]);
        setDamageLocations([]);
      }
      setError(null);
    }
  }

  function handleAssetTypeChange(next: AssetType) {
    if (next === assetType) return;
    setAssetType(next);
    setAssetNumber("");
    setPhotos([]);
    setPhotoLocations([]);
    setDamageLocations([]);
    setActiveUnitKind("");
    setSelectedLoadId("");
    setError(null);
  }

  function handleAssetNumberChange(raw: string) {
    if (assetType === "tractor") {
      setAssetNumber(formatTractorNumber(raw));
    } else {
      setAssetNumber(raw);
    }
    if (activeUnitKind) setActiveUnitKind("");
  }

  function handlePhotosChange(next: File[]) {
    setPhotos(next);
    setPhotoLocations((prev) => {
      const aligned = next.map((_, i) => prev[i] ?? null);
      return aligned;
    });
  }

  function toggleReportLocation(value: DamageLocationValue) {
    setDamageLocations((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedAsset = assetNumber.trim();
    const trimmedComment = reportComment.trim();
    const files = photos.slice(0, MAX_PHOTOS);

    if (!trimmedAsset) {
      setError(
        isTractor
          ? "Tractor number is required."
          : "Trailer number is required.",
      );
      return;
    }
    if (isTractor && !isValidTractorNumber(trimmedAsset)) {
      setError(
        `Tractor number must be exactly 6 digits (e.g. ${TRACTOR_NUMBER_PLACEHOLDER}).`,
      );
      return;
    }
    if (files.length === 0) {
      setError("Add at least one damage photo before submitting.");
      return;
    }
    if (!trimmedComment) {
      setError("Describe the damage in the report comment.");
      return;
    }

    if (isTrailer) {
      const missing = files.some((_, i) => !photoLocations[i]?.trim());
      if (missing) {
        setError("Select a damage location for each photo.");
        return;
      }
    }

    const photoLocs = isTrailer
      ? files.map((_, i) => photoLocations[i] as DamageLocationValue)
      : [];
    const reportLocs = isTrailer
      ? sanitizeDamageLocations([
          ...damageLocations,
          ...photoLocs,
        ])
      : [];

    setPhase("locating");

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setError("Sign in as a driver to submit a damage report.");
        setPhase("idle");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("driver_id, role, full_name, work_state")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        setError(profileError.message);
        setPhase("idle");
        return;
      }

      if (profile?.role && profile.role !== "driver") {
        setError("Only drivers can submit damage reports.");
        setPhase("idle");
        return;
      }

      if (
        driverNeedsProfileSetup(
          (profile?.role as UserRole | undefined) ?? "driver",
          profile,
        )
      ) {
        setError(PROFILE_INCOMPLETE_MESSAGE);
        setPhase("idle");
        return;
      }

      let loadId: string | null = null;
      let routeNumber: string | null = null;

      if (selectedLoadId && activeUnit?.loadId === selectedLoadId) {
        loadId = selectedLoadId;
        routeNumber = activeUnit.routeNumber ?? null;
      }

      const geo = await readGeolocation();
      const capturedAt = new Date().toISOString();

      setPhase("uploading");
      const uploaded: { r2Key: string; r2Url: string | null }[] = [];
      for (const file of files) {
        const result = await uploadDamagePhoto({
          file,
          assetType,
          assetNumber: trimmedAsset,
        });
        uploaded.push(result);
      }

      const cover = uploaded[0];
      if (!cover) {
        setError("Photo upload failed.");
        setPhase("idle");
        return;
      }

      setPhase("saving");
      const insertPayload = {
        asset_type: assetType,
        asset_number: trimmedAsset,
        driver_id: profile?.driver_id ?? null,
        reported_by: user.id,
        load_id: loadId,
        route_number: routeNumber,
        latitude: geo?.latitude ?? null,
        longitude: geo?.longitude ?? null,
        captured_at: capturedAt,
        r2_key: cover.r2Key,
        r2_url: cover.r2Url,
        report_comment: trimmedComment,
        damage_locations: reportLocs,
      };

      const { data: report, error: insertError } = await supabase
        .from("damage_reports")
        .insert(insertPayload)
        .select("id")
        .single();

      if (insertError) {
        setError(insertError.message);
        setPhase("idle");
        return;
      }

      const row = report as Pick<DamageReport, "id">;

      const photoRows = uploaded.map((u, index) => ({
        damage_report_id: row.id,
        r2_key: u.r2Key,
        r2_url: u.r2Url,
        sort_order: index,
        damage_location: isTrailer ? photoLocs[index] ?? null : null,
      }));

      const { error: photosError } = await supabase
        .from("damage_report_photos")
        .insert(photoRows);

      if (photosError) {
        setError(photosError.message);
        setPhase("idle");
        return;
      }

      setPhase("idle");
      router.push(`/feed/${row.id}`);
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Submit failed";
      if (
        err instanceof TypeError &&
        /failed to fetch|networkerror|load failed/i.test(message)
      ) {
        setError(
          "Network error during upload. If this persists, check R2 CORS for http://localhost:3000 (docs/r2-setup.md).",
        );
      } else {
        setError(message);
      }
      setPhase("idle");
    }
  }

  const statusLabel =
    phase === "locating"
      ? "Getting location…"
      : phase === "uploading"
        ? photos.length > 1
          ? "Uploading photos…"
          : "Uploading photo…"
        : phase === "saving"
          ? "Saving report…"
          : null;

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-lg space-y-6 p-6">
      <header className="space-y-1">
        <h1 className={pageTitleClassName}>Report Asset Damage</h1>
        <p className="text-sm text-muted-foreground">
          Log new vehicle or trailer defects. Photos will automatically be tagged
          with your Driver ID, timestamp, and GPS location. Other drivers can see
          your reports in the feed, and you can submit them to Safety for notice.
        </p>
      </header>

      {submittedId ? (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          Report saved.{" "}
          <Link
            href={`/feed/${submittedId}`}
            className="font-medium underline underline-offset-2"
          >
            View in Feed
          </Link>
        </p>
      ) : null}

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-foreground">
          Asset Selection
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { value: "tractor", label: "Tractor" },
              { value: "trailer", label: "Trailer" },
            ] as const
          ).map(({ value, label }) => {
            const selected = assetType === value;
            return (
              <label
                key={value}
                className={[
                  "flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-semibold transition",
                  selected
                    ? "border-brand bg-brand/10 text-foreground ring-2 ring-accent/40"
                    : "border-border bg-card text-muted-foreground hover:border-brand/40 hover:bg-brand/5",
                  busy ? "opacity-50" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <input
                  type="radio"
                  name="assetType"
                  value={value}
                  checked={selected}
                  disabled={busy}
                  onChange={() => handleAssetTypeChange(value)}
                  className="size-4 accent-brand"
                />
                {label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-2">
        <label
          htmlFor="asset-number"
          className="block text-sm font-medium text-foreground"
        >
          {assetNumberLabel}
        </label>
        <input
          key={assetType}
          id="asset-number"
          name="assetNumber"
          value={assetNumber}
          onChange={(e) => handleAssetNumberChange(e.target.value)}
          disabled={busy}
          autoComplete="off"
          inputMode={isTractor ? "numeric" : "text"}
          placeholder={assetNumberPlaceholder}
          maxLength={isTractor ? 7 : undefined}
          aria-label={assetNumberLabel}
          className="w-full rounded-lg border border-border bg-background px-3 py-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
        {assetNumberHelper ? (
          <p className="text-xs text-muted-foreground">{assetNumberHelper}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <span
          id="active-unit-label"
          className="block text-sm font-medium text-foreground"
        >
          Link to Active Trailer/Tractor{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </span>
        <ActiveUnitSelect
          truckNumber={currentTruck}
          trailerNumber={currentTrailer}
          value={activeUnitKind}
          onChange={applyActiveUnit}
          disabled={busy || !hasActiveUnits}
          labelledBy="active-unit-label"
        />
        {!hasActiveUnits ? (
          <p className="text-xs text-muted-foreground">
            No active truck or trailer on file. Enter the number manually above.
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="report-comment"
          className="block text-sm font-medium text-foreground"
        >
          Damage description
        </label>
        <textarea
          id="report-comment"
          name="reportComment"
          value={reportComment}
          onChange={(e) => setReportComment(e.target.value)}
          disabled={busy}
          required
          rows={4}
          placeholder="Describe what you see (location on unit, severity, etc.)"
          className="w-full resize-y rounded-lg border border-border bg-background px-3 py-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </div>

      <fieldset className="space-y-3" aria-disabled={!isTrailer || busy}>
        <legend className="text-sm font-medium text-foreground">
          Damage location{" "}
          <span className="font-normal text-muted-foreground">
            {isTrailer ? "(optional)" : "(trailer only)"}
          </span>
        </legend>
        {isTrailer ? (
          <p className="text-xs text-muted-foreground">
            Tag areas for the report. Each photo below still needs its own
            location.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Select{" "}
            <button
              type="button"
              disabled={busy}
              onClick={() => handleAssetTypeChange("trailer")}
              className="font-medium text-foreground underline underline-offset-2 disabled:opacity-50"
            >
              Trailer
            </button>{" "}
            above to tag damage areas and set a location on each photo.
          </p>
        )}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DAMAGE_LOCATION_OPTIONS.map((opt) => {
            const checked = isTrailer && damageLocations.includes(opt.value);
            const locationDisabled = busy || !isTrailer;
            return (
              <label
                key={opt.value}
                className={[
                  "flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition",
                  locationDisabled
                    ? "cursor-not-allowed border-border/70 bg-muted/40 text-muted-foreground"
                    : checked
                      ? "cursor-pointer border-brand bg-brand/10 text-foreground"
                      : "cursor-pointer border-border bg-card text-foreground hover:border-brand/40",
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={locationDisabled}
                  onChange={() => toggleReportLocation(opt.value)}
                  className="size-4 shrink-0 accent-brand disabled:opacity-60"
                />
                <span>{opt.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <PhotoCapture
        multiple
        values={photos}
        onChangeMultiple={handlePhotosChange}
        disabled={busy}
        maxFiles={MAX_PHOTOS}
        locationOptions={isTrailer ? [...DAMAGE_LOCATION_OPTIONS] : undefined}
        locations={isTrailer ? photoLocations : undefined}
        onLocationsChange={isTrailer ? setPhotoLocations : undefined}
        requireLocation={isTrailer}
      />

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {statusLabel ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {statusLabel}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Submitting…" : "Submit & Upload Report"}
      </button>
    </form>
  );
}

type ActiveUnitSelectProps = {
  truckNumber: string | null;
  trailerNumber: string | null;
  value: ActiveUnitKind;
  onChange: (kind: ActiveUnitKind) => void;
  disabled?: boolean;
  labelledBy: string;
};

function ActiveUnitSelect({
  truckNumber,
  trailerNumber,
  value,
  onChange,
  disabled,
  labelledBy,
}: ActiveUnitSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function selectValue(next: ActiveUnitKind) {
    onChange(next);
    setOpen(false);
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    }
  }

  const triggerText =
    value === "tractor" && truckNumber
      ? `Tractor ${truckNumber}`
      : value === "trailer" && trailerNumber
        ? `Trailer ${trailerNumber}`
        : "Don't link active unit";

  const selectedIsActive = value === "tractor" || value === "trailer";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id="active-unit-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={labelledBy}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
        className={[
          "flex w-full min-h-12 items-center justify-between gap-2 rounded-lg border bg-background px-3 py-3 text-left text-base outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-50",
          selectedIsActive
            ? "border-accent font-bold text-accent"
            : "border-border font-normal text-foreground",
        ].join(" ")}
      >
        <span className="min-w-0 flex-1 truncate">{triggerText}</span>
        <span className="shrink-0 text-muted-foreground" aria-hidden>
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={labelledBy}
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-card py-1 shadow-lg"
        >
          <li role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={!value}
              className={[
                "flex w-full px-3 py-2.5 text-left text-sm",
                !value
                  ? "bg-brand/10 font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/60",
              ].join(" ")}
              onClick={() => selectValue("")}
            >
              Don&apos;t link active unit
            </button>
          </li>
          {truckNumber ? (
            <li role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={value === "tractor"}
                className={[
                  "flex w-full flex-col gap-0.5 px-3 py-2.5 text-left text-sm",
                  value === "tractor"
                    ? "bg-accent/15 font-bold text-accent ring-1 ring-inset ring-accent/40"
                    : "text-foreground hover:bg-muted/60",
                ].join(" ")}
                onClick={() => selectValue("tractor")}
              >
                <span>★ Tractor {truckNumber}</span>
                <span className="text-xs font-medium text-accent/70">
                  Current truck
                </span>
              </button>
            </li>
          ) : null}
          {trailerNumber ? (
            <li role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={value === "trailer"}
                className={[
                  "flex w-full flex-col gap-0.5 px-3 py-2.5 text-left text-sm",
                  value === "trailer"
                    ? "bg-accent/15 font-bold text-accent ring-1 ring-inset ring-accent/40"
                    : "text-foreground hover:bg-muted/60",
                ].join(" ")}
                onClick={() => selectValue("trailer")}
              >
                <span>★ Trailer {trailerNumber}</span>
                <span className="text-xs font-medium text-accent/70">
                  Current trailer
                </span>
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
