import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { APP_CONFIG } from "@/config/app";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${APP_CONFIG.name} — gestion du personnel et missions`, template: `%s · ${APP_CONFIG.name}` },
  description: APP_CONFIG.tagline,
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#3157d5" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
