
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'export', // Add this line for static export
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
    unoptimized: true, // Required for static export with next/image
  },
  experimental: {
    allowedDevOrigins: [
      "https://6000-firebase-studio-1747935835035.cluster-ejd22kqny5htuv5dfowoyipt52.cloudworkstations.dev"
    ],
  },
};

export default nextConfig;

    