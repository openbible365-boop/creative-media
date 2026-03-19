import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/config.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" }, // Google 头像
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" }, // Vercel Blob
    ],
  },
};

export default withNextIntl(nextConfig);
