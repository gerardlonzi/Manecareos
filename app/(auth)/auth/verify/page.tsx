import type { Metadata } from "next";
import Link from "next/link";
import { VerifyPanel } from "@/components/auth/verify-panel";
import { T } from "@/components/providers/t";

export const metadata: Metadata = { title: "Vérification de l’e-mail" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold"><T fr="Confirmez votre adresse e-mail" en="Verify your email address" /></h1>
      <VerifyPanel email={email ?? ""} />
      <p className="mt-6 text-center text-sm"><Link href="/login" className="font-medium text-primary hover:underline"><T fr="Retour à la connexion" en="Back to login" /></Link></p>
    </>
  );
}
