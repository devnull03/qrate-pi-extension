# qrate Pi extension

This package makes [Pi](https://github.com/earendil-works/pi) the embedded agent inside
[qrate](https://github.com/devnull03/qrate). It supplies typed qrate tools, the embedded
assistant's system prompt, confirmation gates around Pi's coding tools, and a separate
`qrate-live-review` skill for external Pi installations.

qrate bundles and loads a pinned release explicitly with skills disabled; its built-in assistant
uses `SYSTEM.md`, not the external-agent skill. The extension is not a qrate Luau plugin and does
not write archive cells: `qrate_stage_findings` only publishes drafts that the archivist may accept
from qrate's existing Problems panel and Fixes menu.

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
