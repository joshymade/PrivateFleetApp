import type { SVGProps } from "react";

type SemiTruckIconProps = SVGProps<SVGSVGElement> & {
  size?: number | string;
  strokeWidth?: number | string;
};

/**
 * Side-view semi truck (tractor + dry-van trailer) — Lucide-compatible.
 * Compact cab, fifth-wheel gap, box trailer, steer + drive + rear tandem.
 */
export function SemiTruckIcon({
  size = 24,
  strokeWidth = 1.5,
  className,
  ...props
}: SemiTruckIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 56 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      {...props}
    >
      {/* Soft fill — cab + trailer silhouette */}
      <path
        d="M2.2 13.2V10.6c0-.9.5-1.75 1.3-2.2L6.8 6.5h3.4V5.1c0-.35.2-.65.5-.78L13.2 3.5c.35-.12.75.08.9.42L15 6.5h3.2l1.1-1.5c.2-.28.55-.4.9-.3l2.2.75c.3.1.5.4.48.72L22.6 8.2H23v5H2.2z"
        fill="currentColor"
        fillOpacity={0.12}
        stroke="none"
      />
      <rect
        x="23.5"
        y="4"
        width="30"
        height="9.2"
        rx="0.4"
        fill="currentColor"
        fillOpacity={0.12}
        stroke="none"
      />

      {/* Cab: bumper → hood → windshield → roof */}
      <path d="M2.2 13.2V10.7c0-.85.48-1.65 1.25-2.1L6.8 6.5h3.4V5.15c0-.32.18-.6.48-.72L13.2 3.55c.32-.11.7.08.85.4L15 6.5" />
      <path d="M15 6.5h3.2l1.05-1.45c.18-.25.5-.36.8-.28l2.15.72c.28.1.46.38.44.68L22.6 8.2H23" />
      <path d="M23 8.2v5H2.2" />

      {/* Grille */}
      <rect x="2.55" y="9.35" width="1.9" height="2.7" rx="0.4" />

      {/* Windshield */}
      <path
        d="M7.5 6.9h2.4v4.4H7.5z"
        fill="currentColor"
        fillOpacity={0.1}
      />
      <path d="M7.5 6.9h2.4v4.4H7.5z" />

      {/* Door window */}
      <path
        d="M10.4 6.9h3.6v2.8h-3.6z"
        fill="currentColor"
        fillOpacity={0.1}
      />
      <path d="M10.4 6.9h3.6v2.8h-3.6z" />

      {/* Side mirror */}
      <path d="M10.2 7.6H8.5V9" />

      {/* Fifth-wheel / hitch */}
      <path d="M23 11.2h1.2" />

      {/* Trailer box */}
      <rect x="23.5" y="4" width="30" height="9.2" rx="0.4" />
      <path d="M25.6 4v9.2" />
      <path d="M33 4.35v8.5" strokeOpacity={0.45} />
      <path d="M40.5 4.35v8.5" strokeOpacity={0.45} />

      {/* Trailer side door hint */}
      <rect x="44.5" y="5" width="6.5" height="7.2" rx="0.2" />
      <path d="M47.75 5v7.2" />

      {/* Lower rails */}
      <path d="M6.5 13.2h15.5" strokeOpacity={0.65} />
      <path d="M25.5 13.2H51.5" strokeOpacity={0.65} />

      {/* Landing gear */}
      <path d="M28.2 13.2v3.2" />
      <path d="M29.8 13.2v3.2" />
      <path d="M27.6 16.4h2.8" />

      {/* Rear underrun */}
      <path d="M53.5 13.2v2.6H51" />

      {/* Steer axle */}
      <circle cx="8.2" cy="18" r="2.35" />
      <circle
        cx="8.2"
        cy="18"
        r="0.85"
        fill="currentColor"
        fillOpacity={0.28}
      />

      {/* Drive axle */}
      <circle cx="18.5" cy="18" r="2.35" />
      <circle
        cx="18.5"
        cy="18"
        r="0.85"
        fill="currentColor"
        fillOpacity={0.28}
      />

      {/* Trailer tandem */}
      <circle cx="44.5" cy="18" r="2.35" />
      <circle
        cx="44.5"
        cy="18"
        r="0.85"
        fill="currentColor"
        fillOpacity={0.28}
      />
      <circle cx="50.2" cy="18" r="2.35" />
      <circle
        cx="50.2"
        cy="18"
        r="0.85"
        fill="currentColor"
        fillOpacity={0.28}
      />
    </svg>
  );
}
