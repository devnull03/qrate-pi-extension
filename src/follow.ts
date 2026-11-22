import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { callQrate } from "./cli.js";

interface Changed {
  changed: boolean;
  revision: number;
  selection: number[];
  events: { seq: number; kind: string; agent: string; detail: string }[];
}

/** What the archivist did, in a sentence for the next turn. */
export function describe(changed: Changed, previous: number[] | undefined): string | undefined {
  const parts: string[] = [];
  const selection = changed.selection.join(",");
  if (previous && previous.join(",") !== selection) {
    parts.push(
      changed.selection.length
        ? `The archivist selected source row(s) ${changed.selection.join(", ")}.`
        : "The archivist cleared the selection.",
    );
  }
  for (const event of changed.events) {
    const what = event.kind.replaceAll("_", " ");
    parts.push(`The archivist: ${what}${event.detail ? ` (${event.detail})` : ""}.`);
  }
  return parts.length ? parts.join(" ") : undefined;
}

/**
 * Follow the archivist while `/qrate-follow` is on: each change becomes a note delivered with
 * their next message. It never starts a turn by itself.
 */
export function follow(pi: ExtensionAPI, signal: AbortSignal): void {
  let revision: number | undefined;
  let selection: number[] | undefined;
  let since = 0;
  void (async () => {
    while (!signal.aborted) {
      try {
        const changed = (await callQrate(
          "wait_for_change",
          { revision, selection, since, timeout_s: 20 },
          signal,
        )) as Changed;
        const note = changed.changed ? describe(changed, selection) : undefined;
        revision = changed.revision;
        selection = changed.selection;
        since = changed.events.at(-1)?.seq ?? since;
        if (note) {
          pi.sendMessage(
            { customType: "qrate-follow", content: note, display: true },
            { deliverAs: "nextTurn" },
          );
        }
      } catch {
        if (signal.aborted) return;
        await new Promise((wait) => setTimeout(wait, 5000));
      }
    }
  })();
}
