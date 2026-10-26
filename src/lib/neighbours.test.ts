import { describe, expect, it } from "vitest";
import { groupByTown } from "./neighbours";

const c = (id: string, city: string | null, straightLineM: number, region: string | null = null) => ({ id, city, region, straightLineM });

describe("groupByTown", () => {
  const list = [
    c("a", "Solihull", 9000, "England"),
    c("b", "Birmingham", 1000, "England"),
    c("c", " birmingham ", 2500),
    c("d", null, 300),
    c("e", "Coventry", 30000),
    c("f", "", 40000),
    c("g", "Solihull", 8000),
  ];

  it("regroupe par ville sans tenir compte de la casse ni des espaces, triées par distance", () => {
    const r = groupByTown(list);
    expect(r.sameTown).toEqual([]);
    expect(r.towns.map((t) => t.town)).toEqual(["Birmingham", "Solihull", "Coventry", "Unknown"]);
    expect(r.towns[0]?.items.map((i) => i.id)).toEqual(["b", "c"]);
    expect(r.towns[1]?.items.map((i) => i.id)).toEqual(["g", "a"]);
    expect(r.towns[1]).toMatchObject({ region: "England", minDistanceM: 8000 });
  });
  it("les villes inconnues (null ou vide) sont groupées en dernier, même si elles sont proches", () => {
    const r = groupByTown(list);
    const last = r.towns[r.towns.length - 1];
    expect(last).toMatchObject({ town: "Unknown", minDistanceM: 300 });
    expect(last?.items.map((i) => i.id)).toEqual(["d", "f"]);
  });
  it("originCity : les candidats de la même ville sont séparés", () => {
    const r = groupByTown(list, { originCity: "BIRMINGHAM" });
    expect(r.sameTown.map((i) => i.id)).toEqual(["b", "c"]);
    expect(r.towns.some((t) => t.town === "Birmingham")).toBe(false);
  });
  it("sameTownRadiusM : le rayon compte aussi comme « même ville »", () => {
    const r = groupByTown(list, { sameTownRadiusM: 1500 });
    expect(r.sameTown.map((i) => i.id)).toEqual(["d", "b"]);
  });
  it("ne modifie pas l'entrée et gère une liste vide", () => {
    const copy = [...list];
    groupByTown(list, { originCity: "x" });
    expect(list).toEqual(copy);
    expect(groupByTown([])).toEqual({ sameTown: [], towns: [] });
  });
});
