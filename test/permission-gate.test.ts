import { beforeEach, expect, it, vi } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
const callQrate = vi.hoisted(() => vi.fn());
vi.mock("../src/cli.js", () => ({ callQrate }));
import { installPermissionGate } from "../src/permissions.js";

type Gate = (event: { toolName: string; input: Record<string, unknown> }, ctx: { hasUI: boolean; ui: { confirm: ReturnType<typeof vi.fn> } }) => Promise<{ block: boolean; reason: string } | undefined>;
function gate(): Gate {
  let handler: Gate | undefined;
  installPermissionGate({ on: (_event: string, next: Gate) => { handler = next; } } as unknown as ExtensionAPI);
  return handler!;
}
const context = { hasUI: true, ui: { confirm: vi.fn() } };
const read = { toolName: "read", input: { path: "/outside/notes.txt" } };
beforeEach(() => { callQrate.mockReset(); context.ui.confirm.mockReset(); });

it("checks the host on every read so grants cannot survive revocation in Pi's cache", async () => {
  const check = gate();
  callQrate.mockResolvedValueOnce({ result: "file_access" });
  expect(await check(read, context)).toBeUndefined();
  callQrate.mockRejectedValueOnce(new Error("file_access_required"));
  callQrate.mockRejectedValueOnce(new Error("file_access_denied"));
  expect(await check(read, context)).toMatchObject({ block: true });
  expect(callQrate.mock.calls.map(([method]) => method)).toEqual(["check_access", "check_access", "request_access"]);
  expect(context.ui.confirm).not.toHaveBeenCalled();
});

it("uses qrate's consent dialog and does not repeat a declined prompt", async () => {
  const check = gate();
  callQrate.mockRejectedValue(new Error("file_access_denied"));
  expect(await check(read, context)).toMatchObject({ block: true });
  expect(await check(read, context)).toMatchObject({ block: true });
  expect(callQrate.mock.calls.filter(([method]) => method === "request_access")).toHaveLength(1);
});

it("allows an approved request and requires UI before requesting an unapproved path", async () => {
  const check = gate();
  callQrate.mockRejectedValueOnce(new Error("file_access_required"));
  callQrate.mockResolvedValueOnce({ result: "file_access" });
  expect(await check(read, context)).toBeUndefined();
  callQrate.mockRejectedValueOnce(new Error("file_access_required"));
  expect(await check(read, { ...context, hasUI: false })).toMatchObject({ block: true });
  expect(callQrate.mock.calls.filter(([method]) => method === "request_access")).toHaveLength(1);
});
