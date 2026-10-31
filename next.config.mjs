/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@react-pdf/renderer", "bcryptjs", "nodemailer"],
  },
};
export default nextConfig;
