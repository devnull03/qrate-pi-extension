import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TSchema } from "@earendil-works/pi-ai";
import type {
  ExtensionAPI,
  ExtensionContext,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { afterEach, expect, it, vi } from "vitest";
import qrateExtension from "../extensions/qrate.js";
import { BRIDGE_PROTOCOL } from "../src/bridge.js";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.QRATE_AGENT_ENDPOINT;
});

it("registers only protocol two tools and sends an overview request", async () => {
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

  const dir = await mkdtemp(join(tmpdir(), "qrate-pi-tools-"));
  const endpoint = join(dir, "agent-bridge.json");
  process.env.QRATE_AGENT_ENDPOINT = endpoint;
  await writeFile(
    endpoint,
    JSON.stringify({ url: "http://127.0.0.1:1", token: "secret", bridge_protocol: BRIDGE_PROTOCOL }),
  );
  const fetch = vi.fn(async (_url: string, _init: RequestInit) =>
    new Response(JSON.stringify({ revision: 7, result: "overview", project: { name: "Test" } }), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetch);

  const overview = tools.find((tool) => tool.name === "qrate_overview");
  expect(overview).toBeDefined();
  await overview?.execute("call-1", {}, undefined, undefined, {} as ExtensionContext);

  expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({ method: "overview" });
});
