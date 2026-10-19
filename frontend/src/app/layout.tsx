import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "@/components/providers";

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Library Cloud";

export const metadata: Metadata = {
  title: {
    default: `${appName} — Modern library management`,
    template: `%s · ${appName}`,
  },
  description:
    "Multi-tenant library management: catalog, circulation, holds, fines, OPAC and analytics for modern libraries.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-ink-50 text-ink-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
