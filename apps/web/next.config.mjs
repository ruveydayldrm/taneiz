/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@taneiz/shared"],
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs", "pdf-lib", "qrcode"],
  },
};

export default nextConfig;
