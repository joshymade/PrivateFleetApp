import { MapPin } from "lucide-react";

export function googleMapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

type LocationLinkProps = {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  /**
   * When coords are missing: `"muted"` shows “No location”; `"hide"` renders nothing.
   * @default "muted"
   */
  empty?: "muted" | "hide";
  className?: string;
  iconClassName?: string;
};

/**
 * Brand-colored MapPin + “Location” link to Google Maps.
 * Does not show raw coordinates.
 */
export function LocationLink({
  latitude,
  longitude,
  empty = "muted",
  className,
  iconClassName,
}: LocationLinkProps) {
  const hasLocation = latitude != null && longitude != null;

  if (!hasLocation) {
    if (empty === "hide") return null;
    return <span className="text-muted-foreground">No location</span>;
  }

  return (
    <a
      href={googleMapsUrl(latitude, longitude)}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ??
        "inline-flex items-center gap-1 font-medium text-brand underline-offset-2 hover:underline"
      }
    >
      <MapPin
        className={iconClassName ?? "size-3.5 shrink-0"}
        aria-hidden
      />
      Location
    </a>
  );
}
