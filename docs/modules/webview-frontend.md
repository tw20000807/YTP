# Webview Frontend (`media/main.js`)

這是視覺化介面的核心前端邏輯，使用原生 JavaScript (Vanilla JS) 撰寫，不依賴任何框架。

## 主要職責 (Responsibilities)

1.  **介面渲染**: 繪製變數樹 (Tree View) 和視覺化區塊 (Visualizer Blocks)。
2.  **互動控制**: 處理拖曳 (Drag & Drop)、調整大小 (Resizing) 和變數勾選。
3.  **狀態管理**: 透過 `VisualizerManager` 管理所有活躍的視覺化實例。

## 關鍵類別 (Key Classes)

### `VisualizerController` (主要控制器)
*   程式進入點。
*   負責初始化 `VisualizerManager` 和 `ResizeHandle`。
*   監聽 `message` 事件 (來自 Extension)。
*   監聽變數列表的 `change` 事件 (Checkbox)，並通知 Manager 創建或移除區塊。
*   **`saveState()`**: 收集當前 Sidebar 寬度和區塊佈局，發送 `saveLayout` 給後端。

### `VisualizerManager` (區塊管理器)
*   **`blocks` (Map)**: 儲存 `path -> Block` 的對應關係。
*   **`createBlockWithPath(path, variable)`**:
    *   在 DOM (`#dashboard`) 中建立一個新的 `div.block`。
    *   包含標題列 (Header) 和內容區 (Content)。
    *   實例化預設的 `TextVisualizer` 並與該區塊綁定。
*   **`updateAll(varMap)`**:
    *   當後端傳來新資料時，遍歷所有活躍的區塊並呼叫其 `visualizer.update(variable)`。
    *   負責在重新載入介面時恢復先前保存的區塊。

### `TextVisualizer` (預設視覺化器)
*   最基礎的視覺化實作。
*   **`update(variable)`**: 將變數物件轉為 JSON 字串並顯示在 `<pre>` 標籤中。

### `ResizeHandle` (調整手把)
*   處理 Sidebar 與 Dashboard 之間的分隔線拖曳邏輯。

## 如何新增視覺化器 (How to Add a Visualizer)

若要新增例如 `GraphVisualizer`：
1.  在 `main.js` 中建立 class (例如 `class GraphVisualizer`)。
2.  實作 `constructor(container)` 初始化畫布。
3.  實作 `update(variable)` 根據變數資料繪圖。
4.  在 `VisualizerManager.createBlockWithPath` 中，依據變數類型選擇使用 `GraphVisualizer`。
