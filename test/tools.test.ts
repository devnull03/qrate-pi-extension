import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";
import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { TSchema } from "typebox";
import { afterEach, expect, it, vi } from "vitest";

const spawn = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ spawn }));

import qrateExtension from "../extensions/qrate.js";

afterEach(() => {
  spawn.mockReset();
  delete process.env.QRATE_CLI;
});

/** A CLI that answers each call with the next of `answers`, recording its arguments. */
function cli(answers: unknown[]) {
  const calls: string[][] = [];
  spawn.mockImplementation((_cli: string, args: string[]) => {
    calls.push(args);
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const child = Object.assign(new EventEmitter(), {
      stdout,
      stderr,
      stdin: new Writable({
        write: (_chunk, _encoding, done) => done(),
        final(done) {
          done();
          stdout.on("end", () => child.emit("close", 0));
          stdout.end(JSON.stringify(answers.shift()));
          stderr.end();
        },
      }),
    });
    return child;
  });
  return calls;
}

const descriptor = (name: string, effect: string, input: object = { type: "object", properties: {} }) => ({
  name,
  group: "test",
  summary: `${name} summary.`,
  effect,
  exposure: "agent",
  result: name,
  input,
  output: { type: "object", properties: { items: { type: "array" } } },
});

it("builds one tool per capability from qrate's catalog and calls it by name", async () => {
  process.env.QRATE_CLI = "qrate-cli";
  const calls = cli([
    {
      capabilities: [
        descriptor("overview", "read"),
        descriptor("rename_column", "edit", { type: "object", properties: { column: { type: "string" } }, required: ["column"] }),
        descriptor("authority_search", "reach_network"),
        { ...descriptor("secret", "edit"), exposure: "archivist_only" },
        descriptor("thumbnails", "read"),
      ],
    },
    { revision: 3, result: "thumbnails", items: [{ row: 0, page: 0, media_type: "image/png", data: "x".repeat(400) }] },
  ]);
  const tools: ToolDefinition<TSchema, unknown, unknown>[] = [];
  const handlers: Record<string, (event: unknown, ctx: unknown) => Promise<unknown>> = {};
  const active: string[] = [];
  qrateExtension({
    on: (event: string, handler: (event: unknown, ctx: unknown) => Promise<unknown>) => {
      handlers[event] = handler;
    },
    registerTool: (tool: ToolDefinition<TSchema, unknown, unknown>) => tools.push(tool),
    registerCommand: vi.fn(),
    getActiveTools: () => active,
    setActiveTools: (names: string[]) => active.splice(0, active.length, ...names),
  } as unknown as ExtensionAPI);

  await handlers.session_start({}, { signal: undefined, ui: { notify: vi.fn(), setStatus: vi.fn() } });
  expect(calls[0]).toEqual(["agent", "capabilities"]);
  expect(tools.map((tool) => [tool.name, tool.exposure])).toEqual([
    ["qrate_overview", "direct"],
    ["qrate_rename_column", "codemode"],
    ["qrate_authority_search", "deferred"],
    ["qrate_thumbnails", "codemode"],
  ]);
  expect(tools[1].parameters).toMatchObject({ required: ["column"] });
  expect(tools[1].description).toContain("one undo step");
  expect(active).toEqual(["qrate_overview"]);

  const thumbnails = tools[3];
  const result = await thumbnails.execute("call", { items: [{ row: 0 }] }, undefined, undefined, {} as never);
  expect(calls[1]).toEqual(["agent", "call", "thumbnails"]);
  expect(result.content[1]).toMatchObject({ type: "image", mimeType: "image/png" });
  expect((result.content[0] as { text: string }).text).toContain("<image>");
  expect(result.structuredContent).toMatchObject({ result: "thumbnails" });
});
