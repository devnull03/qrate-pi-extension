import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BRIDGE_PROTOCOL, BridgeError, callBridge } from "../src/bridge.js";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.QRATE_AGENT_ENDPOINT;
});

describe("bridge client", () => {
  it("rereads the endpoint and identifies Pi on every call", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qrate-pi-"));
    const path = join(dir, "agent-bridge.json");
    process.env.QRATE_AGENT_ENDPOINT = path;
    await writeFile(path, JSON.stringify({ url: "http://127.0.0.1:1", token: "first", bridge_protocol: BRIDGE_PROTOCOL }));
    const fetch = vi.fn(async (_url: string, init: RequestInit) =>
      new Response(JSON.stringify({ revision: 1, result: "overview", project: {} }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);

    await callBridge("overview", undefined);
    await writeFile(path, JSON.stringify({ url: "http://127.0.0.1:2", token: "second", bridge_protocol: BRIDGE_PROTOCOL }));
    await callBridge("overview", undefined);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0]?.[1]?.headers).toMatchObject({ authorization: "Bearer first", "x-agent": "pi/qrate" });
    expect(fetch.mock.calls[1]?.[1]?.headers).toMatchObject({ authorization: "Bearer second", "x-agent": "pi/qrate" });
  });

  it("refuses an incompatible bridge before sending data", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qrate-pi-"));
    const path = join(dir, "agent-bridge.json");
    process.env.QRATE_AGENT_ENDPOINT = path;
    await writeFile(path, JSON.stringify({ url: "http://127.0.0.1:1", token: "secret", bridge_protocol: 99 }));
    vi.stubGlobal("fetch", vi.fn());
    await expect(callBridge("overview", undefined)).rejects.toThrow(BridgeError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports qrate's structured refusal code", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qrate-pi-"));
    const path = join(dir, "agent-bridge.json");
    process.env.QRATE_AGENT_ENDPOINT = path;
    await writeFile(
      path,
      JSON.stringify({ url: "http://127.0.0.1:1", token: "secret", bridge_protocol: BRIDGE_PROTOCOL }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { code: "project_unavailable" } }), { status: 400 }),
      ),
    );

    await expect(callBridge("overview", undefined)).rejects.toThrow(
      "qrate refused the request: project_unavailable",
    );
  });
});
