/** @type {import('next').NextConfig} */
const nextConfig = {
  // Former screens, merged into TODAY and HISTORY.
  async redirects() {
    return [
      { source: "/breakdown", destination: "/", permanent: false },
      { source: "/timeline", destination: "/", permanent: false }
    ];
  }
};

export default nextConfig;
