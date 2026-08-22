---
name: qrate-live-review
description: Review or answer questions about the live metadata project open in qrate, including the current selection, diagnostics, rows, and draft findings.
---

# Review the project open in qrate

1. Call `qrate_project_summary`, then `qrate_columns`, before interpreting values.
2. Call `qrate_diagnostics` and avoid repeating findings qrate already reports.
3. For "these" or "selected" rows, call `qrate_selected_rows` and pass those source indices to `qrate_rows`.
4. For a term or suspected inconsistency, use `qrate_search_rows`, then read the returned rows in focused batches.
5. Quote the source-row index and column name. Say what the data contains before inferring what it means.
6. Stage one complete batch with `qrate_stage_findings`. Copy `expected` exactly from the reviewed cell and use a whole-cell `replacement` only when the correction is well supported.
7. Tell the archivist the findings are staged drafts. Never say a cell was changed.
