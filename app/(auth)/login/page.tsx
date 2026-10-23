import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { Alert } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/env";
import { safeNextPath } from "@/lib/utils";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const configured = isSupabaseConfigured();
  return (
    <>
      <h1 className="text-xl font-semibold">Connexion</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Accédez à votre espace manager.</p>
      {!configured ? (
        <Alert tone="warning" title="Configuration requise" className="mb-4">
          Supabase n’est pas configuré. Copiez <code>.env.example</code> vers <code>.env.local</code> et renseignez vos clés (voir INSTRUCTIONS.md).
        </Alert>
      ) : null}
      {sp.error === "auth" ? <Alert tone="danger" className="mb-4">Le lien est invalide ou a expiré. Reconnectez-vous ou redemandez un lien.</Alert> : null}
      <LoginForm next={sp.next ? safeNextPath(sp.next) : undefined} />
      <p className="mt-6 text-center text-sm text-muted">
        Pas encore de compte ? <Link href="/signup" className="font-medium text-primary hover:underline">Créer un compte</Link>
      </p>
    </>
  );
}
