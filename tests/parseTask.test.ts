import { describe, it, expect } from "vitest";
import { parseTaskRef } from "../src/util/parseTask.js";

describe("parseTaskRef", () => {
  it("accepts a bare numeric GID", () => {
    expect(parseTaskRef("1234567890")).toBe("1234567890");
  });

  it("extracts task GID from classic URL", () => {
    expect(parseTaskRef("https://app.asana.com/0/1111111111/2222222222")).toBe("2222222222");
  });

  it("extracts task GID from URL with trailing /f", () => {
    expect(parseTaskRef("https://app.asana.com/0/1111111111/2222222222/f")).toBe("2222222222");
  });

  it("extracts focus_task query param", () => {
    expect(
      parseTaskRef("https://app.asana.com/1/123/inbox/abc?focus_task=9999999999"),
    ).toBe("9999999999");
  });

  it("handles the /task/<gid> path style", () => {
    expect(
      parseTaskRef("https://app.asana.com/1/123/project/45/task/77777"),
    ).toBe("77777");
  });

  it("throws on garbage", () => {
    expect(() => parseTaskRef("not a url")).toThrow();
  });

  it("throws when URL has no numeric segment", () => {
    expect(() => parseTaskRef("https://app.asana.com/foo/bar")).toThrow();
  });

  it("rejects non-asana hosts even with numeric path segments", () => {
    expect(() => parseTaskRef("https://example.com/0/1234/5678")).toThrow(/Not an Asana URL/);
    expect(() => parseTaskRef("https://evil.app.asana.com.attacker.example/0/1/2")).toThrow(/Not an Asana URL/);
  });
});
