"use client";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";

export default function PrivateError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = usePreferences();
  return (
    <div className="mx-auto max-w-lg py-16">
      <Alert tone="danger" title={t("Impossible de charger cette page", "Unable to load this page")}>
        <p>{t("Une erreur est survenue", "An error occurred")}{error.digest ? ` (ref. ${error.digest})` : ""}. {t("Vérifiez votre connexion et que la base de données est bien configurée, puis réessayez.", "Check your connection and that the database is configured, then try again.")}</p>
      </Alert>
      <Button className="mt-4" onClick={reset}>{t("Réessayer", "Try again")}</Button>
    </div>
  );
}
