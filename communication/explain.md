# Modifiers — Explanation & Verification

Modifiers are visual decorations applied on top of a visualizer's rendered elements.  
They are driven by a **separate variable** (bound when adding the modifier) and target elements by index.

All modifiers work on any visualizer that implements `getElements()` — currently:  
**Array**, **Matrix**, **Graph**, **LinkedList**.

---

## 1. Pointer Modifier (`pointer`)

**Purpose:** Highlights a single element whose index matches a scalar variable's value.

**Bound variable:** A scalar integer (e.g., `int i = 3;`). The value is the index of the element to point at.

**Visual effect (3 styles):**
| Style       | What it does                                                       |
|-------------|--------------------------------------------------------------------|
| `arrow`     | Renders a colored **▼** arrow marker above the target element.     |
| `border`    | Draws a 3 px colored outline around the target element.            |
| `highlight` | Fills the target element's background at 20 % opacity + 2 px inset border. |

**Settings:**
- **Style** — `arrow` / `border` / `highlight`
- **Color** — any color (default `#ff4444`)

**Showing on visualizer:** Yes — the arrow / border / highlight appears directly on the element at the pointed-to index.

---

## 2. Color Modifier (`color`)

**Purpose:** Maps an array of values to a color palette and applies those colors as background fills on elements.

**Bound variable:** An array variable where `children[i].value` is either:
- A **numeric** value → mapped to the selected palette (cycled by index), or
- A **hex color string** (e.g., `"#ff0000"`) → used directly.

**Visual effect:**  
Each element `i` receives a background color (HTML) or fill (SVG) from the corresponding `color[i]`.

**Settings:**
- **Palette** — `heat` (Viridis) / `cool` (diverging blue-red) / `rainbow` (categorical)
- **Opacity** — slider from 0.1 to 1.0 (default 0.35)

**Showing on visualizer:** Yes — element backgrounds are tinted with the palette color at the configured opacity.

---

## 3. Label Modifier (`label`)

**Purpose:** Appends text labels to elements from an array or scalar variable.

**Bound variable:**
- **Array:** `label[i]` is appended to element `i`.
- **Scalar:** The same label value is appended to every element.

**Visual effect:**  
A small absolutely-positioned `<span>` with the label text appears at the chosen position relative to each element.

**Settings:**
- **Position** — `top` / `bottom` / `right`
- **Color** — any color (default `#ffd700`, gold)

**Showing on visualizer:** Yes — label spans appear above, below, or to the right of each element.

---

## 4. Range Modifier (`range`)

**Purpose:** Highlights all elements within an index range `[lo, hi]`.

**Bound variable:** One of:
- An array with ≥ 2 children: `children[0]` = lo, `children[1]` = hi.
- A scalar string like `"2,5"` (comma-separated lo and hi).

**Visual effect (2 styles):**
| Style        | What it does                                                    |
|--------------|-----------------------------------------------------------------|
| `background` | Fills elements in [lo, hi] with the chosen color at configured opacity (HTML: box-shadow inset; SVG: fill). |
| `border`     | Draws a 2 px colored outline around each element in [lo, hi].  |

**Settings:**
- **Style** — `background` / `border`
- **Color** — any color (default `#4fc3f7`, light blue)

**Showing on visualizer:** Yes — all elements whose index falls within [lo, hi] get the background fill or outline.

---

## How modifiers are applied

1. After the visualizer calls `update()`, the Manager calls `_applyModifiers()`.
2. For each modifier instance: `clear(elements)` removes previous decorations, then `apply(elements, variableData)` reapplies based on current data.
3. Modifier settings are persisted in `knownBlocks[path].modifiers` and survive across step/reload.
