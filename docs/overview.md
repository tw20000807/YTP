# YTP Debugger Visualizer - 系統架構概覽 (System Overview)

本擴充功能提供了一個模組化、互動式的變數視覺化介面。它攔截除錯適配器協定 (DAP) 的訊息，抓取變數資料，並在分割視窗的 Webview 中渲染。

## 系統架構圖 (Architecture)

系統主要分為兩個部分：**擴充功能後端 (Extension Backend)** 與 **Webview 前端 (Frontend)**。它們通過 JSON 訊息協定進行通訊。

```mermaid
graph TD
    A[除錯會話 (Debug Session)] -->|暫停事件 (Stopped)| B(DebugProxy)
    B -->|抓取變數 (Stack/Scopes/Vars)| B
    B -->|變數資料 (DebugContext)| C(Extension Core)
    C -->|傳遞資料| D(WebviewManager)
    D -->|postMessage (JSON)| E[Webview Frontend (main.js)]
    E -->|渲染變數樹| F[Sidebar (#sidebar)]
    E -->|渲染視覺化區塊| G[Dashboard (#dashboard)]
    E -->|使用者操作 (Toggle/Save)| D
```

## 核心流程 (Core Workflow)

1.  **監聽 (Monitoring)**: `DebugProxy` 監聽除錯器的 `stopped` 事件 (例如斷點)。
2.  **抓取 (Fetching)**: 當程式暫停時，後端遞迴抓取當前的堆疊框架 (Stack Frames) 和變數 (Variables)。
3.  **比較 (Diffing)**: 後端比對新舊變數值，標記 `new` (新增), `modified` (修改), 或 `unchanged` (未變)。
4.  **傳輸 (Messaging)**: `WebviewManager` 將整理好的 JSON 資料傳送給前端。
5.  **渲染 (Rendering)**: 前端 `VisualizerController` 接收資料，更新左側變數樹，並通知右側活躍的 `Blocks` 更新內容。

## 資料通訊協定 (Data Protocol)

### 後端 -> 前端 (Backend to Frontend)

*   **`updateVariables`**: 傳送最新的變數快照。
    ```json
    {
      "command": "updateVariables",
      "scopes": [ ... ], // 包含變數樹的區塊陣列
      "watchedVariables": [ "locals.myVar" ] // 已追蹤的變數路徑
    }
    ```

### 前端 -> 後端 (Frontend to Backend)

*   **`toggleVariable`**: 當使用者勾選/取消勾選變數時發送。
    ```json
    {
      "command": "toggleVariable",
      "name": "locals.myVar",
      "checked": true
    }
    ```
*   **`saveLayout`**: 當介面佈局改變 (調整大小、拖曳區塊) 時發送，用於保存狀態。
    ```json
    {
      "command": "saveLayout",
      "state": {
        "splitPaneWidth": 300,
        "blocks": [ { "path": "locals.myVar" } ]
      }
    }
    ```
