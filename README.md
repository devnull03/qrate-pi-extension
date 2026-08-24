# qrate Pi extension

This package makes [Pi](https://github.com/earendil-works/pi) the embedded agent inside
[qrate](https://github.com/devnull03/qrate). It supplies typed protocol 2 tools, the embedded
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

The runtime contract is `bridge_protocol: 2`. Breaking bridge changes require a protocol bump in
both repositories and a new extension release.
