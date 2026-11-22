import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { resolve } from "node:path";

/** Paths outside the project the archivist granted read access to this session. */
export const granted = new Set<string>();

function quote(text: string): string {
  return `'${text.replaceAll("'", `'\\''`)}'`;
}

function has(program: string): boolean {
  try {
    execFileSync("which", [program], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * The shell command wrapped so it sees only the system, the project, Pi's temp folder and the
 * paths the archivist granted, read-only except the temp folder, and no network unless
 * `network`. `undefined` when this machine has no sandbox to offer: Linux needs bubblewrap and
 * macOS has sandbox-exec; Windows has neither, and keeps per-command approval only.
 */
export function sandboxed(
  command: string,
  project: string | undefined,
  network: boolean,
  platform: NodeJS.Platform = process.platform,
  available: (program: string) => boolean = has,
): string | undefined {
  const scratch = resolve(tmpdir());
  const readable = [project, ...granted].filter((path): path is string => Boolean(path)).map((path) => resolve(path));
  if (platform === "linux" && available("bwrap")) {
    const system = ["/usr", "/bin", "/lib", "/lib64", "/lib32", "/sbin", "/etc"].filter(
      (path) => platform !== "linux" || existsSync(path) || path === "/usr",
    );
    const args = [
      "bwrap",
      "--die-with-parent",
      "--new-session",
      ...system.flatMap((path) => ["--ro-bind-try", path, path]),
      "--proc",
      "/proc",
      "--dev",
      "/dev",
      "--bind",
      scratch,
      scratch,
      ...readable.flatMap((path) => ["--ro-bind-try", path, path]),
      ...(project ? ["--chdir", resolve(project)] : []),
      ...(network ? [] : ["--unshare-net"]),
      "--",
      "/bin/sh",
      "-c",
      command,
    ];
    return args.map(quote).join(" ");
  }
  if (platform === "darwin" && available("sandbox-exec")) {
    const home = resolve(homedir());
    const allow = [scratch, ...readable].map((path) => `(subpath ${JSON.stringify(path)})`).join(" ");
    const profile = [
      "(version 1)",
      "(allow default)",
      `(deny file-read* (subpath ${JSON.stringify(home)}))`,
      `(allow file-read* ${allow})`,
      "(deny file-write*)",
      `(allow file-write* (subpath ${JSON.stringify(scratch)}) (literal "/dev/null"))`,
      ...(network ? [] : ["(deny network*)"]),
    ].join(" ");
    return ["sandbox-exec", "-p", profile, "/bin/sh", "-c", command].map(quote).join(" ");
  }
  return undefined;
}
