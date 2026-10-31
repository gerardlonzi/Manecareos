import { describe, expect, it } from "vitest";
import { alertThreshold, daysUntil, docStatus, expiringBefore, staffCompliance, type DocType, type StaffDoc } from "./documents";

const T = (id: string, mandatory = true, extra: Partial<DocType> = {}): DocType => ({ id, key: id, name_fr: id, name_en: id, mandatory, can_expire: true, alert_days: [60, 30, 14, 7, 0], ...extra });
const D = (type_id: string, expires_at: string | null, no_expiry = false): StaffDoc => ({ id: `d-${type_id}`, staff_id: "s", type_id, expires_at, no_expiry });
const TODAY = "2026-10-28";

describe("documents : statuts", () => {
  it("calcule les jours restants", () => {
    expect(daysUntil("2026-11-07", TODAY)).toBe(10);
    expect(daysUntil("2026-10-28", TODAY)).toBe(0);
    expect(daysUntil("2026-10-27", TODAY)).toBe(-1);
  });
  it("valide / bientôt expiré / expiré / sans expiration", () => {
    expect(docStatus({ expires_at: "2027-06-01", no_expiry: false }, TODAY)).toBe("valid");
    expect(docStatus({ expires_at: "2026-12-01", no_expiry: false }, TODAY)).toBe("expiring");
    expect(docStatus({ expires_at: "2026-10-28", no_expiry: false }, TODAY)).toBe("expiring"); // expire aujourd'hui = encore valable
    expect(docStatus({ expires_at: "2026-10-27", no_expiry: false }, TODAY)).toBe("expired");
    expect(docStatus({ expires_at: null, no_expiry: true }, TODAY)).toBe("valid");
  });
});

describe("documents : conformité", () => {
  const types = [T("rtw"), T("passport"), T("dbs"), T("optional", false)];
  it("complet = tous les obligatoires présents et valides", () => {
    const c = staffCompliance(types, [D("rtw", "2028-01-01"), D("passport", "2030-01-01"), D("dbs", "2027-01-01")], TODAY);
    expect(c).toMatchObject({ complete: true, level: "compliant", requiredCount: 3, validCount: 3 });
  });
  it("document manquant ou expiré = non conforme", () => {
    const c = staffCompliance(types, [D("rtw", "2028-01-01"), D("passport", "2026-01-01")], TODAY);
    expect(c.complete).toBe(false);
    expect(c.level).toBe("non_compliant");
    expect(c.missing.map((t) => t.id)).toEqual(["dbs"]);
    expect(c.expired.map((e) => e.type.id)).toEqual(["passport"]);
  });
  it("bientôt expiré reste conforme mais signalé", () => {
    const c = staffCompliance(types, [D("rtw", "2026-11-10"), D("passport", "2030-01-01"), D("dbs", null, true)], TODAY);
    expect(c.complete).toBe(true);
    expect(c.level).toBe("expiring");
    expect(c.expiring[0]).toMatchObject({ daysLeft: 13 });
  });
  it("les types archivés ne sont pas exigés ; aucun type obligatoire = conforme", () => {
    expect(staffCompliance([T("x", true, { archived_at: "2026-01-01" })], [], TODAY).complete).toBe(true);
    expect(staffCompliance([], [], TODAY).level).toBe("compliant");
  });
  it("une date de validité suffit : sans fichier ni lien, le staff est apte à travailler", () => {
    const d = (type: string): StaffDoc => ({ id: type, staff_id: "s", type_id: type, expires_at: "2030-01-01", no_expiry: false, file_public_id: null, link_url: null });
    const c = staffCompliance(types, [d("rtw"), d("passport"), d("dbs")], TODAY);
    expect(c.complete).toBe(true);
    expect(c.missing).toHaveLength(0);
  });
  it("détecte les documents qui expirent avant la fin d'une mission", () => {
    const list = expiringBefore(types, [D("rtw", "2026-11-05"), D("passport", "2030-01-01")], "2026-11-20");
    expect(list.map((x) => x.type.id)).toEqual(["rtw"]);
  });
});

describe("documents : seuils d'alerte", () => {
  const days = [60, 30, 14, 7, 0];
  it("renvoie le seuil atteint", () => {
    expect(alertThreshold(90, days)).toBeNull();
    expect(alertThreshold(60, days)).toBe(60);
    expect(alertThreshold(45, days)).toBe(60);
    expect(alertThreshold(30, days)).toBe(30);
    expect(alertThreshold(6, days)).toBe(7);
  });
});
