# Webview Backend (`src/webview.ts`)

這個模組負責管理 VS Code 的 Webview Panel 生命週期，以及後端與前端的通訊。

## 主要職責 (Responsibilities)

1.  **Panel 管理**: 創建、顯示、銷毀 `vscode.WebviewPanel`。
2.  **HTML 生成**: 載入 `webview.html` 模板並注入 CSS/JS 路徑。
3.  **訊息傳遞**: 封裝 `postMessage` 將 JSON 資料傳送給前端。
4.  **訊息接收**: 處理前端回傳的 `toggleVariable` 和 `saveLayout` 指令。

## 關鍵類別 (Key Classes)

### `WebviewManager`

*   **`show(context: DebugContext)`**:
    *   如果 Panel 不存在，呼叫 `createWebviewPanel()`。
    *   將 Panel 顯示在編輯器側邊 (`ViewColumn.Beside`)。
    *   使用 `webview.postMessage` 發送 `updateVariables` 訊息，包含最新的變數資料與已追蹤的變數列表。

*   **`createWebviewPanel()`**:
    *   設定 `enableScripts: true` 允許前端執行 JS。
    *   設定 `retainContextWhenHidden: true` 防止切換分頁時前端重置。
    *   註冊 `onDidReceiveMessage` 監聽器。

*   **`getWebviewHtml()`**:
    *   讀取 `media/webview.html`。
    *   將 `{{cspSource}}`, `{{styleUri}}`, `{{scriptUri}}` 替換為實際的 VS Code 資源路徑。

## 通訊處理 (Message Handling)

*   **`toggleVariable`**:
    *   更新內部的 `watchedVariables` Set。
    *   在 Output Channel 記錄日誌。
*   **`saveLayout`**:
    *   接收前端傳來的佈局狀態 (Layout State)。
    *   (待實作) 將狀態保存到 Workspace State 以便重新載入時恢復。
