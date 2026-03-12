# Bug Fix Explanations

## Bug 1: Modifier remove doesn't clear visual effects

**Root cause:** `removeModifier()` in Manager.js called `dispose()` on the removed modifier instance but never called `clear()`. The `clear()` method is what actually removes DOM effects (stroke highlights, background colors, box-shadows). Without it, the modifier's visual artifacts (e.g., pointer highlight) linger on screen even after the modifier is removed.

**Fix:** Before splicing the modifier instance out of the array, we now call `clear(elements)` on the removed modifier. This ensures all DOM effects are properly cleaned up, and then the remaining modifiers are re-applied cleanly.

**File:** `media/core/Manager.js` — `removeModifier()` method

---

## Bug 2: Edge-list empty graph doesn't rerender when edges arrive

**Root cause:** When an edge_list graph starts empty, `_detectFormat()` defaults to `'next'`. On the next update when edges arrive, the `isFirstCall` condition (`this.format === null || prevEmpty || graphEmpty`) evaluates to `true` because `prevEmpty` is true (previous snapshot had no nodes/edges) or `graphEmpty` is true. This causes format re-detection, which overrides the user's manually-selected `edge_list` back to some other format (e.g. `next` or `adj_list`). The graph then parses with the wrong format and shows nothing.

**Fix:** Changed `isFirstCall` to only check `this.format === null`. Format auto-detection now runs exactly once (on initialization). After that — whether the format was auto-detected or manually set by the user — it's never overridden by re-detection. If the user selects `edge_list` for an initially-empty graph, subsequent data updates correctly parse as edge-list.

**File:** `media/visualizers/GraphVisualizer.js` — `update()` method

---

## Bug 3: Auto-select array visualizer but still renders Text

**Root cause:** The ArrayVisualizer registers with the key `'array'` (lowercase):
```js
visualizerRegistry.register('array', ArrayVisualizer);
```
But the previous fix set `defaultType = 'Array'` (PascalCase). Inside `createBlockWithPath`, the registry lookup `visualizerRegistry.registry.has('Array')` fails because the key is `'array'`, so `safeType` falls back to `'Text'`. The typeSelect dropdown showed `'array'` in its options (from `getAllTypes()`), but the visualizer was actually created as Text.

**Fix:** Changed the `defaultType` value from `'Array'` to `'array'` to match the exact registered key.

**File:** `media/main.js` — checkbox change handler

---

## Bug 4: Call webview on debugger start and stop

**Root cause:** The debugProxy only fired `_onDidDataChanged` on the DAP `"stopped"` event (breakpoint hit) and `_end` on session termination. The webview panel was never created/shown until the first breakpoint, and other debug lifecycle events were not forwarded.

**Fix:** Added a new `_onDebuggerStart` event emitter to `DebuggerProxy` that fires when `onDidStartDebugSession` is triggered. In `extension.ts`, the new `debugProxy.onDebuggerStart` listener calls `webviewManager.show({ scopes: [] })` to open/show the webview panel immediately when debugging begins (with empty scopes). The existing `debugProxy.end` → `webviewManager.hide()` already handles termination.

**Files:** `src/debugProxy.ts`, `src/extension.ts`

---

## Bug 5: Path separator `)` instead of `/` in variable names

**Root cause:** `RecursivegetVariables` uses `v.evaluateName` as the node's `name` field. The DAP `evaluateName` is a full expression path used for evaluation by the debugger (e.g., `((p1).p2).child1`). When `populateVarMap` builds hierarchical paths by concatenating `parentPath.v.name`, the parentheses from evaluateName leak into the path keys and display names: `p1.((p1).p2).child1`. At depth ≥2 this produces visible `)` characters in autocomplete suggestions.

**Previous fix attempt:** Changed `name` from `evaluateName` to `v.name` (simple DAP member name). This broke autocomplete resolution and linked-list pointer following, because several code paths relied on the `evaluateName`-based name for child variable lookup and matching.

**Fix:** Reverted `name` back to `v.evaluateName` to preserve the existing data flow and variable resolution. Added a `_cleanVarLeaf(name)` helper function (defined in Manager.js, available globally) that extracts the clean leaf identifier from an evaluateName by splitting on `->` and `.` and stripping parentheses. `populateVarMap` and `renderVariableList` in main.js now use `_cleanVarLeaf(v.name)` for building varMap keys and displaying names. The modifier picker's child-path builder in Manager.js also uses `_cleanVarLeaf`. This keeps the underlying data intact (evaluateName for resolution) while showing clean paths like `p1.p2.child1` in the UI.

**Files:** `src/debugProxy.ts` — `RecursivegetVariables()`, `media/main.js` — `populateVarMap()` / `renderVariableList()`, `media/core/Manager.js` — `_cleanVarLeaf()` / `_showAddModifierPicker()`

---

## Bug 6: Range modifier should read two scalar integers with bracket type

**Root cause:** The previous `RangeModifier` bound to a single scalar variable (the "lo" value) and read the "hi" variable from a separate settings input. The modifier picker only showed one "Var:" input, so the user could only see/set one variable at add time. The settings panel had a "Right var:" input but it was not prominent enough — the user expected two clearly-visible L and R inputs from the start. Additionally, there was no way to choose between inclusive/exclusive endpoints (`[l,r]` vs `(l,r)` etc.).

**Fix:**
1. Rewrote `RangeModifier.js`: both `loVarPath` and `hiVarPath` are stored in settings and looked up from `varMap` at apply time. Added `bracketType` setting (`'[,]'`, `'(,)'`, `'[,)'`, `'(,]'`) controlling inclusive/exclusive logic. The `apply()` method uses `bracketType` to decide `>=`/`>` and `<=`/`<` for index comparison.
2. `getSettingsUI()` now shows: L variable input, R variable input (both with autocomplete), bracket type dropdown, and color picker.
3. Modified `_showAddModifierPicker` in Manager.js: when the selected type is `'range'`, the single "Var:" input is hidden and replaced with dual "L:" and "R:" inputs plus a bracket type dropdown. On Add, both paths and the bracket type are stored in the modifier's settings.
4. Updated the modifier row label to display `L:… R:…` for range modifiers.

**Files:** `media/modifiers/RangeModifier.js`, `media/core/Manager.js` (`_showAddModifierPicker`, `_refreshModifierUI`)

---

## Bug 7: Label modifier should append text to existing elements

**Root cause:** The LabelModifier created separate absolutely-positioned `<span>` elements (for HTML) or standalone SVG `<text>` elements (for SVG) near the target elements. These floated outside the main content area and could become mispositioned on resize/scroll. The user expects labels to be appended *inside* the existing element (`.viz-array-value` for arrays, the node's `<text>` for graph SVGs) as separate lines.

**Fix:**
- **SVG nodes:** Instead of creating a new `<text>` element in the SVG root, we now append a `<tspan>` inside the existing `<text text-anchor="middle">` element within the node group. The tspan uses `x="0" dy="1.2em"` to position on a new line below the existing text.
- **HTML arrays:** Instead of a positioned span, we append a `<div>` child inside `.viz-array-value` with the label text, styled inline with smaller colored font.
- Removed the "Position" selector from settings since labels are now always inline.

**File:** `media/modifiers/LabelModifier.js`

---

## Bug 8: Heap node circles and text too small compared to gaps

**Root cause:** `NODE_R = 22` (radius) produced 44px diameter circles, while `hSpacing = 55` and `vSpacing = 65` created relatively large gaps between nodes. The circles appeared small and text inside was cramped.

**Fix:** Increased `NODE_R` from 22 to 28 (diameter now 56px, a ~27% increase). Adjusted `hSpacing` from 55 to 60 and `vSpacing` from 65 to 65 (unchanged). Nodes now fill more of the available space while still maintaining clear BST structure with 4px gaps between adjacent leaf nodes.

**File:** `media/visualizers/HeapVisualizer.js` — `_applyLayout()` and `_renderHeap()`