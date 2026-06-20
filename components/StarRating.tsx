interface StarRatingProps {
  value: number;
  /** Tailwind size class, e.g. "h-5 w-5". */
  size?: string;
  className?: string;
}

function Star({ fill }: { fill: number }) {
  // fill: 0..1 fraction of the star to colour.
  const id = `star-${Math.random().toString(36).slice(2)}`;
  return (
    <svg viewBox="0 0 20 20" className="inline-block" aria-hidden="true">
      <defs>
        <linearGradient id={id}>
          <stop offset={`${fill * 100}%`} stopColor="currentColor" />
          <stop offset={`${fill * 100}%`} stopColor="currentColor" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id})`}
        d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L10 15.77l-5.2 2.73.99-5.79L1.58 8.62l5.82-.85L10 1.5z"
      />
    </svg>
  );
}

export default function StarRating({
  value,
  size = "h-4 w-4",
  className = "",
}: StarRatingProps) {
  return (
    <span
      className={`inline-flex text-amber-400 ${className}`}
      role="img"
      aria-label={`${value} out of 5 stars`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={size}>
          <Star fill={Math.max(0, Math.min(1, value - i))} />
        </span>
      ))}
    </span>
  );
}
