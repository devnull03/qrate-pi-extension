import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { capabilities, type Descriptor } from "../src/cli.js";
import { follow } from "../src/follow.js";
import { allows, currentMode, MODE_HELP, MODES, type Mode, saveMode } from "../src/modes.js";
import { installPermissionGate } from "../src/permissions.js";
import { exposureOf, qrateTool, toolName } from "../src/tools.js";

/**
 * Every qrate capability becomes a Pi tool, read from qrate's own catalog when a session starts,
 * so a capability added to qrate needs no change here.
 */
export default function qrateExtension(pi: ExtensionAPI): void {
  const effects = new Map<string, Descriptor["effect"]>();
  let mode: Mode = currentMode();
  let following: AbortController | undefined;
  installPermissionGate(pi, { effectOf: (tool) => effects.get(tool), mode: () => mode });

  /** Declare the direct qrate tools this mode allows, and hide the rest. */
  const applyMode = () => {
    const qrate = [...effects.entries()];
    const hidden = new Set(qrate.filter(([, effect]) => !allows(mode, effect)).map(([name]) => name));
    const shown = qrate
      .filter(([name, effect]) => allows(mode, effect) && direct.has(name))
      .map(([name]) => name);
    const active = pi.getActiveTools().filter((name) => !hidden.has(name));
    pi.setActiveTools([...new Set([...active, ...shown])]);
  };
  const direct = new Set<string>();

  const load = async (ctx: ExtensionContext) => {
    let catalog: Descriptor[];
    try {
      catalog = await capabilities(ctx.signal);
    } catch (error) {
      ctx.ui.notify(`qrate's tools are unavailable: ${String(error)}`, "warning");
      return;
    }
    for (const descriptor of catalog.filter((descriptor) => descriptor.exposure === "agent")) {
      const name = toolName(descriptor.name);
      if (!effects.has(name)) pi.registerTool(qrateTool(descriptor));
      effects.set(name, descriptor.effect);
      if (exposureOf(descriptor) === "direct") direct.add(name);
    }
    applyMode();
    ctx.ui.setStatus("qrate-mode", `qrate: ${mode}`);
  };

  pi.on("session_start", async (_event, ctx) => load(ctx));

  pi.registerCommand("qrate-mode", {
    description: "Choose what the assistant may do in this project: review, edit or connected",
    getArgumentCompletions: (prefix: string) =>
      MODES.filter((name) => name.startsWith(prefix)).map((name) => ({ value: name, label: `${name} — ${MODE_HELP[name]}` })),
    handler: async (args, ctx) => {
      const wanted = args.trim() as Mode;
      if (!MODES.includes(wanted)) {
        ctx.ui.notify(
          `qrate is in ${mode} mode: ${MODE_HELP[mode]}. Choose one of: ${MODES.join(", ")}.`,
          "info",
        );
        return;
      }
      mode = wanted;
      saveMode(mode);
      applyMode();
      ctx.ui.setStatus("qrate-mode", `qrate: ${mode}`);
      ctx.ui.notify(`qrate ${mode} mode: the assistant may ${MODE_HELP[mode]}.`, "info");
    },
  });

  pi.registerCommand("qrate-follow", {
    description: "Tell the assistant what you select and do in qrate, with your next message (on/off)",
    handler: async (args, ctx) => {
      const on = args.trim() !== "off" && !(args.trim() === "" && following);
      following?.abort();
      following = undefined;
      if (on) {
        following = new AbortController();
        follow(pi, following.signal);
      }
      ctx.ui.setStatus("qrate-follow", on ? "following qrate" : undefined);
      ctx.ui.notify(on ? "Following what you do in qrate." : "Stopped following qrate.", "info");
    },
  });

  pi.on("session_shutdown", async () => following?.abort());
}
