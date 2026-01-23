# Extension Core (`src/extension.ts`)

這是擴充功能的進入點 (Entry Point)，負責生命週期管理與元件初始化。

## 主要職責 (Responsibilities)

1.  **啟動 (Activation)**: 在擴充功能載入時執行 `activate` 函式。
2.  **依賴注入 (Dependency Injection)**: 創建並連接 `WebviewManager` 與 `DebuggerProxy`。
3.  **註冊命令 (Commands)**: 註冊 `ytp.printDebugVariables` 命令，允許使用者手動觸發變數更新。
4.  **事件串接 (Event Wiring)**: 監聽 `debugProxy.onStopped` 事件，並將資料轉發給 `webviewManager.show`。

## 關鍵函式 (Key Functions)

### `activate(context: vscode.ExtensionContext)`

*   **描述**: 初始化擴充功能的核心邏輯。
*   **流程**:
    1.  實例化 `WebviewManager`。
    2.  實例化 `DebuggerProxy`。
    3.  綁定 `onStopped` 回呼函式：當除錯器暫停時，自動呼叫 `webviewManager.show(debugContext)`。
    4.  將所有元件加入 `context.subscriptions` 以便在擴充功能停用時釋放資源。

### `deactivate()`

*   **描述**: 清理資源 (目前為空，因為主要清理工作由 `dispose` 機制處理)。
