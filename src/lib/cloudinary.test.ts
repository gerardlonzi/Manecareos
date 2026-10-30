import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { detectDocumentType, signParams } from "./cloudinary";

describe("cloudinary", () => {
  it("signe comme l'exemple de la documentation Cloudinary (paramètres triés + secret, SHA-1)", () => {
    expect(signParams({ timestamp: 1315060510, public_id: "sample_image", eager: "w_400,h_300,c_pad|w_260,h_200,c_crop" }, "abcd")).toBe("bfd09f95f331f558cbd1320e67aa8d488770583e");
    // Valeur vérifiée avec sha1sum : public_id=sample&timestamp=1315060510abcd
    expect(signParams({ timestamp: 1315060510, public_id: "sample" }, "abcd")).toBe("c3470533147774275dd37996cc4d0e68fd03cd4f");
  });
  it("détecte le vrai type d'après les octets", () => {
    expect(detectDocumentType(new TextEncoder().encode("%PDF-1.7"))).toBe("application/pdf");
    expect(detectDocumentType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectDocumentType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(detectDocumentType(new TextEncoder().encode("RIFF....WEBP"))).toBe("image/webp");
    expect(detectDocumentType(new TextEncoder().encode("MZ\x90\x00 exe"))).toBeNull();
    expect(detectDocumentType(new TextEncoder().encode("<script>alert(1)</script>"))).toBeNull();
  });
});
