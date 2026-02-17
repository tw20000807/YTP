# YTP Debugger Visualization Architecture (YTP 除錯器視覺化架構)

## 1. 概述 (Overview)
本視覺化系統採用模組化、元件基礎 (component-based) 的架構設計，運行於 VS Code Webview 環境中。它作為 Extension Host (後端) 與 Webview (前端/UI) 之間的橋樑。

## 2. 設計模式 (Design Patterns)

### 2.1 Factory Pattern (工廠模式) - `VisualizerRegistry`
- **位置**: `media/core/Registry.js`
- **目的**: 解耦 Visualizer 的創建與使用。`VisualizerManager` 通過字串名稱 (例如 'JSON') 請求 Visualizer，Registry 會實例化正確的類別。
- **實作**: `create(type, container)` 方法會查找已註冊的類別引用並實例化它。

### 2.2 Strategy Pattern (策略模式) - `BaseVisualizer`
- **位置**: `media/visualizers/`
- **目的**: 允許在執行時互換變數渲染演算法。`TextVisualizer` 與 `JsonVisualizer` 是可互換的策略，無需修改容器邏輯即可切換。
- **介面**: 所有 Visualizer 皆繼承自 `BaseVisualizer` 並實作 `update(variable)` 方法。

### 2.3 Observer / Subscriber Pattern (觀察者/訂閱者模式)
- **位置**: `VisualizerManager.updateAll`
- **目的**: Dashboard 本質上「訂閱」了除錯器的更新。當 Extension 發送新的變數數據時，Manager 會遍歷所有活躍的 Block 並推送更新。
- **流程**: Extension Host -> `VisualizerController` -> `VisualizerManager` -> `Block.visualizer.update()`。

### 2.4 Singleton Pattern (單例模式)
- **位置**: `media/core/Registry.js` 中的全域 `visualizerRegistry`。
- **目的**: 確保 Webview 中所有可用的 Visualizer 類型擁有單一的事實來源 (single source of truth)。

### 2.5 MVC (Model-View-Controller)
- **Model**: `VariableData` (來自 C++除錯器的原始 JSON) 與 Global State。
- **View**: 由 `VisualizerManager` 與 `Visualizers` 創建的 DOM 元素。
- **Controller**: `VisualizerController` (位於 `main.js`) 負責協調 VS Code 與邏輯層之間的訊息傳遞。

---

## 3. 模組結構 (Module Structure)

### 3.1 Core Controller (`main.js`)
進入點 (Entry point)。
- **Class**: `VisualizerController`
- **職責**:
    - 監聽來自 VS Code 的 `window.message` 事件。
    - 管理 Global State (`vscode.getState()`)。
    - 協調 Sidebar (變數列表) 與 Dashboard (Manager)。
    - 處理 Sidebar 調整大小 (`ResizeHandle`)。

### 3.2 Visualizer Manager (`media/core/Manager.js`)
佈局引擎 (Layout Engine)。
- **Class**: `VisualizerManager`
- **職責**:
    - 管理 `dashboard` DOM 元素 (畫布)。
    - 維護 `blocks` Map。
    - 處理 Drag-and-Drop (絕對定位)。
    - 管理佈局的持久化與恢復。

**關鍵變數**:
- `blocks`: `Map<string, BlockEntry>`
    - Key: Variable Path (例如 `myVec.0`)
    - Value: `BlockEntry` 物件

### 3.3 Visualizer Registry (`media/core/Registry.js`)
- **Class**: `VisualizerRegistry`
- **類型**: Singleton (全域實例 `visualizerRegistry`)。
- **方法**: `register`, `create`, `getAllTypes`。

---

## 4. 資料類型 (Data Types)

### 4.1 `VariableData`
從 Extension 接收到的原始數據格式。
```typescript
/**
 * @typedef {Object} VariableData
 * @property {string} name       // 例如 "myVector"
 * @property {string} value      // 例如 "{size=5}"
 * @property {string} [type]     // 例如 "std::vector<int>"
 * @property {VariableData[]} [children] // 巢狀欄位
 */
```

### 4.2 `BlockEntry`
被視覺化 Block 的內部狀態 (由 `VisualizerManager` 管理)。
```typescript
{
    element: HTMLElement;       // 外部 .block div (可拖曳)
    contentElement: HTMLElement;// 內部的 Visualizer 容器
    visualizer: BaseVisualizer; // 當前活躍的策略實例
    variableData: VariableData; // 最新的數據快取
    type: string;               // 當前 Visualizer 名稱 ("Text", "JSON")
}
```

### 4.3 `Message` (VS Code Protocol)
從 Extension 傳遞至 Webview 的訊息。
```typescript
{
    command: 'updateVariables',
    scopes: VariableData[]
}
// or
{
    command: 'toggleVariable',
    name: string,
    checked: boolean
}
```
