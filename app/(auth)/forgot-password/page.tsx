import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "@/components/auth/forgot-form";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">Mot de passe oublié</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Indiquez votre e-mail : nous vous envoyons un lien pour choisir un nouveau mot de passe.</p>
      <ForgotForm />
      <p className="mt-6 text-center text-sm"><Link href="/login" className="font-medium text-primary hover:underline">Retour à la connexion</Link></p>
    </>
  );
}
