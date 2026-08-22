# qrate Pi extension

This package makes [Pi](https://github.com/earendil-works/pi) the embedded agent inside
[qrate](https://github.com/devnull03/qrate). It supplies typed tools for qrate's live-agent bridge,
a metadata-review skill and system prompt, and confirmation gates around Pi's coding tools.

qrate bundles and loads a pinned release explicitly. The extension is not a qrate Luau plugin and
does not write archive cells: `qrate_stage_findings` only publishes drafts that the archivist may
accept from qrate's existing Problems panel and Fixes menu.

## Development

```sh
npm install
npm run check
npm test
```

The runtime contract is `bridge_protocol: 1`. Breaking bridge changes require a protocol bump in
both repositories and a new extension release.
