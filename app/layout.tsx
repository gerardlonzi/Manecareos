import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { APP_CONFIG } from "@/config/app";
import "./globals.css";
import { PreferencesProvider } from "@/components/providers/preferences-provider";
import { getLocale, getTheme } from "@/lib/i18n-server";
import "flag-icons/css/flag-icons.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${APP_CONFIG.name} — ${APP_CONFIG.company}`, template: `%s · ${APP_CONFIG.name}` },
  description: "Plateforme de gestion du personnel pour agences de soins : trouvez le bon staff près de chaque établissement.",
  applicationName: APP_CONFIG.name,
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#000000" }, { color: "#0878c0" }] };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, theme] = await Promise.all([getLocale(), getTheme()]);
  return (
    <html lang={locale} className={theme === "dark" ? "dark" : ""} style={{ colorScheme: theme }} suppressHydrationWarning>
      <body>
        <PreferencesProvider initialLocale={locale} initialTheme={theme}>
          {children}
          <Toaster position="top-right" richColors closeButton theme={theme} />
        </PreferencesProvider>
      </body>
    </html>
  );
}
