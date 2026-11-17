# qrate Pi extension

This package makes [Pi](https://github.com/earendil-works/pi) the embedded agent inside
[qrate](https://github.com/devnull03/qrate). It supplies typed qrate tools, the embedded
assistant's system prompt, confirmation gates around Pi's coding tools, and a separate
`qrate-live-review` skill for external Pi installations.

qrate bundles and loads a pinned release explicitly with skills disabled; its built-in assistant
uses `SYSTEM.md`, not the external-agent skill. The extension is not a qrate Luau plugin and does
not write archive cells or rename files: `qrate_stage_findings`, `qrate_stage_column_rewrite` and
`qrate_stage_renames` only publish drafts that the archivist may accept from qrate's existing
Problems panel and Fixes menu. A shell `mv`, `rename`, `ren` or `Move-Item` aimed inside the project
is refused outright and pointed at `qrate_stage_renames`. `qrate_edit_table` changes the table's
shape (rows, columns, arrangement, filters) as undoable steps, and `qrate_delete` only asks the
archivist, who confirms or declines in a qrate dialog.

## Development

```sh
npm install
npm run check
npm test
```

The runtime contract is qrate's `qrate agent` command. qrate starts Pi with `QRATE_CLI` (the
`qrate-cli` shipped beside the app) and `QRATE_AGENT=pi`; each tool runs
`$QRATE_CLI agent <command>` with its parameters as JSON on stdin. Exit `1` is a refusal with JSON
on stdout, and any other failure reports the CLI's stderr. A change to that command's contract
needs a new extension release and a new pin in qrate's `scripts/fetch-agent-runtime.*`.

## Approved local files

`qrate_request_file_access` asks qrate to approve read-only access to a file or folder. Built-in reads check the host on every call, including canonical paths, so revocation takes effect without restarting Pi. Grants last until qrate closes; revoke them through the Agent panel session menu or `qrate_forget_file_access`. `qrate_import_files` attaches approved paths as new rows through qrate's importer, skipping existing components and recording one undo step credited to the agent. It links original files without copying or moving them.
