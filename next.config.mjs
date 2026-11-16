/** @type {import('next').NextConfig} */
const nextConfig = {
  // The launcher builds into its own folder so it never clashes with "next dev".
  distDir: process.env.CHRONO_DIST || ".next",
  // Former screens, merged into TODAY and HISTORY.
  async redirects() {
    return [
      { source: "/breakdown", destination: "/", permanent: false },
      { source: "/timeline", destination: "/", permanent: false }
    ];
  }
};

export default nextConfig;
