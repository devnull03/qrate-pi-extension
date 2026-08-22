import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { callBridge } from "../src/bridge.js";
import { installPermissionGate } from "../src/permissions.js";

const severity = Type.Union([Type.Literal("error"), Type.Literal("warning"), Type.Literal("note")]);
const finding = Type.Object({
  row: Type.Integer({ minimum: 0, description: "Source-row index returned by qrate" }),
  column: Type.String({ minLength: 1 }),
  severity,
  message: Type.String({ minLength: 1, maxLength: 512 }),
  expected: Type.String({ description: "Exact whole cell text that was reviewed" }),
  replacement: Type.Optional(Type.String({ description: "Optional whole replacement cell text" })),
});

function tool(
  name: string,
  label: string,
  description: string,
  method: string,
  parameters: ReturnType<typeof Type.Object>,
) {
  return defineTool({
    name,
    label,
    description,
    parameters,
    async execute(_id, params, signal) {
      const result = await callBridge(method, Object.keys(params).length ? params : undefined, signal);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        details: result,
      };
    },
  });
}

export default function qrateExtension(pi: ExtensionAPI): void {
  installPermissionGate(pi);
  pi.registerTool(
    tool(
      "qrate_project_summary",
      "qrate project summary",
      "Start here. Read the open qrate project's name, row and column counts, files-folder state, and revision.",
      "project_summary",
      Type.Object({}),
    ),
  );
  pi.registerTool(
    tool(
      "qrate_columns",
      "qrate columns",
      "Read every live column's name, configured data type, and notes before interpreting row values.",
      "columns",
      Type.Object({}),
    ),
  );
  pi.registerTool(
    tool(
      "qrate_rows",
      "qrate rows",
      "Read 1-100 live rows by source index. Indices do not change with qrate's active filter.",
      "rows",
      Type.Object({ rows: Type.Array(Type.Integer({ minimum: 0 }), { minItems: 1, maxItems: 100 }) }),
    ),
  );
  pi.registerTool(
    tool(
      "qrate_search_rows",
      "qrate search rows",
      "Search live column names and cell text case-insensitively; use this to find focused candidates, not to scan everything.",
      "search_rows",
      Type.Object({
        query: Type.String({ minLength: 1, maxLength: 256 }),
        limit: Type.Integer({ minimum: 1, maximum: 100 }),
      }),
    ),
  );
  pi.registerTool(
    tool(
      "qrate_diagnostics",
      "qrate diagnostics",
      "Read qrate's existing validator findings before reviewing so you do not restate what the app already found.",
      "diagnostics",
      Type.Object({}),
    ),
  );
  pi.registerTool(
    tool(
      "qrate_selected_rows",
      "qrate selected rows",
      "Return source-row indices currently selected by the archivist. Use when they say 'these' or 'my selection'.",
      "selected_rows",
      Type.Object({}),
    ),
  );
  pi.registerTool(
    tool(
      "qrate_stage_findings",
      "stage qrate findings",
      "Publish one complete batch of advisory findings. This replaces your prior batch and never changes a cell.",
      "stage_findings",
      Type.Object({
        revision: Type.Integer({ minimum: 0 }),
        findings: Type.Array(finding, { maxItems: 200 }),
      }),
    ),
  );
}
