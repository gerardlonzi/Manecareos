"use client";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";

export default function PrivateError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-16">
      <Alert tone="danger" title="Impossible de charger cette page">
        <p>Une erreur est survenue{error.digest ? ` (réf. ${error.digest})` : ""}. Vérifiez votre connexion et que la base de données est bien configurée, puis réessayez.</p>
      </Alert>
      <Button className="mt-4" onClick={reset}>Réessayer</Button>
    </div>
  );
}
