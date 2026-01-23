# Debug Proxy (`src/debugProxy.ts`)

這個模組是與除錯適配器 (Debug Adapter) 溝通的橋樑，負責攔截 DAP 訊息並處理變數資料。

## 主要職責 (Responsibilities)

1.  **除錯追蹤 (Debug Tracking)**: 使用 `vscode.debug.registerDebugAdapterTrackerFactory` 攔截除錯訊息。
2.  **資料抓取 (Data Fetching)**: 主動向除錯器請求 Stack Trace、Scopes 和 Variables。
3.  **變數變更檢測 (Change Detection)**: 比較前後兩次除錯暫停時的變數值，計算差異。

## 關鍵類別 (Key Classes)

### `DebuggerProxy`

*   **`onStoppedCallback`**: 當偵測到除錯暫停時執行的回呼函式。
*   **`createTracker(session)`**: 為每個除錯會話創建一個追蹤器。
*   **`fetchVariables(session, frameId)`**: 遞迴抓取指定 Stack Frame 下的所有變數。
    *   **深度限制**: 目前設定遞迴深度限制 (Depth Limit) 以防止無線遞迴導致效能問題。
*   **`calculateDiff(newData, oldData)`**: 比較新舊變數樹。
    *   **New**: 變數在舊資料中不存在。
    *   **Modified**: 變數值 (Value) 或 類型 (Type) 發生改變。
    *   **Unchanged**: 內容完全一致。

## 資料結構 (Data Structures)

### `DebugContext`
傳遞給前端的完整除錯狀態物件。
```typescript
interface DebugContext {
    frameName: string;
    scopes: ScopeData[];
}
```

### `VariableData`
單個變數的資料結構。
```typescript
interface VariableData {
    name: string;
    value: string;
    type?: string;
    changeType?: 'new' | 'modified' | 'unchanged';
    children?: VariableData[];
}
```
