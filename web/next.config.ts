import type { NextConfig } from "next";

/* A static export: FastAPI serves the built files at "/", on the same origin
   as the API, so there is one deployment and no cross-origin setup. During
   `next dev`, set NEXT_PUBLIC_ISNAD_API_BASE to the running API. */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default nextConfig;
