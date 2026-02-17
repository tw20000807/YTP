# Data Flow & Communication Architecture (資料流與通訊架構)

本文檔詳細說明從 VS Code Extension 端到 Webview 前端的完整資料流與通訊機制。

## 1. 流程概覽 (High-Level Overview)

整個通訊流程可以視為一個單向資料流 (Uni-directional Data Flow) 配合雙向的事件通知：

1.  **Trigger**: 除錯器暫停 (Debug Stop)，觸發資料更新。
2.  **Backend (Extension)**: `extension.ts` 捕捉事件，提取變數資料。
3.  **Bridge (WebviewManager)**: `webview.ts` 將資料序列化，透過 `postMessage` 發送給前端。
4.  **Frontend Controller**: `main.js` 接收訊息，更新內部狀態 (State)。
5.  **Manager & Visualizers**: 根據新狀態重新渲染 (Re-render) 畫布上的區塊。

---

## 2. 詳細步驟說明 (Detailed Breakdown)

### Step 1: Extension Host (觸發與數據獲取)
**File**: `src/extension.ts`

當除錯器暫停時 (例如遇到斷點)，`DebuggerProxy` 會觸發回呼函數：

```typescript
// src/extension.ts
debugProxy.onDidStop(async (text) => {  
    // text 包含了當前的變數堆疊資訊
    webviewManager.show(text);
});
```

*   **角色**: 資料生產者 (Data Producer)。
*   **動作**: 呼叫 `webviewManager.show()` 將原始資料傳遞出去。

### Step 2: Webview Manager (訊息橋樑)
**File**: `src/webview.ts`

`WebviewManager` 負責管理 Webview 面板的生命週期與通訊。

#### 2.1 `show(context)` 方法
這是通訊的起點。它不直接操作 HTML 字串，而是發送 JSON 訊息：

```typescript
public async show(context: DebugContext): Promise<void> {
    // 1. 確保 Webview 面板已創建
    if (!this.webviewPanel) {
        await this.createWebviewPanel();
    }

    // 2. 清理與格式化數據
    const cleanScopes = context.scopes.map(...);

    // 3. 發送訊息至前端 (關鍵通訊點)
    this.webviewPanel!.webview.postMessage({
        command: 'updateVariables',  // 識別指令
        scopes: cleanScopes,         // 變數數據 Payload
        watchedVariables: ...        // 當前監看清單
    });
}
```

*   **通訊機制**: `webview.postMessage()`。這是 VS Code 提供的標準 API，用於從 Extension 向 Webview 發送異步訊息。

#### 2.2 `createWebviewPanel()` 與 HTML 注入
在創建 Webview 時，`getWebviewHtml()` 方法會動態生成 HTML，並透過 `<script>` 標籤按順序注入所有模組化的 JS 檔案：

1.  `media/core/Registry.js` (最先加載，供其他人註冊)
2.  `media/visualizers/*.js` (註冊具體 Visualizer)
3.  `media/core/Manager.js`
4.  `media/main.js` (最後加載，啟動邏輯)

---

### Step 3: Frontend Controller (前端接收器)
**File**: `media/main.js`

這是前端的進入點 (Entry Point)。`VisualizerController` 初始化後會監聽訊息：

```javascript
// media/main.js
window.addEventListener('message', event => {
    const message = event.data; // 獲取 Extension 傳來的 JSON
    
    switch (message.command) {
        case 'updateVariables':
            // 收到新數據，交給 Controller 處理
            this.handleUpdateVariables(message);
            break;
    }
});
```

*   **通訊機制**: `window.addEventListener('message')`。這是 Web 標準 API，用於接收 `postMessage` 傳來的資料。

### Step 4: Visualizer Manager (畫布與狀態同步)
**File**: `media/core/Manager.js`

Controller 解析完數據後，會呼叫 `VisualizerManager` 來刷新畫面。

```javascript
// media/main.js -> handleUpdateVariables
this.visualizerManager.updateAll(variableMap);
```

`Manager.js` 遍歷畫布上所有現存的 Block，並更新它們：

```javascript
// media/core/Manager.js
updateAll(variableMap) {
    this.blocks.forEach((blockEntry, path) => {
        // 從新數據中查找此 Block 對應的變數值
        const newData = variableMap.get(path);
        if (newData) {
            // 委派給具體的 Visualizer 進行渲染
            blockEntry.visualizer.render(newData);
            
            // 觸發自動調整大小機邏輯
            this.autoSizeBlock(blockEntry);
        }
    });
}
```

### Step 5: Visualizers (渲染策略)
**File**: `media/visualizers/*.js` (例如 `JsonVisualizer.js`)

最後，具體的 Visualizer 接收到新數據，更新 DOM。

```javascript
// media/visualizers/JsonVisualizer.js
render(data) {
    // 清空舊內容
    this.container.innerHTML = '';
    // 生成新的 JSON 樹狀結構 HTML
    const tree = this.createTree(data);
    this.container.appendChild(tree);
}
```

---

## 3. 反向通訊 (Frontend to Backend)

當使用者在 Webview 進行操作 (例如勾選變數監看) 時，資料流是反向的：

1.  **Frontend (`main.js`)**:
    ```javascript
    // 當使用者勾選 checkbox
    vscode.postMessage({
        command: 'toggleVariable',
        name: variableName,
        checked: true
    });
    ```

2.  **Backend (`webview.ts`)**:
    ```typescript
    webviewPanel.webview.onDidReceiveMessage(message => {
        switch (message.command) {
            case 'toggleVariable':
                // 更新後端狀態
                this.watchedVariables.add(message.name);
                break;
        }
    });
    ```

## 4. 總結 (Summary)

*   **extension.ts**: 觸發者 (Trigger)。
*   **webview.ts**: 消息轉發與 HTML 組裝者 (Assembler & Messenger)。
*   **main.js**: 訊息接收與分發者 (Dispatcher)。
*   **Manager.js**: 狀態協調者 (Coordinator)。
*   **Visualizers**: 視圖呈現者 (Presenter)。

這種架構確保了**數據 (Extension)** 與 **視圖 (Webview)** 的解耦，中間通過 JSON 訊息協議 (Message Protocol) 進行溝通。
