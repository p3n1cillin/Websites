import Image, { type ImageProps } from "next/image";
import { BLUR_DATA_URL } from "@/lib/images";

/**
 * Drop-in wrapper around `next/image` with the project's sensible defaults:
 * a lightweight blur placeholder (so images fade in rather than popping) and a
 * reasonable `sizes` fallback for `fill` usage. Everything is overridable — pass
 * any `next/image` prop through. Use this for content/remote imagery; keep using
 * `next/image` directly where you need fine-grained control (e.g. the animated
 * hero).
 *
 * Optimization (AVIF/WebP, responsive srcset, caching) is inherited from the
 * Next image optimizer configured in next.config.mjs.
 */
export default function SmartImage({
  placeholder = "blur",
  blurDataURL = BLUR_DATA_URL,
  sizes,
  fill,
  ...props
}: ImageProps) {
  return (
    <Image
      {...props}
      fill={fill}
      placeholder={placeholder}
      blurDataURL={blurDataURL}
      // A safe default only when using `fill` and no explicit sizes was given.
      sizes={sizes ?? (fill ? "100vw" : undefined)}
    />
  );
}
