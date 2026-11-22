# qrate Pi extension

This package makes [Pi](https://github.com/earendil-works/pi) the embedded agent inside
[qrate](https://github.com/devnull03/qrate). It supplies typed qrate tools, the embedded
assistant's system prompt, confirmation gates around Pi's coding tools, and a separate
`qrate-live-review` skill for external Pi installations.

qrate bundles and loads a pinned release explicitly, with Pi's codemode and tool search on and MCP
off. The tools are not written here: when a session starts the extension reads qrate's capability
catalog (`qrate agent capabilities`) and registers one tool per capability, with its JSON Schema,
its answer's schema for codemode scripts, and an exposure (a few direct tools, the rest reached
through codemode or tool search). A capability added to qrate reaches Pi with no change here.

Nothing here writes archive cells or renames files: those capabilities only stage drafts the
archivist applies in qrate. The extension adds:

- `/qrate-mode review|edit|connected` — what the assistant may do in this project, remembered per
  project; a project starts in review. A tool whose effect the mode does not allow is refused, also
  from inside a codemode script.
- `/qrate-follow` — tells the assistant what the archivist selects and does with its drafts, with
  their next message. It never starts a turn by itself.
- Guards on Pi's own tools: reads outside the project check qrate's read grants on every call; shell
  commands need approval, cannot rename project files or run qrate's CLI, and run in a sandbox
  (bubblewrap on Linux, sandbox-exec on macOS) that sees the system, the project, Pi's temp folder
  and the granted paths, read-only, with no network outside connected mode. Windows has no sandbox,
  so there approval is the only guard.

## Development

```sh
npm install
npm run check
npm test
```

The runtime contract is qrate's `qrate agent` command. qrate starts Pi with `QRATE_CLI` (the
`qrate-cli` shipped beside the app) and `QRATE_AGENT=pi`; each tool runs
`$QRATE_CLI agent call <capability>` with its parameters as JSON on stdin. Exit `1` is a refusal with JSON
on stdout, and any other failure reports the CLI's stderr. A change to that command's contract
needs a new extension release and a new pin in qrate's `scripts/fetch-agent-runtime.*`.

## Approved local files

`qrate_request_file_access` asks qrate to approve read-only access to a file or folder. Built-in reads check the host on every call, including canonical paths, so revocation takes effect without restarting Pi. Grants last until qrate closes; revoke them through the Agent panel session menu or `qrate_forget_file_access`. `qrate_import_files` attaches approved paths as new rows through qrate's importer, skipping existing components and recording one undo step credited to the agent. It links original files without copying or moving them.
