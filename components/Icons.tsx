import type { ServiceIcon } from "@/lib/types";

type IconProps = { className?: string };

/**
 * Lightweight inline SVG icon set (no icon-library dependency). Stroke-based so
 * they inherit `currentColor` and stay crisp at any size.
 */
const paths: Record<ServiceIcon, string> = {
  wrench:
    "M14.7 6.3a4 4 0 00-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 005.4-5.4l-2.5 2.5-2-2 2.5-2.5z",
  flame:
    "M12 3s4 3.5 4 8a4 4 0 11-8 0c0-1.5.7-2.7 1.4-3.6C10.5 8 12 7 12 3z",
  scissors:
    "M6 6a2.5 2.5 0 105 0 2.5 2.5 0 00-5 0zm0 12a2.5 2.5 0 105 0 2.5 2.5 0 00-5 0zM9 9l11 9M9 15l11-9",
  sparkles:
    "M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3zm6 9l.9 2.1L21 15l-2.1.9L18 18l-.9-2.1L15 15l2.1-.9L18 12z",
  bolt: "M13 2L4 14h6l-1 8 9-12h-6l1-8z",
  leaf: "M4 20s2-9 9-12c5-2 8 1 8 1s-1 12-10 12c-3 0-4-1-4-1m1-1l6-6",
  tooth:
    "M8 3c1.5 0 2 1 4 1s2.5-1 4-1 3 1.5 3 4c0 3-1 5-1.5 8S18 21 17 21s-1.5-3-2-5-1-2-3-2-2.5 0-3 2-1 5-2 5-1.5-3-1.5-6S5 11 5 7s2-4 3-4z",
  car: "M5 11l1.5-4.5A2 2 0 018.4 5h7.2a2 2 0 011.9 1.5L19 11m-14 0h14m-14 0v6h2m12-6v6h-2M7 17h10M7 14h2m6 0h2",
  shield: "M12 3l8 3v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-3zm-3 8l2 2 4-4",
  star: "M12 3l2.6 5.3 5.8.85-4.2 4.1 1 5.8L12 16.3 6.8 19l1-5.8-4.2-4.1 5.8-.85L12 3z",
};

const filled: Partial<Record<ServiceIcon, boolean>> = {
  flame: true,
  star: true,
  shield: true,
  bolt: true,
  sparkles: true,
};

export function ServiceIconSvg({
  name,
  className = "h-6 w-6",
}: {
  name?: ServiceIcon;
  className?: string;
}) {
  const key = name ?? "star";
  const isFilled = filled[key];
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={isFilled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={isFilled ? 0 : 1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[key]} />
    </svg>
  );
}

export function PhoneIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.7a2 2 0 01-.5 2.1L8.1 9.8a16 16 0 006 6l1.3-1.2a2 2 0 012.1-.5c.9.3 1.8.6 2.7.7a2 2 0 011.7 2z" />
    </svg>
  );
}

export function MailIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

export function MapPinIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s7-5.6 7-11a7 7 0 10-14 0c0 5.4 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export function ClockIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function CheckIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export function ArrowRightIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
