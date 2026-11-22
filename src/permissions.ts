import { isAbsolute, relative, resolve } from "node:path";
import { callQrate, type Descriptor } from "./cli.js";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { allows, type Mode } from "./modes.js";
import { granted, sandboxed } from "./sandbox.js";

const MUTATIONS = new Set(["edit", "write"]);
const FILE_READS = new Set(["read", "grep", "find", "ls"]);

function projectRoot(): string | undefined {
  const root = process.env.QRATE_PROJECT_DIR;
  return root ? resolve(root) : undefined;
}

export function outsideProject(path: string, root = projectRoot()): boolean {
  if (!root) return true;
  const full = resolve(root, path);
  const rel = relative(root, full);
  return rel === ".." || rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(rel);
}

const RENAMERS = new Set(["mv", "rename", "move-item", "rename-item", "ren", "move"]);
/** Whether a shell command runs qrate's own CLI, which the qrate tools already cover with their checks. */
export function runsQrate(command: string, cli = process.env.QRATE_CLI): boolean {
  return /(^|[\s;&|(])qrate(-cli)?(\.exe)?\s+agent\b/.test(command) || Boolean(cli && command.includes(cli));
}

/** What the gate needs to know about qrate's tools. */
export interface Policy {
  effectOf(tool: string): Descriptor["effect"] | undefined;
  mode(): Mode;
}

export const RENAME_REASON =
  "Renaming files in the project goes through qrate_stage_renames, so qrate can update the rows that link them and undo it. Stage the renames instead.";

/** Whether a shell command would rename or move something inside the project. */
export function renamesInProject(command: string, root = projectRoot()): boolean {
  return command.split(/[;&|\n]+/).some((segment) => {
    const words = segment.trim().split(/\s+/).filter(Boolean);
    if (words[0] === "sudo") words.shift();
    if (!RENAMERS.has((words[0] ?? "").toLowerCase())) return false;
    const paths = words.slice(1).filter((word) => !word.startsWith("-"));
    return paths.length === 0 || paths.some((path) => !outsideProject(path.replace(/^["']|["']$/g, ""), root));
  });
}

function pathFrom(input: Record<string, unknown>): string | undefined {
  for (const key of ["path", "file_path", "directory"]) {
    if (typeof input[key] === "string") return input[key];
  }
  return undefined;
}

export function installPermissionGate(pi: ExtensionAPI, policy: Policy): void {
  const denied = new Set<string>();
  pi.on("tool_result", async (event) => {
    if (event.isError) return;
    const details = event.details as { path?: unknown } | undefined;
    if (event.toolName === "qrate_request_access" && typeof details?.path === "string") granted.add(details.path);
    if (event.toolName === "qrate_forget_access") granted.clear();
  });
  pi.on("tool_call", async (event, ctx) => {
    try {
      const input = event.input as Record<string, unknown>;
      let title: string | undefined;
      let detail: string | undefined;

      const effect = policy.effectOf(event.toolName);
      if (effect && !allows(policy.mode(), effect)) {
        return {
          block: true,
          reason: `qrate is in ${policy.mode()} mode, which does not allow ${event.toolName}. Ask the archivist to switch with /qrate-mode.`,
        };
      }
      if (effect) return undefined;
      if (event.toolName === "bash" && renamesInProject(String(input.command ?? ""))) {
        return { block: true, reason: RENAME_REASON };
      }
      if (event.toolName === "bash" && runsQrate(String(input.command ?? ""))) {
        return { block: true, reason: "Use the qrate_* tools rather than running qrate's CLI from the shell." };
      }
      if (event.toolName === "bash") {
        title = "Allow shell command?";
        detail = `${String(input.command ?? "")}`;
      } else if (MUTATIONS.has(event.toolName)) {
        const path = pathFrom(input) ?? "unknown path";
        title = `Allow ${event.toolName}?`;
        detail = resolve(projectRoot() ?? process.cwd(), path);
      } else if (FILE_READS.has(event.toolName)) {
        const path = resolve(projectRoot() ?? process.cwd(), pathFrom(input) ?? ".");
        try {
          // Check with qrate every time so revocation and canonical symlink checks stay effective.
          await callQrate("check_access", { path });
          return undefined;
        } catch {
          if (denied.has(path)) return { block: true, reason: "Read access was declined. Do not ask again without a new user instruction." };
          if (!ctx.hasUI) return { block: true, reason: "Read access requires the archivist's approval in qrate." };
          try {
            await callQrate("request_access", { path, reason: `Read this path with Pi's ${event.toolName} tool for the archivist's request.` });
            granted.add(path);
            return undefined;
          } catch (error) {
            denied.add(path);
            return { block: true, reason: `qrate did not grant read access: ${String(error)}` };
          }
        }
      }

      if (!title) return undefined;
      if (!ctx.hasUI) {
        return { block: true, reason: `${title} No interactive approval UI is available.` };
      }
      const allowed = await ctx.ui.confirm(title, detail ?? "");
      if (!allowed) return { block: true, reason: "Blocked by the archivist" };
      if (event.toolName === "bash") {
        const command = String(input.command ?? "");
        const wrapped = sandboxed(command, projectRoot(), allows(policy.mode(), "reach_network"));
        if (wrapped) input.command = wrapped;
      }
      return undefined;
    } catch (error) {
      return { block: true, reason: `qrate's permission check failed closed: ${String(error)}` };
    }
  });
}
