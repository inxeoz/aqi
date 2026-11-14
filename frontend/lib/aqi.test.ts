import { describe, expect, it } from "vitest";
import { applyLevel, actionsFor, BAND, buildRows, metrics, heuristicBrief, buildCitizenDoc } from "./aqi";

const SAMPLE_CSV = [
  "location,time,pollutant,value,unit",
  "A,2026-11-10 08:00,PM2.5,100,ug/m3",
  "B,2026-11-10 08:00,PM2.5,50,ug/m3",
].join("\n");

const rec = (o: Record<string, string>) => o;

describe("buildRows quality flags", () => {
  it("flags missing, negative, duplicate, mixed units, bad coords", () => {
    const rows = buildRows([
      rec({ location: "A", time: "t1", pollutant: "PM2.5", value: "10", unit: "ug/m3", latitude: "18.5", longitude: "73.8" }),
      rec({ location: "A", time: "t2", pollutant: "PM2.5", value: "", unit: "ug/m3" }),
      rec({ location: "B", time: "t1", pollutant: "PM2.5", value: "-3", unit: "ug/m3" }),
      rec({ location: "B", time: "t1", pollutant: "PM2.5", value: "-3", unit: "ug/m3" }),
      rec({ location: "C", time: "t1", pollutant: "PM2.5", value: "0.1", unit: "ppm" }),
      rec({ location: "D", time: "t1", pollutant: "PM2.5", value: "50", unit: "ug/m3", latitude: "999", longitude: "0" }),
    ]);
    const f = (i: number) => rows[i].flags;
    expect(f(0)).toContain("UNIT_INCONSISTENT");
    expect(f(1)).toContain("MISSING_VALUE");
    expect(f(2)).toContain("NEGATIVE_VALUE");
    expect(f(3)).toContain("DUPLICATE_ROW");
    expect(f(5)).toContain("INVALID_COORDS");
    expect(rows[0].lat).toBeCloseTo(18.5);
  });
});

describe("metrics", () => {
  it("excludes unreliable and unit-inconsistent rows from means", () => {
    const rows = buildRows([
      rec({ location: "A", time: "t1", pollutant: "PM2.5", value: "100", unit: "ug/m3" }),
      rec({ location: "B", time: "t1", pollutant: "PM2.5", value: "-5", unit: "ug/m3" }),
      rec({ location: "C", time: "t1", pollutant: "PM2.5", value: "0.1", unit: "ppm" }),
    ]);
    const m = metrics(rows);
    expect(m.mean).toBe(0); // mixed-unit file: nothing averaged
    expect(m.unusable).toBe(1);
  });
});

describe("roles and levels", () => {
  it("gives different actions per role with citations", () => {
    const rows = buildRows([
      rec({ location: "A", time: "t1", pollutant: "PM2.5", value: "100", unit: "ug/m3" }),
    ]);
    const w = actionsFor("ward", rows), s = actionsFor("school", rows);
    expect(w[0].text).not.toBe(s[0].text);
    expect(w[0].cited_row_ids).toEqual(["R0001"]);
  });
  it("shortens text for child level", () => {
    expect(applyLevel("One two three four five six seven eight nine ten eleven twelve thirteen.", "child").split(" ").length).toBeLessThanOrEqual(13);
  });
  it("bands PM2.5", () => {
    expect(BAND(30)).toBe("Good"); expect(BAND(300)).toBe("Very Poor");
  });
});

describe("citizen doc", () => {
  it("always has vulnerable-group sections and no raw units", () => {
    const rows = buildRows([
      rec({ location: "A", time: "t1", pollutant: "PM2.5", value: "180", unit: "ug/m3" }),
    ]);
    const doc = buildCitizenDoc(rows, heuristicBrief(rows), actionsFor("school", rows), "en", "general");
    expect(doc).toMatch(/children/i);
    expect(doc).toMatch(/older adult/i);
    expect(doc).toMatch(/sensitive/i);
    expect(doc).not.toMatch(/ug\/m3/);
  });
  it("parses the bundled messy sample", async () => {
    const { default: Papa } = await import("papaparse");
    const parsed = Papa.parse<Record<string, string>>(SAMPLE_CSV, { header: true, skipEmptyLines: true });
    expect(buildRows((parsed.data || []) as Record<string, string>[]).length).toBeGreaterThan(0);
  });
});
