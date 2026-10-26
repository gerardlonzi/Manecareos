import LandingClient from "./landing-client";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** La page d’accueil reste visible pour un utilisateur connecté : elle affiche alors uniquement « Tableau de bord ». */
export default async function HomePage() {
  const session = await getSession();
  return <LandingClient signedIn={!!session} />;
}
