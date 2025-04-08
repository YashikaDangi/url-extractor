/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['puppeteer-core', 'puppeteer'],
  
  webpack: (config:any, { isServer }:any) => {
    if (isServer) {
      // Add more optimizations for Puppeteer on Vercel
      config.externals.push('puppeteer-core');
      config.externals.push('@sparticuz/chromium');
    }
    return config;
  },
  
  // Optimize output for Vercel
  output: 'standalone',
};

module.exports = nextConfig;