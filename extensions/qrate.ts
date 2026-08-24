import { Type } from "@earendil-works/pi-ai";
import type { TObject } from "typebox";
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

const querySource = Type.Union([
  Type.Object({ kind: Type.Literal("all_rows") }),
  Type.Object({ kind: Type.Literal("selected_rows") }),
  Type.Object({
    kind: Type.Literal("rows"),
    rows: Type.Array(Type.Integer({ minimum: 0 }), { minItems: 1, maxItems: 100 }),
  }),
  Type.Object({
    kind: Type.Literal("search"),
    text: Type.String({ minLength: 1, maxLength: 256 }),
  }),
  Type.Object({
    kind: Type.Literal("diagnostics"),
    severities: Type.Optional(Type.Array(severity)),
    sources: Type.Optional(Type.Array(Type.String())),
  }),
]);

const queryFilter = Type.Object({
  field: Type.String({ minLength: 1 }),
  op: Type.Union([
    Type.Literal("equals"),
    Type.Literal("not_equals"),
    Type.Literal("contains"),
    Type.Literal("starts_with"),
    Type.Literal("ends_with"),
    Type.Literal("is_blank"),
    Type.Literal("is_not_blank"),
  ]),
  value: Type.Optional(Type.String()),
});

function tool(
  name: string,
  label: string,
  description: string,
  method: string,
  parameters: TObject,
) {
  return defineTool({
    name,
    label,
    description,
    parameters,
    async execute(_id, params, signal) {
      const result = await callBridge(method, Object.keys(params).length ? params : undefined, signal);
      if (method === "thumbnails" && typeof result === "object" && result !== null && "items" in result) {
        const items = Array.isArray(result.items) ? result.items : [];
        const images = items.flatMap((item) => {
          if (
            typeof item === "object" &&
            item !== null &&
            "data" in item &&
            "media_type" in item &&
            typeof item.data === "string" &&
            typeof item.media_type === "string"
          ) {
            return [{ type: "image" as const, data: item.data, mimeType: item.media_type }];
          }
          return [];
        });
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ ...result, items: `${images.length} image(s)` }, null, 2) },
            ...images,
          ],
          details: result,
        };
      }
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
      "qrate_overview",
      "qrate overview",
      "Start here. Read the open project's summary, columns, selection count, diagnostics, and exact revision.",
      "overview",
      Type.Object({}),
    ),
  );
  pi.registerTool(
    tool(
      "qrate_query",
      "query qrate",
      "Read a bounded live projection of rows or diagnostics at the current revision. Follow next_cursor only when more evidence matters.",
      "query",
      Type.Object({
        source: Type.Optional(querySource),
        select: Type.Optional(Type.Array(Type.String(), { maxItems: 64 })),
        where: Type.Optional(Type.Array(queryFilter, { maxItems: 16 })),
        group_by: Type.Optional(Type.Array(Type.String(), { maxItems: 4 })),
        distinct: Type.Optional(Type.String()),
        order_by: Type.Optional(
          Type.Object({ field: Type.String({ minLength: 1 }), descending: Type.Optional(Type.Boolean()) }),
        ),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
        cursor: Type.Optional(Type.String()),
      }),
    ),
  );
  pi.registerTool(
    tool(
      "qrate_program_save",
      "save qrate review program",
      "Validate and activate a confined Luau function without running it.",
      "program_save",
      Type.Object({ source: Type.String({ minLength: 1, maxLength: 65536 }) }),
    ),
  );
  pi.registerTool(
    tool(
      "qrate_program_run",
      "run qrate review program",
      "Run the saved confined Luau function once against an immutable snapshot at the exact revision.",
      "program_run",
      Type.Object({ revision: Type.Integer({ minimum: 0 }), args: Type.Optional(Type.Any()) }),
    ),
  );
  pi.registerTool(
    tool(
      "qrate_thumbnails",
      "qrate thumbnails",
      "Read up to four qrate-generated 512-pixel image derivatives by source row and page.",
      "thumbnails",
      Type.Object({
        items: Type.Array(
          Type.Object({ row: Type.Integer({ minimum: 0 }), page: Type.Optional(Type.Integer({ minimum: 0 })) }),
          { minItems: 1, maxItems: 4 },
        ),
      }),
    ),
  );
  pi.registerTool(
    tool(
      "qrate_stage_findings",
      "stage qrate findings",
      "Publish one complete advisory draft batch for an exact revision. This replaces your prior batch and never changes a cell.",
      "stage_findings",
      Type.Object({
        revision: Type.Integer({ minimum: 0 }),
        findings: Type.Array(finding, { maxItems: 200 }),
      }),
    ),
  );
}
