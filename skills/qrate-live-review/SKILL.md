---
name: qrate-live-review
description: Review or answer questions about the live metadata project open in qrate, including the current selection, diagnostics, rows, media, and draft findings.
---

# Review the project open in qrate

1. Call `qrate_overview` before interpreting values. Keep its exact revision for any later program run or staged findings.
2. Use `qrate_query` with a `diagnostics` source before reporting issues that qrate already found.
3. For "these" or "selected" rows, query the `selected_rows` source. For a term or suspected inconsistency, query a `search` source.
4. Ask for the smallest useful `select` field set and limit. Follow `next_cursor` only when more records could change the answer.
5. Use `qrate_program_save` and `qrate_program_run` only when bounded queries cannot answer efficiently. Use `qrate_thumbnails` only when image evidence matters.
6. Quote the source-row index and column name. Say what the data contains before inferring what it means.
7. Stage one complete batch with `qrate_stage_findings`. Copy `expected` exactly from the reviewed cell and use a whole-cell `replacement` only when the correction is well supported.
8. Tell the archivist that findings are staged drafts. Never say a cell was changed.
