import { readFile } from "node:fs/promises";

export const BRIDGE_PROTOCOL = 2;

interface Endpoint {
  url: string;
  token: string;
  bridge_protocol: number;
}

export class BridgeError extends Error {}

function endpointPath(): string {
  const path = process.env.QRATE_AGENT_ENDPOINT;
  if (!path) {
    throw new BridgeError("qrate did not provide its agent endpoint path");
  }
  return path;
}

async function endpoint(): Promise<Endpoint> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(endpointPath(), "utf8"));
  } catch (error) {
    throw new BridgeError(`qrate's local bridge is unavailable: ${String(error)}`);
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("url" in parsed) ||
    !("token" in parsed) ||
    !("bridge_protocol" in parsed) ||
    typeof parsed.url !== "string" ||
    typeof parsed.token !== "string" ||
    typeof parsed.bridge_protocol !== "number"
  ) {
    throw new BridgeError("qrate published an invalid agent endpoint");
  }
  if (parsed.bridge_protocol !== BRIDGE_PROTOCOL) {
    throw new BridgeError(
      `qrate bridge protocol ${parsed.bridge_protocol} is incompatible with this extension (expected ${BRIDGE_PROTOCOL})`,
    );
  }
  return parsed as Endpoint;
}

function responseError(result: unknown, status: number): string {
  if (typeof result !== "object" || result === null || !("error" in result)) {
    return `HTTP ${status}`;
  }
  const error = result.error;
  if (typeof error === "string") return error;
  if (typeof error !== "object" || error === null) return `HTTP ${status}`;
  const code = "code" in error && typeof error.code === "string" ? error.code : `HTTP ${status}`;
  const detail = "detail" in error && typeof error.detail === "string" ? error.detail : undefined;
  return detail ? `${code}: ${detail}` : code;
}

export async function callBridge(
  method: string,
  params: Record<string, unknown> | undefined,
  signal?: AbortSignal,
): Promise<unknown> {
  const connection = await endpoint();
  const body = params === undefined ? { method } : { method, params };
  let response: Response;
  try {
    response = await fetch(connection.url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${connection.token}`,
        "content-type": "application/json",
        "x-agent": "pi/qrate",
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    throw new BridgeError(`qrate's local bridge could not be reached: ${String(error)}`);
  }

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new BridgeError(`qrate returned an unreadable response (${response.status})`);
  }
  if (!response.ok) {
    const reason = responseError(result, response.status);
    throw new BridgeError(`qrate refused the request: ${reason}`);
  }
  return result;
}
