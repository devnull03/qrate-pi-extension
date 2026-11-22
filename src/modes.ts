import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Descriptor } from "./cli.js";

export type Mode = "review" | "edit" | "connected";
export const MODES: Mode[] = ["review", "edit", "connected"];

/** What each mode lets a qrate tool do. Each mode includes the ones before it. */
const ALLOWED: Record<Mode, Descriptor["effect"][]> = {
  review: ["read", "stage"],
  edit: ["read", "stage", "edit", "confirm", "reach_files"],
  connected: ["read", "stage", "edit", "confirm", "reach_files", "reach_network"],
};

export function allows(mode: Mode, effect: Descriptor["effect"]): boolean {
  return ALLOWED[mode].includes(effect);
}

export const MODE_HELP: Record<Mode, string> = {
  review: "read the project and stage drafts for you to apply",
  edit: "also change the table's shape, ask to delete, and read files you allow",
  connected: "also look things up in authority files over the network, once you allow each one",
};

/** Where the mode chosen for each project is kept, inside qrate's private Pi profile. */
function store(): string | undefined {
  const profile = process.env.PI_CODING_AGENT_DIR;
  return profile ? join(profile, "qrate-modes.json") : undefined;
}

function projectKey(): string {
  return createHash("sha256").update(process.env.QRATE_PROJECT_DIR ?? "").digest("hex").slice(0, 32);
}

function read(): Record<string, Mode> {
  const path = store();
  if (!path) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, Mode>;
  } catch {
    return {};
  }
}

/** The mode for the open project: `review` the first time Pi opens it, then whatever was chosen. */
export function currentMode(): Mode {
  const saved = read()[projectKey()];
  return saved && MODES.includes(saved) ? saved : "review";
}

export function saveMode(mode: Mode): void {
  const path = store();
  if (!path) return;
  const modes = read();
  modes[projectKey()] = mode;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(modes, null, 2));
}
