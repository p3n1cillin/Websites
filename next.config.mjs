/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Serve modern formats; Next negotiates per-browser and falls back to the
    // original. AVIF first (smallest), then WebP.
    formats: ["image/avif", "image/webp"],
    // Breakpoints used to generate the srcset for responsive `fill`/`sizes`
    // images and for fixed-width content images respectively.
    deviceSizes: [360, 640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Cache optimized derivatives for 31 days (CDN + on-disk) — tenant imagery
    // changes rarely, so this cuts repeat optimization cost.
    minimumCacheTTL: 60 * 60 * 24 * 31,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "source.unsplash.com" },
      // Supabase Storage public buckets (tenant-uploaded logos / hero images).
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "*.supabase.in", pathname: "/storage/v1/object/public/**" },
    ],
  },
};

export default nextConfig;
