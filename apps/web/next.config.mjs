/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@absolute-ice-cream/shared', '@absolute-ice-cream/ui'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/**'
      }
    ],
    unoptimized: true
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  typescript: {
    ignoreBuildErrors: false
  }
};

export default nextConfig;
