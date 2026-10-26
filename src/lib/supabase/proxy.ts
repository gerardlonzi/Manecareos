import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, supabaseEnv } from "@/lib/env";

const PRIVATE_PREFIXES = ["/dashboard", "/staff", "/find-staff", "/missions", "/activity", "/notifications", "/settings"];
const AUTH_PAGES = ["/login", "/signup", "/forgot-password"];

const matches = (path: string, prefixes: string[]) => prefixes.some((p) => path === p || path.startsWith(`${p}/`));

/** Rafraîchit la session Supabase et redirige les visiteurs non authentifiés hors des routes privées. */
export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPrivate = matches(path, PRIVATE_PREFIXES);

  if (!isSupabaseConfigured()) {
    if (isPrivate) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "?error=config";
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const { url, key } = supabaseEnv();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  // getClaims valide la signature du JWT ; l'autorisation fine reste faite côté serveur (requireUser + RLS).
  const { data } = await supabase.auth.getClaims();
  const authenticated = Boolean(data?.claims?.sub);

  if (!authenticated && isPrivate) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(redirect);
  }
  if (authenticated && matches(path, AUTH_PAGES)) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/dashboard";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }
  return response;
}
