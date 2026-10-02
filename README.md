# qrate Pi extension

This package makes [Pi](https://github.com/earendil-works/pi) the embedded agent inside
[qrate](https://github.com/devnull03/qrate). It supplies typed qrate tools, the embedded
assistant's system prompt, confirmation gates around Pi's coding tools, and a separate
`qrate-live-review` skill for external Pi installations.

qrate bundles and loads a pinned release explicitly with skills disabled; its built-in assistant
uses `SYSTEM.md`, not the external-agent skill. The extension is not a qrate Luau plugin and does
not write archive cells: `qrate_stage_findings` only publishes drafts that the archivist may accept
from qrate's existing Problems panel and Fixes menu.

## Use it in your own Pi

Inside qrate you install nothing: the Agent panel loads this package for you. To use the same tools
in a Pi you installed yourself, you need qrate with its `qrate` command on `PATH` (check with
`qrate version`; the [command-line guide](https://qrate.dvnl.work/docs/cli) covers each platform).
Then load this package as a Pi extension and open your project in qrate. The tools call `qrate` from
`PATH` and show up in qrate's Agent panel under the name `pi`; set `QRATE_AGENT` to use another.

## Development

```sh
npm install
npm run check
npm test
```

The runtime contract is qrate's `qrate agent` command. qrate starts Pi with `QRATE_CLI` (the
`qrate-cli` shipped beside the app) and `QRATE_AGENT=pi`; each tool runs
`$QRATE_CLI agent <command>` with its parameters as JSON on stdin. Without those variables the tools
run `qrate` from `PATH` as `pi`. Exit `1` is a refusal with JSON on stdout, and any other failure
reports the CLI's stderr. A change to that command's contract
needs a new extension release and a new pin in qrate's `scripts/fetch-agent-runtime.*`.
