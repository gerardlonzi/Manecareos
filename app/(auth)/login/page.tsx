import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { T } from "@/components/providers/t";
import { Alert } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/env";
import { getSession } from "@/lib/auth";
import { safeNextPath } from "@/lib/utils";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  if (await getSession()) redirect("/dashboard");
  const configured = isSupabaseConfigured();
  return (
    <>
      <h1 className="text-xl font-semibold"><T fr="Connexion" en="Log in" /></h1>
      <p className="mb-6 mt-1 text-sm text-muted"><T fr="Accédez à votre espace manager." en="Access your manager workspace." /></p>
      {!configured ? (
        <Alert tone="warning" title={<T fr="Configuration requise" en="Configuration required" />} className="mb-4">
          <T fr="La connexion est temporairement indisponible. Réessayez dans quelques instants ou contactez la personne qui gère votre espace." en="Sign-in is temporarily unavailable. Please try again shortly or contact your workspace administrator." />
        </Alert>
      ) : null}
      {sp.error === "auth" ? <Alert tone="danger" className="mb-4"><T fr="Le lien est invalide ou a expiré. Reconnectez-vous ou redemandez un lien." en="The link is invalid or has expired. Sign in again or request a new link." /></Alert> : null}
      <LoginForm next={sp.next ? safeNextPath(sp.next) : undefined} />
      <p className="mt-6 text-center text-sm text-muted">
        <T fr="Pas encore de compte ?" en="Don’t have an account yet?" /> <Link href="/signup" className="font-medium text-primary hover:underline"><T fr="Créer un compte" en="Create account" /></Link>
      </p>
    </>
  );
}
