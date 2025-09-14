
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
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
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      }
    ],
  },
  experimental: {
    allowedDevOrigins: [
      "https://6000-firebase-studio-1747935835035.cluster-ejd22kqny5htuv5dfowoyipt52.cloudworkstations.dev"
    ],
    // This is the fix for the build error
    serverComponentsExternalPackages: [
      'handlebars',
      'dotprompt',
      'firebase-admin',
      'express',
    ],
  },
};

export default nextConfig;
