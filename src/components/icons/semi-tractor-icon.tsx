import type { SVGProps } from "react";

type SemiTractorIconProps = SVGProps<SVGSVGElement> & {
  size?: number | string;
  strokeWidth?: number | string;
};

/**
 * Side-view modern sleeper-cab semi tractor (no trailer) — Lucide-compatible.
 * Sloping hood, grille, headlights, windshield, door, mirror, high roof
 * fairing, side skirt, steer + tandem drive, fifth-wheel stub.
 */
export function SemiTractorIcon({
  size = 24,
  strokeWidth = 1.5,
  className,
  ...props
}: SemiTractorIconProps) {
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
      {/* Soft body fill — full tractor silhouette */}
      <path
        d="M2.5 13.4V10.8c0-1.4.8-2.7 2.1-3.5L9 5.2h5.2V3.7c0-.5.3-.9.8-1.05L18.6 1.5c.55-.15 1.15.12 1.4.65L21.5 5h6.2l2.6-3.4c.35-.45.95-.65 1.5-.45l4.6 1.55c.5.17.85.7.8 1.25L36.8 7.2H44v6.2H2.5z"
        fill="currentColor"
        fillOpacity={0.12}
        stroke="none"
      />

      {/* Outer body outline: bumper → hood → cab → sleeper fairing → chassis */}
      <path d="M2.5 13.4V10.9c0-1.35.75-2.6 2-3.4L9 5.2h5.2V3.75c0-.5.32-.92.8-1.08L18.6 1.55c.52-.14 1.1.12 1.35.62L21.5 5" />
      <path d="M21.5 5h6.2l2.55-3.35c.32-.42.9-.6 1.42-.42l4.55 1.52c.48.16.8.66.75 1.18L36.8 7.2H44" />
      <path d="M44 7.2v6.2H2.5" />

      {/* Rounded grille */}
      <rect x="2.85" y="9.15" width="2.55" height="3.55" rx="0.6" />
      <path d="M3.35 10.3h1.55M3.35 11.45h1.55" strokeOpacity={0.65} />

      {/* Headlight on fender curve */}
      <path d="M6.4 8.35c1-.5 2.15-.35 2.9.45" />

      {/* Windshield */}
      <path
        d="M10.2 5.7h3.5v5.35h-3.5z"
        fill="currentColor"
        fillOpacity={0.1}
      />
      <path d="M10.2 5.7h3.5v5.35h-3.5z" />

      {/* Door + window */}
      <path d="M13.7 5.2v8.2h6.8V5.2" />
      <path
        d="M14.65 6.2h4.7v3.7h-4.7z"
        fill="currentColor"
        fillOpacity={0.1}
      />
      <path d="M14.65 6.2h4.7v3.7h-4.7z" />
      <path d="M18.55 10.7h1.25" strokeOpacity={0.6} />

      {/* Side mirror */}
      <path d="M13.7 7.05H11.35V9.1" />
      <path d="M11.35 7.05H10.3" />

      {/* Sleeper window */}
      <path
        d="M31.1 6.05h2.7v2.85h-2.7z"
        fill="currentColor"
        fillOpacity={0.1}
      />
      <path d="M31.1 6.05h2.7v2.85h-2.7z" />
      {/* Fairing crease */}
      <path d="M29.9 4.85 31.5 7.2" strokeOpacity={0.5} />

      {/* Side skirt */}
      <path d="M8.6 13.4h24.4c.9 0 1.7.52 2.05 1.35l.75 1.7H9.7l-1.1-3.05z" />
      <path
        d="M8.95 13.6h23.8c.7 0 1.3.4 1.55 1.05l.55 1.25H10l-1.05-2.3z"
        fill="currentColor"
        fillOpacity={0.1}
        stroke="none"
      />

      {/* Fifth-wheel stub behind sleeper */}
      <path d="M44 11.5H53" />
      <path d="M47.6 11.5v2.85" />
      <path d="M45.7 14.35h3.8" />

      {/* Steer axle */}
      <circle cx="11.6" cy="18.05" r="2.6" />
      <circle
        cx="11.6"
        cy="18.05"
        r="1"
        fill="currentColor"
        fillOpacity={0.28}
      />

      {/* Tandem drive axles */}
      <circle cx="26.2" cy="18.05" r="2.6" />
      <circle
        cx="26.2"
        cy="18.05"
        r="1"
        fill="currentColor"
        fillOpacity={0.28}
      />
      <circle cx="33" cy="18.05" r="2.6" />
      <circle
        cx="33"
        cy="18.05"
        r="1"
        fill="currentColor"
        fillOpacity={0.28}
      />
    </svg>
  );
}
