import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";
import type { TSchema } from "@earendil-works/pi-ai";
import type {
  ExtensionAPI,
  ExtensionContext,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { afterEach, expect, it, vi } from "vitest";

const spawn = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ spawn }));

import qrateExtension from "../extensions/qrate.js";

afterEach(() => {
  spawn.mockReset();
  delete process.env.QRATE_CLI;
});

it("registers the qrate tools and runs an overview through the CLI", async () => {
  const tools: ToolDefinition<TSchema, unknown, unknown>[] = [];
  qrateExtension({
    on: vi.fn(),
    registerTool: (tool: ToolDefinition<TSchema, unknown, unknown>) => {
      tools.push(tool);
    },
  } as unknown as ExtensionAPI);

  expect(tools.map((tool) => tool.name)).toEqual([
    "qrate_overview",
    "qrate_query",
    "qrate_program_save",
    "qrate_program_run",
    "qrate_thumbnails",
    "qrate_stage_findings",
  ]);

  process.env.QRATE_CLI = "qrate-cli";
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
        stdout.end(JSON.stringify({ revision: 7, project: { name: "Test" } }));
        stderr.end();
      },
    }),
  });
  spawn.mockReturnValue(child);

  const overview = tools.find((tool) => tool.name === "qrate_overview");
  const result = await overview?.execute("call-1", {}, undefined, undefined, {} as ExtensionContext);

  expect(spawn.mock.calls[0]?.[1]).toEqual(["agent", "overview"]);
  expect(result?.details).toEqual({ revision: 7, project: { name: "Test" } });
});
