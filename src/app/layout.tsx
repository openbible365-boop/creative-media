import type { Metadata } from "next";
import { SessionProvider } from "@/components/layout/session-provider";
import "./globals.css";

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
    <html suppressHydrationWarning>
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
