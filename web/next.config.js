/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  webpack: (config) => {
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      "@x402/core/client": false,
      "@x402/evm/exact/client": false,
      "@x402/evm/upto/client": false,
      "pino-pretty": false,
      encoding: false,
    };
    config.externals = [
      ...(config.externals || []),
      { "@coinbase/cdp-sdk": "commonjs @coinbase/cdp-sdk" },
    ];
    return config;
  },
};
module.exports = nextConfig;
