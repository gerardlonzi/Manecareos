import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CodeForm } from "@/components/auth/code-form";
import { VerifyPanel } from "@/components/auth/verify-panel";
import { T } from "@/components/providers/t";
import { getAuthUser, getSession } from "@/lib/auth";
import { safeNextPath } from "@/lib/utils";

export const metadata: Metadata = { title: "Vérification" };
export const dynamic = "force-dynamic";

const mask = (email: string | null) => {
  if (!email) return "—";
  const [name = "", domain = ""] = email.split("@");
  return `${name.slice(0, 2)}${"•".repeat(Math.max(2, name.length - 2))}@${domain}`;
};

/**
 * Page unique de vérification :
 *  - connecté par mot de passe mais code e-mail pas encore saisi → code à 6 chiffres (2FA) ;
 *  - pas encore connecté, avec ?email= (inscription)           → confirmation de l'adresse e-mail ;
 *  - déjà entièrement vérifié                                   → redirection vers l'application.
 */
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ email?: string; next?: string; sent?: string }> }) {
  const sp = await searchParams;
  const user = await getAuthUser();

  if (user) {
    if (await getSession()) redirect(safeNextPath(sp.next));
    return (
      <>
        <h1 className="text-xl font-semibold"><T fr="Vérification de sécurité" en="Security check" /></h1>
        <p className="mb-6 mt-1 text-sm text-muted"><T fr="Une dernière étape avant d’accéder à votre espace." en="One last step before you enter your workspace." /></p>
        <CodeForm maskedEmail={mask(user.email)} next={sp.next ? safeNextPath(sp.next) : undefined} alreadySent={sp.sent === "1"} />
      </>
    );
  }

  if (!sp.email) redirect("/login");
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold"><T fr="Confirmez votre adresse e-mail" en="Verify your email address" /></h1>
      <VerifyPanel email={sp.email} />
      <p className="mt-6 text-center text-sm"><Link href="/login" className="font-medium text-primary hover:underline"><T fr="Retour à la connexion" en="Back to login" /></Link></p>
    </>
  );
}
