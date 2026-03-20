/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'arweave.net',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        buffer: require.resolve('buffer/'),
      };
    }
    // Force CJS build of buffer-layout-utils — its ESM build is missing .js files
    config.resolve.alias = {
      ...config.resolve.alias,
      '@solana/buffer-layout-utils': require.resolve('@solana/buffer-layout-utils'),
    };
    return config;
  },
}

module.exports = nextConfig
