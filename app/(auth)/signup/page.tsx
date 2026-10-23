import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";
import { APP_CONFIG } from "@/config/app";

export const metadata: Metadata = { title: "Créer un compte" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">Créer un compte manager</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Les membres du personnel n’ont pas de compte : vous créez et gérez leurs fiches.</p>
      <SignupForm defaultCountry={APP_CONFIG.defaultCountry} />
      <p className="mt-6 text-center text-sm text-muted">
        Déjà inscrit ? <Link href="/login" className="font-medium text-primary hover:underline">Se connecter</Link>
      </p>
    </>
  );
}
