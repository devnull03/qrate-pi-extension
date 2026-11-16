import { describe, expect, it } from "vitest";
import { outsideProject, renamesInProject } from "../src/permissions.js";

describe("project boundary", () => {
  it("allows descendants and detects traversal or absolute outsiders", () => {
    const root = process.platform === "win32" ? "C:\\archive" : "/archive";
    expect(outsideProject("metadata/notes.md", root)).toBe(false);
    expect(outsideProject("../secret.txt", root)).toBe(true);
    const outside = process.platform === "win32" ? "D:\\secret.txt" : "/secret.txt";
    expect(outsideProject(outside, root)).toBe(true);
  });

  it("spots a shell rename inside the project and leaves other commands alone", () => {
    const root = process.platform === "win32" ? "C:\\archive" : "/archive";
    const outside = process.platform === "win32" ? "D:\\tmp" : "/tmp";
    expect(renamesInProject("mv photos/1.jpg photos/AD-001.jpg", root)).toBe(true);
    expect(renamesInProject("cd photos && mv -n 1.jpg AD-001.jpg", root)).toBe(true);
    expect(renamesInProject("Move-Item photos\\1.jpg photos\\AD-001.jpg", root)).toBe(true);
    expect(renamesInProject("ren 1.jpg AD-001.jpg", root)).toBe(true);
    expect(renamesInProject("rename 's/^/AD-/' *.jpg", root)).toBe(true);
    expect(renamesInProject(`mv ${outside}/a.txt ${outside}/b.txt`, root)).toBe(false);
    expect(renamesInProject("ls photos | grep mv", root)).toBe(false);
    expect(renamesInProject("git status", root)).toBe(false);
  });
});
