import type { Metadata } from "next";
import Link from "next/link";
import { VerifyPanel } from "@/components/auth/verify-panel";

export const metadata: Metadata = { title: "Vérification de l’e-mail" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Confirmez votre adresse e-mail</h1>
      <VerifyPanel email={email ?? ""} />
      <p className="mt-6 text-center text-sm"><Link href="/login" className="font-medium text-primary hover:underline">Retour à la connexion</Link></p>
    </>
  );
}
