import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";

const spawn = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ spawn }));

import { QrateError, callQrate } from "../src/cli.js";

/** A child process that records its stdin, prints `stdout`/`stderr`, then exits with `code`. */
function fakeCli(code: number, stdout: string, stderr = "") {
  const child = Object.assign(new EventEmitter(), {
    input: "",
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    stdin: undefined as unknown as Writable,
  });
  child.stdin = new Writable({
    write(chunk, _encoding, done) {
      child.input += String(chunk);
      done();
    },
    final(done) {
      done();
      const ended = [child.stdout, child.stderr].map((stream) => new Promise((end) => stream.on("end", end)));
      child.stdout.end(stdout);
      child.stderr.end(stderr);
      void Promise.all(ended).then(() => child.emit("close", code));
    },
  });
  return child;
}

afterEach(() => {
  spawn.mockReset();
  delete process.env.QRATE_CLI;
});

describe("qrate CLI client", () => {
  it("runs the bundled CLI with params on stdin", async () => {
    process.env.QRATE_CLI = "/opt/qrate/qrate-cli";
    const child = fakeCli(0, JSON.stringify({ revision: 3 }));
    spawn.mockReturnValue(child);

    await expect(callQrate("stage_findings", { revision: 3, findings: [] })).resolves.toEqual({ revision: 3 });
    expect(spawn.mock.calls[0]?.slice(0, 2)).toEqual(["/opt/qrate/qrate-cli", ["agent", "stage-findings"]]);
    expect(JSON.parse(child.input)).toEqual({ revision: 3, findings: [] });
  });

  it("refuses to run without qrate's CLI path", async () => {
    await expect(callQrate("overview", undefined)).rejects.toThrow(QrateError);
    expect(spawn).not.toHaveBeenCalled();
  });

  it("reports qrate's structured refusal code", async () => {
    process.env.QRATE_CLI = "qrate-cli";
    spawn.mockReturnValue(fakeCli(1, JSON.stringify({ error: { code: "stale_revision" } })));
    await expect(callQrate("overview", undefined)).rejects.toThrow("qrate refused the request: stale_revision");
  });

  it("surfaces the CLI's own message when qrate is unreachable", async () => {
    process.env.QRATE_CLI = "qrate-cli";
    spawn.mockReturnValue(fakeCli(3, "", "qrate: qrate is not running\n"));
    await expect(callQrate("overview", undefined)).rejects.toThrow("qrate: qrate is not running");
  });
});
