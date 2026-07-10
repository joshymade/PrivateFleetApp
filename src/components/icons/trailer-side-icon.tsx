import type { SVGProps } from "react";

type TrailerSideIconProps = SVGProps<SVGSVGElement> & {
  size?: number | string;
  strokeWidth?: number | string;
};

/**
 * Side-view dry-van trailer — Lucide-compatible.
 * Box body, panel seams, side doors with locking bars, landing gear, rear tandem.
 */
export function TrailerSideIcon({
  size = 24,
  strokeWidth = 1.5,
  className,
  ...props
}: TrailerSideIconProps) {
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
      {/* Soft body fill */}
      <rect
        x="3"
        y="4"
        width="48"
        height="10.6"
        rx="0.5"
        fill="currentColor"
        fillOpacity={0.12}
        stroke="none"
      />

      {/* Outer box */}
      <rect x="3" y="4" width="48" height="10.6" rx="0.5" />

      {/* Front face */}
      <path d="M5.4 4v10.6" />

      {/* Vertical panel seams */}
      <path d="M13 4.4v9.8" strokeOpacity={0.5} />
      <path d="M21 4.4v9.8" strokeOpacity={0.5} />
      <path d="M29 4.4v9.8" strokeOpacity={0.5} />

      {/* Rivet hints along top rail */}
      <circle cx="13" cy="5.4" r="0.35" fill="currentColor" stroke="none" />
      <circle cx="13" cy="7.6" r="0.35" fill="currentColor" stroke="none" />
      <circle cx="13" cy="9.8" r="0.35" fill="currentColor" stroke="none" />
      <circle cx="13" cy="12" r="0.35" fill="currentColor" stroke="none" />
      <circle cx="21" cy="5.4" r="0.35" fill="currentColor" stroke="none" />
      <circle cx="21" cy="7.6" r="0.35" fill="currentColor" stroke="none" />
      <circle cx="21" cy="9.8" r="0.35" fill="currentColor" stroke="none" />
      <circle cx="21" cy="12" r="0.35" fill="currentColor" stroke="none" />
      <circle cx="29" cy="5.4" r="0.35" fill="currentColor" stroke="none" />
      <circle cx="29" cy="7.6" r="0.35" fill="currentColor" stroke="none" />
      <circle cx="29" cy="9.8" r="0.35" fill="currentColor" stroke="none" />
      <circle cx="29" cy="12" r="0.35" fill="currentColor" stroke="none" />

      {/* Side doors (rear third) + locking bars */}
      <rect x="34" y="5" width="11" height="8.6" rx="0.25" />
      <path d="M39.5 5v8.6" />
      <path d="M36.2 5.6v7.4" />
      <path d="M42.8 5.6v7.4" />
      <path d="M35.4 8h1.6M35.4 10.6h1.6" />
      <path d="M42 8h1.6M42 10.6h1.6" />

      {/* Kingpin stub */}
      <path d="M3 9.2H1.5" />

      {/* Landing gear */}
      <path d="M10 14.6v3.4" />
      <path d="M12.4 14.6v3.4" />
      <path d="M10 14.6h2.4" />
      <path d="M9.2 18h4" />

      {/* Lower rail */}
      <path d="M8 14.6H49" strokeOpacity={0.65} />

      {/* Rear underrun guard */}
      <path d="M51 14.6v3H48" />

      {/* Rear tandem */}
      <circle cx="41" cy="18.1" r="2.4" />
      <circle
        cx="41"
        cy="18.1"
        r="0.9"
        fill="currentColor"
        fillOpacity={0.25}
      />
      <circle cx="47" cy="18.1" r="2.4" />
      <circle
        cx="47"
        cy="18.1"
        r="0.9"
        fill="currentColor"
        fillOpacity={0.25}
      />
    </svg>
  );
}
