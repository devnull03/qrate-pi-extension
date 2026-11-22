import { expect, it } from "vitest";
import { describe } from "../src/follow.js";
import { granted, sandboxed } from "../src/sandbox.js";

it("wraps a shell command so it sees the project and granted paths read-only, offline", () => {
  granted.add("/archive/scans");
  const wrapped = sandboxed("ls", "/work/project", false, "linux", () => true)!;
  expect(wrapped).toContain("'bwrap'");
  expect(wrapped).toContain("'--ro-bind-try' '/work/project' '/work/project'");
  expect(wrapped).toContain("'--ro-bind-try' '/archive/scans' '/archive/scans'");
  expect(wrapped).toContain("'--unshare-net'");
  expect(sandboxed("ls", "/work/project", true, "linux", () => true)).not.toContain("--unshare-net");
  expect(sandboxed("ls", "/work/project", false, "darwin", () => true)).toContain("'sandbox-exec'");
  expect(sandboxed("ls", "/work/project", false, "win32", () => true)).toBeUndefined();
  expect(sandboxed("ls", "/work/project", false, "linux", () => false)).toBeUndefined();
  granted.clear();
});

it("says what the archivist did in a sentence", () => {
  expect(
    describe(
      { changed: true, revision: 2, selection: [3, 4], events: [{ seq: 1, kind: "draft_applied", agent: "pi", detail: "2 applied" }] },
      [],
    ),
  ).toBe("The archivist selected source row(s) 3, 4. The archivist: draft applied (2 applied).");
});
