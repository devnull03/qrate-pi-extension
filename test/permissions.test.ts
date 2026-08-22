import { describe, expect, it } from "vitest";
import { outsideProject } from "../src/permissions.js";

describe("project boundary", () => {
  it("allows descendants and detects traversal or absolute outsiders", () => {
    const root = process.platform === "win32" ? "C:\\archive" : "/archive";
    expect(outsideProject("metadata/notes.md", root)).toBe(false);
    expect(outsideProject("../secret.txt", root)).toBe(true);
    const outside = process.platform === "win32" ? "D:\\secret.txt" : "/secret.txt";
    expect(outsideProject(outside, root)).toBe(true);
  });
});
