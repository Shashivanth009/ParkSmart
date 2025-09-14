
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'standalone', // Changed from 'export' for better deployment compatibility
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
  },
  experimental: {
    allowedDevOrigins: [
      "https://6000-firebase-studio-1747935835035.cluster-ejd22kqny5htuv5dfowoyipt52.cloudworkstations.dev"
    ],
  },
};

export default nextConfig;
