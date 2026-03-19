import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SessionProvider } from "@/components/layout/session-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Creative Media — AI-Powered Media Creation",
  description: "From inspiration to publication, all in one platform. Supports English, Chinese, and Korean.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className={inter.className}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}

