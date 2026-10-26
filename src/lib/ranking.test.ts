import { describe, expect, it } from "vitest";
import { rankCandidates, type Candidate } from "./ranking";
import type { RouteEstimate } from "./routing/types";

const ok = (durationS: number, distanceM = durationS * 10): RouteEstimate => ({
  status: "ok", mode: "driving", provider: "mapbox", distanceM, durationS, estimatedAt: "2026-10-20T00:00:00Z", source: "provider",
});
const c = (id: string, straight: number | null, route?: RouteEstimate, availability: Candidate["availability"] = "available"): Candidate => ({
  id, fullName: id, availability, straightLineM: straight, route,
});

describe("rankCandidates", () => {
  it("par défaut : durée réelle d'abord, puis distance à vol d'oiseau", () => {
    const list = [c("slow", 1000, ok(900)), c("fast", 5000, ok(300)), c("noRoute", 100)];
    expect(rankCandidates(list).map((x) => x.id)).toEqual(["fast", "slow", "noRoute"]);
  });
  it("les estimations manquantes ne sont jamais traitées comme zéro", () => {
    const list = [c("a", 100), c("b", 5000, ok(60))];
    expect(rankCandidates(list, "travel_time").map((x) => x.id)).toEqual(["b", "a"]);
  });
  it("les estimations en échec comptent comme absentes", () => {
    const failed: RouteEstimate = { status: "error", mode: "driving", message: "x" };
    expect(rankCandidates([c("a", 100, failed), c("b", 200, ok(50))], "travel_time").map((x) => x.id)).toEqual(["b", "a"]);
  });
  it("tri par distance à vol d'oiseau indépendant du temps de trajet", () => {
    const list = [c("far", 9000, ok(10)), c("near", 100, ok(999))];
    expect(rankCandidates(list, "straight_line").map((x) => x.id)).toEqual(["near", "far"]);
  });
  it("tri par distance routière", () => {
    const list = [c("a", 1, ok(10, 9000)), c("b", 2, ok(99, 1000))];
    expect(rankCandidates(list, "road_distance").map((x) => x.id)).toEqual(["b", "a"]);
  });
  it("tri par nom", () => expect(rankCandidates([c("Zoé", 1), c("Alice", 2)], "name").map((x) => x.id)).toEqual(["Alice", "Zoé"]));
  it("les disponibles passent avant les autres statuts, 'unknown' avant 'unavailable'", () => {
    const list = [c("u", 1, undefined, "unavailable"), c("k", 2, undefined, "unknown"), c("a", 3, undefined, "available")];
    expect(rankCandidates(list).map((x) => x.id)).toEqual(["a", "k", "u"]);
  });
  it("ne modifie pas le tableau d'origine", () => {
    const list = [c("b", 2), c("a", 1)];
    rankCandidates(list, "straight_line");
    expect(list.map((x) => x.id)).toEqual(["b", "a"]);
  });
});
