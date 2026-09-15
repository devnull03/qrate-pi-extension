import { spawn } from "node:child_process";

export class QrateError extends Error {}

function refusal(stdout: string): string {
  let result: unknown;
  try {
    result = JSON.parse(stdout);
  } catch {
    return "unreadable refusal";
  }
  if (typeof result !== "object" || result === null || !("error" in result)) return "unknown refusal";
  const error = result.error;
  if (typeof error === "string") return error;
  if (typeof error !== "object" || error === null) return "unknown refusal";
  const code = "code" in error && typeof error.code === "string" ? error.code : "request_error";
  const detail = "detail" in error && typeof error.detail === "string" ? error.detail : undefined;
  return detail ? `${code}: ${detail}` : code;
}

/** Runs `$QRATE_CLI agent <method>` with the params on stdin. qrate sets QRATE_CLI and QRATE_AGENT. */
export async function callQrate(
  method: string,
  params: Record<string, unknown> | undefined,
  signal?: AbortSignal,
): Promise<unknown> {
  const cli = process.env.QRATE_CLI;
  if (!cli) throw new QrateError("qrate did not provide its CLI path");

  const child = spawn(cli, ["agent", method.replaceAll("_", "-")], { signal, windowsHide: true });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => (stdout += chunk));
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => (stderr += chunk));
  child.stdin.on("error", () => {});
  child.stdin.end(JSON.stringify(params ?? {}));

  const code = await new Promise<number | null>((resolve, reject) => {
    child.on("error", (error) => reject(new QrateError(`qrate's CLI could not run: ${String(error)}`)));
    child.on("close", resolve);
  });
  if (code === 1) throw new QrateError(`qrate refused the request: ${refusal(stdout)}`);
  if (code !== 0) throw new QrateError(stderr.trim() || `qrate's CLI exited with ${code}`);
  try {
    return JSON.parse(stdout);
  } catch {
    throw new QrateError("qrate returned an unreadable response");
  }
}
