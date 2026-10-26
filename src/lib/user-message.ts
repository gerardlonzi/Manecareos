/** Converts implementation/configuration failures into actionable, non-technical UI copy. */
export function friendlyError(message: string, locale: "fr" | "en" = "fr"): string {
  const technical = /not configured|configuration.*(missing|required)|supabase|mapbox|database|base de données|uri|token|api key|sql|postgres|fetch failed|internal server|stack trace|network error|service role/i.test(message);
  if (technical) return locale === "fr"
    ? "Cette action est temporairement indisponible. Vérifiez votre connexion ou réessayez dans quelques instants."
    : "This action is temporarily unavailable. Check your connection or try again in a moment.";
  return message;
}
