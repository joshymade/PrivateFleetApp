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
import { uploadDamagePhoto } from "@/lib/damage-upload";
import { readGeolocation } from "@/lib/geolocation";
import { formatShortDate } from "@/lib/loads/date";
import { formatLoadLabel } from "@/lib/loads/format";
import type { RecentLoadOption } from "@/lib/loads/queries";
import { createClient } from "@/lib/supabase/client";
import {
  formatTractorNumber,
  isValidTractorNumber,
  TRACTOR_NUMBER_PLACEHOLDER,
} from "@/lib/tractor-number";
import type { AssetType, DamageReport, UserRole } from "@/types/database";

type DamageCaptureFormProps = {
  /** Prefill from `?type=` when deep-linking from old tractor/trailer routes. */
  initialAssetType?: AssetType;
  /** Show success banner after redirect from submit. */
  submittedId?: string;
  /** Driver's recent loads for optional linking (server-fetched). */
  recentLoads?: RecentLoadOption[];
};

type SubmitState = "idle" | "locating" | "uploading" | "saving";

const MAX_PHOTOS = 8;
const TRAILER_NUMBER_PLACEHOLDER = "313243";

function loadOptionLabel(load: RecentLoadOption): string {
  const date = formatShortDate(load.load_date);
  const route = load.route_number ? ` · Route ${load.route_number}` : "";
  return `${formatLoadLabel(load.load_number)} · ${date}${route}`;
}

export function DamageCaptureForm({
  initialAssetType = "tractor",
  submittedId,
  recentLoads = [],
}: DamageCaptureFormProps) {
  const router = useRouter();
  const [assetType, setAssetType] = useState<AssetType>(initialAssetType);
  const [assetNumber, setAssetNumber] = useState("");
  const [reportComment, setReportComment] = useState("");
  const [selectedLoadId, setSelectedLoadId] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<SubmitState>("idle");

  const isTractor = assetType === "tractor";
  const busy = phase !== "idle";
  // Label/placeholder MUST follow radio state — never a combined "Tractor or Trailer" string.
  const assetNumberLabel =
    assetType === "tractor" ? "Tractor Number" : "Trailer Number";
  const assetNumberPlaceholder =
    assetType === "tractor"
      ? TRACTOR_NUMBER_PLACEHOLDER
      : TRAILER_NUMBER_PLACEHOLDER;
  const assetNumberHelper = isTractor
    ? `Six digits, hyphen optional (e.g. ${TRACTOR_NUMBER_PLACEHOLDER}).`
    : null;

  const currentLoad = recentLoads.find((l) => l.isCurrent) ?? null;

  useEffect(() => {
    setAssetType(initialAssetType);
  }, [initialAssetType]);

  useEffect(() => {
    if (!submittedId) return;
    setAssetNumber("");
    setReportComment("");
    setSelectedLoadId("");
    setPhotos([]);
    setError(null);
  }, [submittedId]);

  function handleAssetTypeChange(next: AssetType) {
    if (next === assetType) return;
    setAssetType(next);
    setAssetNumber("");
    setPhotos([]);
    setError(null);
  }

  function handleAssetNumberChange(raw: string) {
    if (assetType === "tractor") {
      setAssetNumber(formatTractorNumber(raw));
      return;
    }
    setAssetNumber(raw);
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

      if (selectedLoadId) {
        const linked = recentLoads.find((l) => l.id === selectedLoadId);
        if (!linked) {
          setError("Selected load is no longer available. Pick another or None.");
          setPhase("idle");
          return;
        }
        loadId = linked.id;
        routeNumber = linked.route_number ?? null;
      }

      // Hidden metadata for canvas export / Feed (not shown as editable fields).
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
      // TypeError "Failed to fetch" from a bare fetch (should be rare after
      // uploadDamagePhoto wrapping) — point at CORS / network.
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
          id="load-link-label"
          className="block text-sm font-medium text-foreground"
        >
          Link to Active Load Number{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </span>
        <LoadLinkSelect
          loads={recentLoads}
          value={selectedLoadId}
          onChange={setSelectedLoadId}
          disabled={busy}
          labelledBy="load-link-label"
          currentLoadId={currentLoad?.id ?? null}
        />
      </div>

      <PhotoCapture
        multiple
        values={photos}
        onChangeMultiple={setPhotos}
        disabled={busy}
        maxFiles={MAX_PHOTOS}
      />

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

type LoadLinkSelectProps = {
  loads: RecentLoadOption[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  labelledBy: string;
  currentLoadId: string | null;
};

function LoadLinkSelect({
  loads,
  value,
  onChange,
  disabled,
  labelledBy,
  currentLoadId,
}: LoadLinkSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const selected = loads.find((l) => l.id === value) ?? null;
  const selectedIsCurrent = Boolean(selected?.isCurrent);

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

  function selectValue(next: string) {
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

  const triggerText = selected
    ? selected.isCurrent
      ? `${loadOptionLabel(selected)} (current)`
      : loadOptionLabel(selected)
    : "Don't link a load";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id="load-link-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={labelledBy}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
        className={[
          "flex w-full min-h-12 items-center justify-between gap-2 rounded-lg border bg-background px-3 py-3 text-left text-base outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-50",
          selectedIsCurrent
            ? "border-accent text-accent font-bold"
            : "border-border text-foreground font-normal",
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
              Don&apos;t link a load
            </button>
          </li>
          {loads.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-muted-foreground">
              No recent loads found.
            </li>
          ) : (
            loads.map((load) => {
              const isSelected = value === load.id;
              const isCurrent = load.id === currentLoadId || load.isCurrent;
              return (
                <li key={load.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={[
                      "flex w-full flex-col gap-0.5 px-3 py-2.5 text-left text-sm",
                      isCurrent
                        ? "bg-accent/15 font-bold text-accent ring-1 ring-inset ring-accent/40"
                        : isSelected
                          ? "bg-brand/10 text-foreground"
                          : "text-foreground hover:bg-muted/60",
                    ].join(" ")}
                    onClick={() => selectValue(load.id)}
                  >
                    <span
                      className={
                        isCurrent ? "font-bold text-accent" : undefined
                      }
                    >
                      {isCurrent ? "★ " : ""}
                      {formatLoadLabel(load.load_number)}
                      {isCurrent ? " (current)" : ""}
                    </span>
                    <span
                      className={
                        isCurrent
                          ? "text-xs font-medium text-accent/70"
                          : "text-xs font-normal text-muted-foreground"
                      }
                    >
                      {formatShortDate(load.load_date)}
                      {load.route_number ? ` · Route ${load.route_number}` : ""}
                      {load.status === "active" ? " · Active" : ""}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}

      {/* Keep a native select for progressive enhancement / form semantics */}
      <select
        name="loadId"
        value={value}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Don&apos;t link a load</option>
        {loads.map((load) => (
          <option key={load.id} value={load.id}>
            {load.isCurrent
              ? `★ ${formatLoadLabel(load.load_number)} (current)`
              : formatLoadLabel(load.load_number)}
          </option>
        ))}
      </select>
    </div>
  );
}
