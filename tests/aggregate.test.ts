import { describe, it, expect } from "vitest";
import { rollupWeek } from "../src/summary/aggregate.js";
import { formatMarkdown, formatCsv, formatSfdc } from "../src/summary/format.js";
import type { TimeEntry } from "../src/asana/timeEntries.js";

const days = [
  "2026-05-25",
  "2026-05-26",
  "2026-05-27",
  "2026-05-28",
  "2026-05-29",
  "2026-05-30",
  "2026-05-31",
];

function entry(
  taskGid: string,
  projectGid: string,
  projectName: string,
  taskName: string,
  date: string,
  minutes: number,
): TimeEntry {
  return {
    gid: `entry-${taskGid}-${date}-${minutes}`,
    duration_minutes: minutes,
    entered_on: date,
    task: {
      gid: taskGid,
      name: taskName,
      permalink_url: `https://app.asana.com/0/${projectGid}/${taskGid}`,
      projects: [{ gid: projectGid, name: projectName }],
    },
  };
}

describe("rollupWeek", () => {
  it("aggregates entries by customer × day", () => {
    const entries: TimeEntry[] = [
      entry("t1", "p1", "ACME", "Design review", "2026-05-25", 120),
      entry("t1", "p1", "ACME", "Design review", "2026-05-27", 60),
      entry("t2", "p1", "ACME", "Kickoff", "2026-05-26", 90),
      entry("t3", "p2", "Beta", "Impl", "2026-05-28", 240),
      entry("t3", "p2", "Beta", "Impl", "2026-05-29", 120),
    ];
    const week = rollupWeek(entries, days);
    expect(week.customers.map((c) => c.name)).toEqual(["Beta", "ACME"]);

    const beta = week.customers[0];
    expect(beta.totalMinutes).toBe(360);
    expect(beta.byDate["2026-05-28"]).toBe(240);
    expect(beta.tasks).toHaveLength(1);

    const acme = week.customers[1];
    expect(acme.totalMinutes).toBe(270);
    expect(acme.byDate["2026-05-25"]).toBe(120);
    expect(acme.byDate["2026-05-26"]).toBe(90);
    expect(acme.byDate["2026-05-27"]).toBe(60);
    expect(acme.tasks).toHaveLength(2);

    expect(week.totalMinutes).toBe(630);
    expect(week.totalByDate["2026-05-25"]).toBe(120);
  });

  it("ignores entries outside the week", () => {
    const entries: TimeEntry[] = [
      entry("t1", "p1", "ACME", "x", "2026-05-24", 60),
      entry("t1", "p1", "ACME", "x", "2026-05-25", 60),
    ];
    const week = rollupWeek(entries, days);
    expect(week.totalMinutes).toBe(60);
  });
});

describe("format output", () => {
  const entries: TimeEntry[] = [
    entry("t1", "p1", "ACME", "Design review", "2026-05-25", 120),
    entry("t2", "p1", "ACME", "Kickoff", "2026-05-26", 90),
    entry("t3", "p2", "Beta", "Impl", "2026-05-28", 240),
  ];
  const week = rollupWeek(entries, days);

  it("markdown has heading, table, and SFDC entries", () => {
    const out = formatMarkdown(week);
    expect(out).toContain("## Week of 2026-05-25 (Mon)");
    expect(out).toContain("| Customer |");
    expect(out).toContain("Beta");
    expect(out).toContain("ACME");
    expect(out).toContain("### SFDC entries (1h rounded)");
    expect(out).toContain("- Beta: 4h");
    expect(out).toContain("- ACME: 4h"); // 210 min ≈ 4h rounded
  });

  it("csv format is per-entry rows with Date/Kong Resource/Activity Details/Hours Consumed", () => {
    const csvEntries = [entries[0], entries[1], entries[2]];
    const out = formatCsv(csvEntries, "Field Engineer");
    const lines = out.split("\n");
    expect(lines[0]).toBe("Date,Kong Resource,Activity Details,Hours Consumed");
    expect(lines[1]).toBe("2026/5/25,Field Engineer,Design review,2");
    expect(lines[2]).toBe("2026/5/26,Field Engineer,Kickoff,2");
    expect(lines[3]).toBe("2026/5/28,Field Engineer,Impl,4");
  });

  it("csv drops zero-rounded entries and blanks Kong Resource when unset", () => {
    const tiny: TimeEntry = {
      gid: "x",
      duration_minutes: 15,
      entered_on: "2026-05-25",
      task: { gid: "t9", name: "tiny", projects: [{ gid: "p1", name: "ACME" }] },
    };
    const normal: TimeEntry = {
      gid: "y",
      duration_minutes: 60,
      entered_on: "2026-05-26",
      task: { gid: "t10", name: "one", projects: [{ gid: "p1", name: "ACME" }] },
    };
    const out = formatCsv([tiny, normal]);
    const lines = out.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe("2026/5/26,,one,1");
  });

  it("csv defangs spreadsheet formula injection in kongResource and activity cells", () => {
    const malicious: TimeEntry = {
      gid: "z",
      duration_minutes: 60,
      entered_on: "2026-05-25",
      task: {
        gid: "t11",
        name: "=HYPERLINK(\"http://evil\",\"click\")",
        projects: [{ gid: "p1", name: "ACME" }],
      },
    };
    const out = formatCsv([malicious], "+Engagement");
    const dataLine = out.split("\n")[1];
    // both cells start with an apostrophe (activity cell is CSV-quoted because of the embedded ",")
    expect(dataLine).toContain(",'+Engagement,");
    expect(dataLine).toContain('"\'=HYPERLINK(""http://evil"",""click"")"');
  });

  it("sfdc TSV flattens tab/newline in customer names so the grid doesn't break", () => {
    const malicious: TimeEntry = entry(
      "t99",
      "p9",
      "Acme\tInc\nrow2",
      "x",
      "2026-05-25",
      60,
    );
    const sunDays = [
      "2026-05-24",
      "2026-05-25",
      "2026-05-26",
      "2026-05-27",
      "2026-05-28",
      "2026-05-29",
      "2026-05-30",
    ];
    const w = rollupWeek([malicious], sunDays);
    const out = formatSfdc(w);
    const dataLines = out.split("\n").filter((l) => l.includes("Acme"));
    expect(dataLines).toHaveLength(1);
    expect(dataLines[0]).toBe("Acme Inc row2\t0\t1\t0\t0\t0\t0\t0");
  });

  it("sfdc format emits one TSV row per project with 7 Sun→Sat day cells", () => {
    const sunDays = [
      "2026-05-24",
      "2026-05-25",
      "2026-05-26",
      "2026-05-27",
      "2026-05-28",
      "2026-05-29",
      "2026-05-30",
    ];
    const sunEntries: TimeEntry[] = [
      entry("t1", "p1", "ACME", "Design review", "2026-05-25", 120),
      entry("t2", "p1", "ACME", "Kickoff", "2026-05-26", 90),
      entry("t3", "p2", "Beta", "Impl", "2026-05-28", 240),
    ];
    const sunWeek = rollupWeek(sunEntries, sunDays);
    const out = formatSfdc(sunWeek);
    const lines = out.split("\n");
    expect(lines[0]).toBe("Week ending 2026-05-30 (Sat)");
    expect(lines).toContain("Beta\t0\t0\t0\t0\t4\t0\t0");
    expect(lines).toContain("ACME\t0\t2\t2\t0\t0\t0\t0");
    expect(lines.at(-1)).toMatch(/^\(actual: /);
  });
});
