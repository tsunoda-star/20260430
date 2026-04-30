/** @type {import('next').NextConfig} */
const nextConfig = {
  // Plesk Node.js Toolkit (Phusion Passenger) で単一 server.js を起動するため
  // standalone 出力を採用. AWS / Vercel / 他 PaaS でも問題なし。
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    typedRoutes: true,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      // 会社プロフィール推定で取得した OG 画像のドメインは Wave 2 で動的検証
      { protocol: 'https', hostname: '**.aidreams-factory.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
