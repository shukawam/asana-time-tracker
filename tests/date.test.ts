import { describe, it, expect } from "vitest";
import {
  weekRange,
  lastWeekRange,
  sundayWeekRange,
  lastSundayWeekRange,
  toIsoDate,
  dowLabel,
  parseIsoDate,
} from "../src/util/date.js";

describe("weekRange (Monday-based)", () => {
  it("Wednesday resolves to Mon-Sun range", () => {
    const wed = new Date(2026, 4, 27); // 2026-05-27 (Wed)
    const range = weekRange(wed);
    expect(range.start).toBe("2026-05-25");
    expect(range.end).toBe("2026-05-31");
    expect(range.days).toHaveLength(7);
    expect(range.days[0]).toBe("2026-05-25");
    expect(range.days[6]).toBe("2026-05-31");
  });

  it("Monday resolves to itself as the start", () => {
    const mon = new Date(2026, 4, 25);
    const range = weekRange(mon);
    expect(range.start).toBe("2026-05-25");
  });

  it("Sunday belongs to the week that started the previous Monday", () => {
    const sun = new Date(2026, 4, 31);
    const range = weekRange(sun);
    expect(range.start).toBe("2026-05-25");
    expect(range.end).toBe("2026-05-31");
  });

  it("crosses a month boundary correctly", () => {
    const tue = new Date(2026, 5, 2); // Tue 2026-06-02
    const range = weekRange(tue);
    expect(range.start).toBe("2026-06-01");
    expect(range.end).toBe("2026-06-07");
  });
});

describe("lastWeekRange", () => {
  it("returns the previous Mon-Sun", () => {
    const wed = new Date(2026, 4, 27);
    const range = lastWeekRange(wed);
    expect(range.start).toBe("2026-05-18");
    expect(range.end).toBe("2026-05-24");
  });
});

describe("sundayWeekRange (Sun→Sat)", () => {
  it("Wednesday resolves to Sun-Sat range", () => {
    const wed = new Date(2026, 4, 27); // 2026-05-27 (Wed)
    const range = sundayWeekRange(wed);
    expect(range.start).toBe("2026-05-24");
    expect(range.end).toBe("2026-05-30");
    expect(range.days).toHaveLength(7);
    expect(range.days[0]).toBe("2026-05-24");
    expect(range.days[6]).toBe("2026-05-30");
  });

  it("Sunday resolves to itself as the start", () => {
    const sun = new Date(2026, 4, 24);
    const range = sundayWeekRange(sun);
    expect(range.start).toBe("2026-05-24");
  });

  it("Saturday belongs to the week that started the previous Sunday", () => {
    const sat = new Date(2026, 4, 30);
    const range = sundayWeekRange(sat);
    expect(range.start).toBe("2026-05-24");
    expect(range.end).toBe("2026-05-30");
  });
});

describe("lastSundayWeekRange", () => {
  it("returns the previous Sun-Sat", () => {
    const wed = new Date(2026, 4, 27);
    const range = lastSundayWeekRange(wed);
    expect(range.start).toBe("2026-05-17");
    expect(range.end).toBe("2026-05-23");
  });
});

describe("toIsoDate / dowLabel", () => {
  it("formats date in local TZ as YYYY-MM-DD", () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
  it("dowLabel uses Mon-Sun labels", () => {
    expect(dowLabel("2026-05-25")).toBe("Mon");
    expect(dowLabel("2026-05-31")).toBe("Sun");
  });
});

describe("parseIsoDate strict validation", () => {
  it("accepts valid calendar dates", () => {
    expect(parseIsoDate("2026-05-28").getDate()).toBe(28);
    expect(parseIsoDate("2024-02-29").getDate()).toBe(29); // leap year
  });

  it("rejects dates that JS silently rolls over (e.g. Feb 31)", () => {
    expect(() => parseIsoDate("2026-02-31")).toThrow(/does not exist/);
    expect(() => parseIsoDate("2025-02-29")).toThrow(/does not exist/); // not a leap year
    expect(() => parseIsoDate("2026-13-01")).toThrow(/does not exist/);
    expect(() => parseIsoDate("2026-04-31")).toThrow(/does not exist/);
  });

  it("still rejects malformed strings", () => {
    expect(() => parseIsoDate("2026/5/28")).toThrow(/expected YYYY-MM-DD/);
    expect(() => parseIsoDate("not a date")).toThrow(/expected YYYY-MM-DD/);
  });
});
