/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ["@react-pdf/renderer", "bcryptjs", "nodemailer"],
  },
};
export default nextConfig;
