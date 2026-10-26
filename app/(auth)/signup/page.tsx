import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";
import { T } from "@/components/providers/t";
import { APP_CONFIG } from "@/config/app";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Créer un compte" };

export default async function SignupPage() {
  if (await getSession()) redirect("/dashboard");
  return (
    <>
      <h1 className="text-xl font-semibold"><T fr="Créer un compte manager" en="Create a manager account" /></h1>
      <p className="mb-6 mt-1 text-sm text-muted"><T fr="Les membres du personnel n’ont pas de compte : vous créez et gérez leurs fiches." en="Staff members do not need accounts; you create and manage their profiles." /></p>
      <SignupForm defaultCountry={APP_CONFIG.defaultCountry} />
      <p className="mt-6 text-center text-sm text-muted">
        <T fr="Déjà inscrit ?" en="Already registered?" /> <Link href="/login" className="font-medium text-primary hover:underline"><T fr="Se connecter" en="Log in" /></Link>
      </p>
    </>
  );
}
