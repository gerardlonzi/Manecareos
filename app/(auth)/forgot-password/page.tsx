import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "@/components/auth/forgot-form";
import { T } from "@/components/providers/t";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-xl font-semibold"><T fr="Mot de passe oublié" en="Forgot password" /></h1>
      <p className="mb-6 mt-1 text-sm text-muted"><T fr="Indiquez votre e-mail : nous vous envoyons un lien pour choisir un nouveau mot de passe." en="Enter your email and we’ll send you a link to reset your password." /></p>
      <ForgotForm />
      <p className="mt-6 text-center text-sm"><Link href="/login" className="font-medium text-primary hover:underline"><T fr="Retour à la connexion" en="Back to login" /></Link></p>
    </>
  );
}
