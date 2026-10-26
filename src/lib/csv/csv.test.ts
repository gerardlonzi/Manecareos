import { describe, expect, it } from "vitest";
import { escapeCsvCell, toCsv } from "./export";
import { errorReportCsv, importTemplateCsv, normalizeHeader, parseSkills, parseStaffCsv } from "./import";

describe("escapeCsvCell", () => {
  it("échappe virgules, guillemets et retours à la ligne", () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('dit "oui"')).toBe('"dit ""oui"""');
    expect(escapeCsvCell("l1\nl2")).toBe('"l1\nl2"');
  });
  it("neutralise l'injection de formules", () => {
    expect(escapeCsvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(escapeCsvCell("+33123")).toBe("'+33123");
    expect(escapeCsvCell("-2+3")).toBe("'-2+3");
    expect(escapeCsvCell("@cmd")).toBe("'@cmd");
    expect(escapeCsvCell("\tx")).toBe("'\tx");
  });
  it("ne préfixe pas les nombres JS, gère null/undefined/Date", () => {
    expect(escapeCsvCell(-5)).toBe("-5");
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
    expect(escapeCsvCell(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01-01T00:00:00.000Z");
    expect(escapeCsvCell(Number.NaN)).toBe("");
  });
  it("toCsv : en-têtes, CRLF et BOM optionnel", () => {
    expect(toCsv(["a", "b"], [[1, "x,y"]])).toBe('a,b\r\n1,"x,y"\r\n');
    expect(toCsv(["a"], [], { bom: true }).startsWith("﻿")).toBe(true);
  });
});

describe("normalizeHeader / parseSkills", () => {
  it("accepte des synonymes FR/EN", () => {
    expect(normalizeHeader("Nom")).toBe("full_name");
    expect(normalizeHeader("Code postal")).toBe("postal_code");
    expect(normalizeHeader("postcode")).toBe("postal_code");
    expect(normalizeHeader("﻿full_name")).toBe("full_name");
    expect(normalizeHeader("inconnu")).toBeNull();
  });
  it("découpe, dédoublonne et nettoie les compétences", () => {
    expect(parseSkills("care; Care | night-shift, ,driver")).toEqual(["care", "night-shift", "driver"]);
    expect(parseSkills(undefined)).toEqual([]);
  });
});

describe("parseStaffCsv", () => {
  const header = "full_name,staff_code,phone,email,country_code,postal_code,city,region,skills,availability,notes\n";

  it("importe une ligne valide et normalise les champs", () => {
    const r = parseStaffCsv(header + 'Jane Doe,S1,07700 900123,JANE@Example.com,GB,sw1a1aa,London,,"care;night",available,ok\n');
    expect(r.issues).toEqual([]);
    expect(r.rows[0]).toMatchObject({
      full_name: "Jane Doe", phone: "+447700900123", email: "jane@example.com",
      postal_code: "SW1A 1AA", postal_code_normalized: "SW1A1AA", skills: ["care", "night"], availability_status: "available",
    });
  });
  it("disponibilité vide = unknown, jamais available", () => {
    expect(parseStaffCsv(header + "A,,,,GB,,London,,,,\n").rows[0]?.availability_status).toBe("unknown");
  });
  it("rejette une disponibilité inconnue au lieu de la deviner", () => {
    const r = parseStaffCsv(header + "A,,,,GB,,London,,,peut-etre,\n");
    expect(r.rows).toHaveLength(0);
    expect(r.issues[0]).toMatchObject({ field: "availability", rowNumber: 2 });
  });
  it("erreurs par ligne : nom, e-mail, code postal, téléphone", () => {
    const r = parseStaffCsv(header + ",,,,GB,,,,,,\nB,,abc,bad,GB,12345,,,,,\n");
    const fields = r.issues.map((i) => `${i.rowNumber}:${i.field}`);
    expect(fields).toContain("2:full_name");
    expect(fields).toContain("3:email");
    expect(fields).toContain("3:postal_code");
    expect(fields).toContain("3:phone");
    expect(r.rows).toHaveLength(0);
  });
  it("détecte les doublons dans le fichier et en base", () => {
    const r = parseStaffCsv(header + "A,S1,,a@x.com,GB,,L,,,,\nB,S1,,b@x.com,GB,,L,,,,\nC,S9,,a@x.com,GB,,L,,,,\nD,S2,,,GB,,L,,,,\n", {
      existingCodes: ["s2"],
    });
    expect(r.rows.map((x) => x.full_name)).toEqual(["A"]);
    const msgs = r.issues.map((i) => `${i.rowNumber}:${i.field}`);
    expect(msgs).toEqual(expect.arrayContaining(["3:staff_code", "4:email", "5:staff_code"]));
  });
  it("ignore toute colonne owner_id du fichier", () => {
    const r = parseStaffCsv("full_name,owner_id,country_code,city\nA,00000000-0000-0000-0000-000000000000,GB,London\n");
    expect(r.rows[0]).not.toHaveProperty("owner_id");
  });
  it("en-tête obligatoire manquant", () => {
    const r = parseStaffCsv("phone,city\n123,London\n");
    expect(r.missingRequired).toEqual(["full_name"]);
    expect(r.rows).toEqual([]);
  });
  it("aller-retour : une cellule neutralisée à l'export est restaurée à l'import", () => {
    const csv = toCsv(["full_name", "phone", "country_code"], [["=Evil", "+447700900123", "GB"]]);
    const r = parseStaffCsv(csv);
    expect(r.rows[0]?.full_name).toBe("=Evil");
    expect(r.rows[0]?.phone).toBe("+447700900123");
  });
  it("gère le BOM et les lignes vides", () => {
    const r = parseStaffCsv("﻿full_name,country_code\nA,GB\n\n\nB,GB\n");
    expect(r.rows.map((x) => x.rowNumber)).toEqual([2, 3]);
  });
  it("le modèle téléchargeable est lui-même importable sans erreur", () => {
    const r = parseStaffCsv(importTemplateCsv());
    expect(r.issues).toEqual([]);
    expect(r.rows).toHaveLength(2);
  });
  it("gère 1 000 lignes", () => {
    const body = Array.from({ length: 1000 }, (_, i) => `Staff ${i},C${i},,,GB,SW1A 1AA,London,,care,available,`).join("\n");
    const t0 = performance.now();
    const r = parseStaffCsv(header + body + "\n");
    expect(r.rows).toHaveLength(1000);
    expect(r.issues).toHaveLength(0);
    expect(performance.now() - t0).toBeLessThan(2000);
  });
  it("rapport d'erreurs en CSV", () => {
    const csv = errorReportCsv([{ rowNumber: 3, field: "email", message: "Adresse e-mail invalide", raw: "bad" }]);
    expect(csv).toContain("ligne,champ,erreur,valeur");
    expect(csv).toContain("3,email,Adresse e-mail invalide,bad");
  });
});
