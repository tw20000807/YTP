# Completed Changes

## 1. Removed nickname from graph "next" and "weight" settings

**Files modified:** `media/visualizers/GraphVisualizer.js`

- Removed `nextNickname` and `weightNickname` state fields from the constructor.
- Removed them from `getParams()` and `setParams()`.
- Removed the two nickname `<input>` elements from `_buildAdvancedUI()`.
- The "Next" and "Weight" sections in Advanced Settings now contain only the field-name input.

## 2. Fixed weight field not working for adj_list format

**Files modified:** `media/visualizers/GraphVisualizer.js`

**Root cause:** In `_parseGraph()` and `_computeRawSnapshot()`, the adj_list parser always set `weight: null` regardless of whether `weightField` was configured. The `weightField` was never resolved during parsing.

**Fix:** After resolving the `to` (destination) value from each neighbor element, the parser now also resolves the `weightField` from the same neighbor variable via `_resolveFieldValue(nb, this.weightField)`. If a value is found, it is used as `edge.weight`; otherwise `null` is kept. This applies to both `_parseGraph()` (for rendering) and `_computeRawSnapshot()` (for change detection).

**Verification:** Use the "Weighted Adj List" test preset. Set format to `adj_list`, set `nextField` to `first`, `weightField` to `second`, and toggle `Weights` to `weighted` — edge weights now display correctly on the graph.

## 3. Added edge_list visualization mode for graphs

**Files modified:** `media/visualizers/GraphVisualizer.js`

Added a new `edge_list` format where the input is an array of `(u, v)` or `(u, v, w)` tuples (e.g., `vector<pair<int,int>>`).

**State additions:** `edgeListFrom`, `edgeListTo`, `edgeListWeight` — field paths for resolving from/to/weight from each edge element.

**Advanced Settings (when edge_list is selected):**
- `from (u)` — field path for the source node (default: 1st child)
- `to (v)` — field path for the destination node (default: 2nd child)
- `weight (w)` — field path for edge weight (default: 3rd child, only when Weights = `weighted`)
- Weights toggle (shared with other formats)
- Rev.Edges toggle (shared with other formats)

**Parsing:** Nodes are inferred from the union of all `u` and `v` values. Edges are constructed directly from each array element. The `_parseEdgeListSnapshot()` helper is shared between `_parseGraph()` and `_computeRawSnapshot()`.

**UI visibility:** When `edge_list` is selected, the Next/Weight sections (for adj_list) are hidden and the Edge List Fields section is shown. When any other format is selected, the Edge List section is hidden.

**Verification:** Use the "Edge List" test preset and select `edge_list` format.

## 4. Added `index label` option to the array visualizer

**Files modified:** `media/visualizers/ArrayVisualizer.js`

Added an `indexLabel` state (`'index'` | `'name'`) and a toggle button in Basic Settings.

- **Index mode (default):** Each box header shows the numeric array index (`0`, `1`, `2`, …).
- **Name mode:** Each box header shows the variable name from the debugger data (e.g., `[0]`, `arr[2]`), extracted via `_leafName()`.

The toggle is labeled "Label:" and reads "Index" / "Name". The state is persisted via `getParams()` / `setParams()`.

## 5. Added heap visualizer

**Files created:** `media/visualizers/HeapVisualizer.js`  
**Files modified:** `media/test.html` (script tag added)

A new `HeapVisualizer` class that extends `GraphBaseVisualizer`. Registered as type `'heap'`.

**Display:** SVG layered tree layout. Parent-child edges are drawn as straight lines. Nodes are circles showing:
- A label (index, variable name, or a custom name field)
- The array element value (or configured data fields)

**Basic Settings:**
- `Base` — toggle between 0-based and 1-based heap indexing:
  - 0-based: node `i` has children `2i+1` and `2i+2`
  - 1-based: node `i` has children `2i` and `2i+1`
- `Limit` — inclusive end index (default: show all)
- `Label` — toggle between Index and Name (same as array's index label)

**Advanced Settings:**
- `Data Fields` — add/remove rows of `{fieldName, nickname}` to display per node (like array visualizer)
- `Name field` — a single field path to use as the node label

**Layout:** Uses `_computeLayersBFS()` from `GraphBaseVisualizer` with the root set to index 0 (or 1 for 1-based heaps). The tight viewBox is computed via `_computeTightViewBox()`. `fitSvg()` refines bounds after rendering.

**Verification:** Use the "Heap" test preset, check the `heap` variable, and select type `heap`.

## 6. Test harness updates

**Files modified:** `media/test-harness.js`, `media/test.html`

New test presets added:
- **`weighted-adj-list`** — 5-node graph with `vector<vector<pair<int,int>>>` (adj list with `first`=to, `second`=weight). Tests weight field resolution (task 2).
- **`edge-list`** — `edges` (unweighted) and `wEdges` (weighted tuple) arrays. Tests edge_list format (task 3).
- **`heap`** — 10-element integer array for heap visualization (task 5).

New builder functions: `buildWeightedAdjList()`, `buildEdgeList()`, `buildWeightedEdgeList()`, `buildHeapArray()`.

Preset dropdown in test.html updated with new options: "Weighted Adj List", "Edge List", "Heap".

## 7. Fixed weight labels still not showing in graph visualizer

**Files modified:** `media/visualizers/GraphVisualizer.js`

**Root cause:** The `_weightFieldInput` change handler called `this._renderGraph()` instead of `this._refresh()`. Since `_renderGraph()` only re-renders SVG from previously-parsed edge data (which had `weight: null` because the weight field wasn't set when edges were last parsed), changing the weight field name never triggered a re-parse. The weight values in `this._edges` stayed null.

Additionally, the Weights dropdown was hidden for `adj_matrix` format (`_showHideLayout` toggled `viz-toolbar-hidden` on the wrapper), so users could never enable weight labels for matrices — even though matrix cell values ARE the weights.

**Fix:**
- Changed `_weightFieldInput` change handler to call `this._refresh()` → re-parses graph data with the new weight field, populating `edge.weight` correctly.
- Changed `_weightsSel` (Weights dropdown) handler to also call `this._refresh()` for consistency.
- Removed the line that hides the Weights dropdown for `adj_matrix` format — it's now always visible.
- Added `_detectWeightedMatrix()` method: on first load, if format is `adj_matrix` and any cell value is something other than `'0'` or `'1'`, auto-sets `weights = 'weighted'` so weight labels appear automatically for weighted matrices.

## 8. Fixed copy-image broken for non-SVG and in VSCode webview

**Files modified:** `media/core/Manager.js`, `media/webview.html`

**Root cause (VSCode webview):** The CSP in `webview.html` was `default-src 'none'` with no `img-src` directive. The copy-image pipeline creates a blob URL → loads into `Image` → draws to canvas. The `img.src = blobUrl` was blocked by CSP because `img-src` defaulted to `'none'`.

**Root cause (non-SVG):** `_htmlToBlob` used the foreignObject SVG technique which requires valid XHTML. Browser DOM serialization often produces HTML that isn't valid XHTML inside an SVG foreignObject, causing the Image to fail loading.

**Root cause (clipboard):** `navigator.clipboard.write()` with `ClipboardItem` may not be available in VSCode webview due to iframe security restrictions.

**Fix:**
- Added `img-src blob: data:;` to the CSP in `webview.html` so blob URL images can load.
- Removed the broken `_htmlToBlob` (foreignObject) and `_inlineComputedStyles` methods entirely.
- Non-SVG blocks now go directly to the canvas-based `_htmlToBlobFallback`, which manually renders array boxes, matrix cells, heap nodes, and plain text to a 2x-scale canvas. This works reliably in all environments.
- Clipboard write is now wrapped in try/catch. If `navigator.clipboard.write()` fails (VSCode webview), falls back to a file download (`<a>` element with `blob:` URL and `download` attribute).

## 9. Fixed autocomplete dropdown positioning in VSCode webview

**Files created:** `media/utils/CustomDropdown.js`  
**Files modified:** `media/visualizers/GraphVisualizer.js`, `media/visualizers/ArrayVisualizer.js`, `media/visualizers/HeapVisualizer.js`, `media/visualizers/LinkedListVisualizer.js`, `media/main.css`, `media/test.html`, `src/webview.ts`

**Root cause:** Native `<datalist>` elements position their dropdown popup relative to the browser viewport. In a VSCode webview (an iframe), the browser doesn't account for the iframe's offset within the VS Code window, so the dropdown appears at coordinates that are wrong relative to the user's screen — typically "outside" the visible area.

**Fix:** Created `CustomDropdown` utility (`media/utils/CustomDropdown.js`) that replaces native `<datalist>` with a custom DOM-based dropdown:
- Positioned absolutely using `getBoundingClientRect()` of the input element + `window.scrollX/Y`, so it appears directly below the input regardless of iframe context.
- Supports filtering: as the user types, options are filtered to matches.
- Supports keyboard navigation: ArrowUp/Down to highlight, Enter to select, Escape to close.
- High z-index (99999) and appended to `document.body` to avoid clipping by `overflow: hidden` ancestors.
- Styled via `.ytp-custom-dropdown` / `.ytp-custom-dropdown-item` CSS classes (added to `main.css`).

All four visualizers updated:
- **GraphVisualizer**: `_ensureNodeFieldDatalist()` now attaches `CustomDropdown` to all 5 field inputs (next, weight, edgeListFrom/To/Weight).
- **ArrayVisualizer**: `_syncAdvancedUI()` attaches `CustomDropdown` to each data field input.
- **HeapVisualizer**: `_ensureAdvDatalist()` attaches `CustomDropdown` to nameField and data field inputs.
- **LinkedListVisualizer**: `_mkDataFieldRow()` and `_mkPointerRow()` attach `CustomDropdown` to field inputs.

Script loading updated in `src/webview.ts` and `media/test.html` to include `CustomDropdown.js` before visualizer scripts.