import { describe, expect, it } from "vitest";

describe("journal d'activité : seulement l'important", () => {
  it("ne garde pas les modifications courantes", async () => {
    // Import dynamique : le module est marqué server-only, mais la liste est une simple constante.
    const { IMPORTANT_EVENTS } = await import("./activity");
    for (const important of ["staff_created", "staff_archived", "mission_created", "mission_cancelled", "import_completed", "document_deleted"]) expect(IMPORTANT_EVENTS.has(important)).toBe(true);
    for (const routine of ["staff_updated", "document_saved", "availability_changed", "mission_updated", "staff_contacted", "routing_failed", "assignment_hours_updated"]) expect(IMPORTANT_EVENTS.has(routine)).toBe(false);
  });
});
