import { Type } from "@earendil-works/pi-ai";
import type { TObject } from "typebox";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { callQrate } from "../src/cli.js";
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
      const result = await callQrate(method, Object.keys(params).length ? params : undefined, signal);
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
  pi.registerTool(
    tool(
      "qrate_stage_column_rewrite",
      "stage qrate column rewrite",
      "Stage new whole-cell values for one column as a single draft the archivist previews and applies in one step. Use this for every bulk edit of a column; never stage it cell by cell as findings. Replaces your earlier rewrite of the same column and never changes a cell.",
      "stage_column_rewrite",
      Type.Object({
        revision: Type.Integer({ minimum: 0 }),
        column: Type.String({ minLength: 1 }),
        values: Type.Array(
          Type.Tuple([
            Type.Integer({ minimum: 0, description: "Source-row index returned by qrate" }),
            Type.String({ maxLength: 65536, description: "Whole new cell text" }),
          ]),
          { maxItems: 50000 },
        ),
        note: Type.Optional(
          Type.String({ maxLength: 512, description: "Shown once beside the draft, e.g. where the values came from" }),
        ),
      }),
    ),
  );
  pi.registerTool(
    tool(
      "qrate_stage_renames",
      "stage qrate file renames",
      "Stage renames of files the rows link to, as one draft the archivist applies in one undoable step. Paths are relative to the project folder and must stay inside it. This is the only way to rename project files; it replaces your earlier staged renames and renames nothing itself.",
      "stage_renames",
      Type.Object({
        revision: Type.Integer({ minimum: 0 }),
        renames: Type.Array(
          Type.Object({
            row: Type.Integer({ minimum: 0, description: "Source-row index of the row linking the file" }),
            from: Type.String({ minLength: 1, description: "Current path, relative to the project folder" }),
            to: Type.String({ minLength: 1, description: "New path, relative to the project folder" }),
          }),
          { maxItems: 50000 },
        ),
      }),
    ),
  );
  pi.registerTool(
    tool(
      "qrate_edit_table",
      "edit the qrate table",
      "Change the table's shape at once, as one undo step credited to you: add_rows, add_column, rename_column, move_column, describe_column, move_row, indent_row, outdent_row, duplicate_row, or filter. Never use it to change existing cell values; stage those with qrate_stage_column_rewrite or qrate_stage_findings.",
      "edit",
      Type.Object({
        revision: Type.Integer({ minimum: 0 }),
        op: Type.Union([
          Type.Literal("add_rows"),
          Type.Literal("add_column"),
          Type.Literal("rename_column"),
          Type.Literal("move_column"),
          Type.Literal("describe_column"),
          Type.Literal("move_row"),
          Type.Literal("indent_row"),
          Type.Literal("outdent_row"),
          Type.Literal("duplicate_row"),
          Type.Literal("filter"),
        ]),
        rows: Type.Optional(
          Type.Array(Type.Record(Type.String(), Type.String()), {
            maxItems: 1000,
            description: "add_rows: each new row as column name to value",
          }),
        ),
        column: Type.Optional(Type.String({ description: "The column the operation acts on" })),
        name: Type.Optional(Type.String({ description: "add_column, rename_column: the new name" })),
        after: Type.Optional(
          Type.String({ description: "add_column, move_column: the column to place it after; omit for first" }),
        ),
        data_type: Type.Optional(Type.String({ description: "describe_column: Title, Text, Date, Filename, Number, Url, Identifier, …" })),
        description: Type.Optional(Type.String({ description: "describe_column: what the column holds" })),
        row: Type.Optional(Type.Integer({ minimum: 0, description: "Source-row index" })),
        target: Type.Optional(Type.Integer({ minimum: 0, description: "move_row: the row to place it beside or under" })),
        placement: Type.Optional(Type.Union([Type.Literal("before"), Type.Literal("after"), Type.Literal("child")])),
        keep: Type.Optional(
          Type.Array(Type.String(), { description: "filter: values to show; omit to clear the filter" }),
        ),
      }),
    ),
  );
  pi.registerTool(
    tool(
      "qrate_delete",
      "ask to delete in qrate",
      "Ask the archivist to delete rows or one column. qrate shows them your reason in a dialog and this waits for their answer: `deleted`, or a refusal `delete_declined` / `delete_timed_out`. Give exactly one of rows or column, and a plain one-sentence reason.",
      "delete",
      Type.Object({
        revision: Type.Integer({ minimum: 0 }),
        rows: Type.Optional(Type.Array(Type.Integer({ minimum: 0 }), { minItems: 1, maxItems: 1000 })),
        column: Type.Optional(Type.String({ minLength: 1 })),
        reason: Type.String({ minLength: 1, maxLength: 512, description: "Why, shown to the archivist" }),
      }),
    ),
  );
}
