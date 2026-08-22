import { isAbsolute, relative, resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

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

function pathFrom(input: Record<string, unknown>): string | undefined {
  for (const key of ["path", "file_path", "directory"]) {
    if (typeof input[key] === "string") return input[key];
  }
  return undefined;
}

export function installPermissionGate(pi: ExtensionAPI): void {
  pi.on("tool_call", async (event, ctx) => {
    try {
      const input = event.input as Record<string, unknown>;
      let title: string | undefined;
      let detail: string | undefined;

      if (event.toolName === "bash") {
        title = "Allow shell command?";
        detail = `${String(input.command ?? "")}`;
      } else if (MUTATIONS.has(event.toolName)) {
        const path = pathFrom(input) ?? "unknown path";
        title = `Allow ${event.toolName}?`;
        detail = resolve(projectRoot() ?? process.cwd(), path);
      } else if (FILE_READS.has(event.toolName)) {
        const path = pathFrom(input);
        if (path && outsideProject(path)) {
          title = "Allow reading outside the project?";
          detail = resolve(projectRoot() ?? process.cwd(), path);
        }
      }

      if (!title) return undefined;
      if (!ctx.hasUI) {
        return { block: true, reason: `${title} No interactive approval UI is available.` };
      }
      const allowed = await ctx.ui.confirm(title, detail ?? "");
      return allowed ? undefined : { block: true, reason: "Blocked by the archivist" };
    } catch (error) {
      return { block: true, reason: `qrate's permission check failed closed: ${String(error)}` };
    }
  });
}
