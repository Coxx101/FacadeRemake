# FacadeRemake 前端设计框架与交互逻辑文档

> **文档版本**: 1.0.0  
> **生成日期**: 2026-05-10  
> **适用项目**: FacadeRemake 交互叙事编辑器  
> **目标**: 使无代码环境的人员能够理解并优化UI设计

---

## 目录

1. [技术栈概览](#1-技术栈概览)
2. [应用架构模式](#2-应用架构模式)
3. [组件层级与嵌套关系](#3-组件层级与嵌套关系)
4. [路由与页面流转逻辑](#4-路由与页面流转逻辑)
5. [全局状态管理结构](#5-全局状态管理结构)
6. [UI主题规范](#6-ui主题规范)
7. [核心交互状态流转](#7-核心交互状态流转)
8. [关键设计决策与实现细节](#8-关键设计决策与实现细节)
9. [优化建议](#9-优化建议)

---

## 1. 技术栈概览

### 1.1 核心技术

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.2.4 | UI组件框架 |
| TypeScript | ~6.0.2 | 类型安全开发 |
| Vite | ^5.4.11 | 构建工具与开发服务器 |
| Tailwind CSS | ^4.2.2 | 实用优先的CSS框架 |
| Zustand | ^5.0.12 | 轻量级状态管理 |
| Immer | ^11.1.4 | 不可变状态更新 |
| @xyflow/react | ^12.10.2 | 可视化流程图画布 |
| Lucide React | ^1.8.0 | 图标库 |
| WebSocket | Native | 实时通信（Play模式） |

### 1.2 开发依赖

- **@vitejs/plugin-react**: React集成插件
- **ESLint**: 代码质量检查
- **TypeScript ESLint**: TypeScript专用规则

---

## 2. 应用架构模式

### 2.1 三级模式架构

应用采用**单页应用（SPA）**架构，通过Zustand状态管理三个核心模式：

```
App (根组件)
 ├── mode: 'home'  →  StartScreen（项目管理系统）
 ├── mode: 'design' →  DesignMode（可视化编辑器）
 └── mode: 'play'   →  PlayMode（交互叙事体验）
```

### 2.2 模式切换机制

```typescript
// 状态定义
type AppMode = 'home' | 'design' | 'play'

// 切换方法
setMode: (mode: AppMode) => void
```

**关键特性**：
- 模式切换时保留状态（使用Zustand持久化）
- Home → Design/Play 需要选择项目
- Design ↔ Play 可快速切换（共享数据流）

---

## 3. 组件层级与嵌套关系

### 3.1 组件树结构

```
App
├── StartScreen (mode === 'home')
│   ├── 品牌Header
│   ├── ActionButton (新建项目、导入JSON)
│   ├── ProjectCard (项目列表)
│   │   ├── StatBadge (统计信息)
│   │   ├── MiniButton (编辑/游玩)
│   │   └── DropdownMenu (更多操作)
│   └── ModalOverlay (新建项目对话框)
│
└── mode !== 'home'
    ├── Toolbar (顶部工具栏)
    │   ├── 品牌标识
    │   ├── 模式切换按钮 (Design/Play)
    │   ├── 设计工具 (新建/删除/撤销/重做)
    │   ├── 面板切换 (蓝图/角色/变量/资源库)
    │   └── 文件操作 (导入/保存/导出)
    │
    └── 主内容区
        ├── DesignMode (mode === 'design')
        │   ├── LandmarkCanvas (React Flow画布)
        │   │   ├── LandmarkNode (自定义节点)
        │   │   └── TransitionEdge (自定义边)
        │   │
        │   ├── Inspector (属性检查器)
        │   │   ├── PropertiesTab (节点属性编辑)
        │   │   │   ├── Field (表单字段)
        │   │   │   ├── TagInput (标签输入)
        │   │   │   └── EffectListEditor (世界状态效果)
        │   │   ├── TransitionsTab (出边管理)
        │   │   └── StoryletPool (Storylet池)
        │   │
        │   ├── CharactersPanel (角色管理)
        │   ├── WorldStatePanel (变量定义)
        │   └── LibraryPanel (资源库)
        │
        └── PlayMode (mode === 'play')
            ├── ConnectionBanner (连接状态)
            └── 三栏布局
                ├── LeftPanel (左侧信息栏)
                │   ├── 时钟显示
                │   ├── 场景信息
                │   └── 世界状态
                ├── 中央区
                │   ├── SceneStage (角色立绘舞台)
                │   │   └── CharPortrait (角色肖像)
                │   ├── NarrativeBox (叙事文本)
                │   │   └── ChatMessage (对话消息)
                │   └── CommandBar (命令输入栏)
                │       ├── InputBar (文本输入)
                │       └── LocationPanel (位置切换)
                └── RightPanel (右侧面板)
                    ├── ChatLog (对话日志)
                    └── DebugPanel (LLM调试)
```

### 3.2 组件职责矩阵

| 组件 | 职责 | 状态依赖 |
|------|------|----------|
| **App** | 模式路由、全局布局 | useStore (mode) |
| **StartScreen** | 项目管理、入口页面 | useProjectStore |
| **Toolbar** | 设计工具、面板切换 | useStore (mode, rightPanel) |
| **LandmarkCanvas** | 可视化编辑画布 | useStore (landmarks) + React Flow |
| **Inspector** | 节点属性编辑 | useStore (selectedLandmarkId) |
| **PlayMode** | 交互叙事体验 | usePlayStore |
| **SceneStage** | 角色立绘展示 | usePlayStore (currentLandmark) |

---

## 4. 路由与页面流转逻辑

### 4.1 应用内"路由"（基于状态）

**本应用无传统路由**，采用**模式切换**机制：

```typescript
// 状态定义
mode: 'home' | 'design' | 'play'

// 流转逻辑
Home → Design: 选择项目 + 点击"编辑"
Home → Play:   选择项目 + 点击"游玩"
Design ↔ Play: 工具栏切换按钮
Any → Home: 点击品牌Logo
```

### 4.2 页面流转状态图

```
                    ┌───────────────┐
                    │               │
         ┌─────────▶│    Home      │◀─────────┐
         │          │  (项目列表)  │          │
         │          └───────────────┘          │
         │                 │                     │
         │ 点击"编辑"      │ 点击"游玩"        │
         │                 ▼                     ▼
         │        ┌───────────────┐    ┌───────────────┐
         │        │               │    │               │
         │        │   Design     │    │     Play      │
         │        │  (蓝图编辑)  │    │  (交互体验)  │
         │        │               │    │               │
         │        └───────────────┘    └───────────────┘
         │                 │                     │
         └─────────────────┘                     │
          工具栏切换       │                     │
                          └─────────────────────┘
                          工具栏切换
```

### 4.3 项目数据流

```
用户操作          状态更新               副作用
────────────────────────────────────────────────────
新建项目    →  useProjectStore.createProject()
            →  useStore.loadFromJSON(defaults)
            →  setMode('design')
            
打开项目    →  useProjectStore.getProject(id)
            →  useStore.loadFromJSON(project.snapshot)
            →  setMode('design' | 'play')
            
保存项目    →  useStore → 生成JSON
            →  useProjectStore.saveProjectSnapshot()
            →  markClean()
            
删除项目    →  useProjectStore.deleteProject(id)
            →  刷新项目列表
```

---

## 5. 全局状态管理结构

### 5.1 Zustand Store 架构

应用使用**三个独立的Zustand Store**，各司其职：

```
┌─────────────────────────────────────────────────────┐
│                   Store 架构                       │
├─────────────────────────────────────────────────────┤
│                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐│
│  │ useStore    │  │usePlayStore│  │useProject││
│  │ (Design)   │  │ (Play)     │  │Store     ││
│  │             │  │             │  │          ││
│  │ - landmarks │  │ - messages  │  │ - projects││
│  │ - storylets │  │ - worldState│  │          ││
│  │ - characters│  │ - turn      │  │ CRUD     ││
│  │ - ws def    │  │ - WebSocket │  │          ││
│  │ - library   │  │ - location  │  │          ││
│  └─────────────┘  └─────────────┘  └──────────┘│
│         │                 │                │          │
│         └─────────────────┴────────────────────────┘
│                   通过 localStorage 同步
│
└─────────────────────────────────────────────────────┘
```

### 5.2 useStore (主Store - Design模式)

**文件位置**: `src/store/useStore.ts`

**核心数据**:

```typescript
interface StoreState {
  // 模式
  mode: AppMode
  currentProjectId: string | null
  
  // 编辑数据
  landmarks: Landmark[]           // 地标节点
  storylets: Storylet[]           // 叙事片段
  characters: CharacterProfile[]  // 角色配置
  sharedContext: SharedContext    // 共享上下文
  worldStateDefinition: WorldStateDefinition  // 变量定义
  actionLibrary: ActionEntry[]   // 动作库
  expressionLibrary: ExpressionEntry[]  // 表情库
  propLibrary: PropEntry[]       // 道具库
  locationLibrary: LocationEntry[]  // 位置库
  
  // UI状态
  selectedLandmarkId: string | null
  selectedStoryletId: string | null
  inspectorTab: 'properties' | 'transitions'
  rightPanel: 'inspector' | 'characters' | 'worldstate' | 'library'
  inspectorWidth: number
  isStoryletModalOpen: boolean
  
  // 历史记录
  _undoCount: number
  _redoCount: number
}
```

**关键方法**:

| 方法 | 功能 |
|------|------|
| `addLandmark()` | 添加新节点（自动生成ID） |
| `updateLandmark()` | 更新节点属性（immer） |
| `deleteLandmark()` | 删除节点（含出边清理） |
| `addTransition()` | 添加节点间连线 |
| `undo()` / `redo()` | 撤销/重做（最多50步） |
| `loadFromJSON()` | 从JSON加载项目数据 |
| `selectLandmark()` | 选中节点（同步Inspector） |

**撤/重做实现**:

```typescript
// 使用模块级变量（不经过immer序列化）
const undoStack: HistorySnapshot[] = []
const redoStack: HistorySnapshot[] = []

// 操作前推入快照
function pushUndo(get: () => any) {
  undoStack.push({
    landmarks: JSON.parse(JSON.stringify(get().landmarks)),
    storylets: JSON.parse(JSON.stringify(get().storylets)),
    // ... 其他数据
  })
  if (undoStack.length > 50) undoStack.shift()
  redoStack.length = 0  // 新操作清空重做栈
}
```

### 5.3 usePlayStore (Play模式Store)

**文件位置**: `src/store/usePlayStore.ts`

**核心数据**:

```typescript
interface PlayState {
  // 对话系统
  messages: ChatMessage[]        // 对话历史
  currentLandmarkId: string     // 当前地标
  currentStoryletId: string     // 当前叙事片段
  turn: number                 // 当前回合
  
  // 世界状态（运行时）
  worldState: RuntimeWorldState  // { qualities, flags, relationships }
  
  // WebSocket连接
  connected: boolean
  connecting: boolean
  backendReady: boolean
  
  // 位置系统
  locations: Location[]
  playerLocation: string
  entityLocations: Record<string, string>
  
  // 回退系统
  _snapshotStack: PlaySnapshot[]  // 最多30层
}
```

**WebSocket通信流程**:

```
前端 (usePlayStore)          后端 (Python FastAPI)
       │                           │
       │── init_scene ──────────▶│  初始化场景数据
       │                         │
       │── player_input ────────▶│  玩家输入
       │                         │
       │◀── chat ───────────────│  角色对话
       │◀── state_update ───────│  世界状态更新
       │◀── player_turn ───────│  轮到玩家
       │                         │
       │── move_location ───────▶│  移动位置
       │                         │
       │◀── location_update ────│  位置同步
       │                         │
       └─────────────────────────┘
```

**消息类型定义**:

```typescript
type WsIncomingMessage = 
  | { type: 'chat', role: string, speech?: string }
  | { type: 'state_update', world_state: RuntimeWorldState }
  | { type: 'player_turn' }
  | { type: 'ready' }  // 后端就绪信号
  | { type: 'llm_debug' }  // LLM调试日志
  | { type: 'location_update' }
  | { type: 'beat_plan_refresh' }
```

### 5.4 useProjectStore (项目管理Store)

**文件位置**: `src/store/useProjectStore.ts`

**职责**: 项目CRUD操作，数据持久化到localStorage

```typescript
interface ProjectStoreState {
  projects: StoryProjectMeta[]
  
  createProject: (name, description) => StoryProjectMeta
  updateProjectMeta: (id, patch) => void
  saveProjectSnapshot: (id, data) => void  // 自动保存
  deleteProject: (id) => void
  getProject: (id) => StoryProjectMeta | undefined
}
```

**持久化策略**:

```typescript
const STORAGE_KEY = 'facadestudio_projects'

// 每次状态变化自动同步到localStorage
function saveToStorage(projects: StoryProjectMeta[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
}

// 初始化时恢复
function loadFromStorage(): StoryProjectMeta[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? JSON.parse(raw) : []
}
```

### 5.5 状态同步机制

```
┌─────────────────────────────────────────────────────┐
│              状态同步流程                           │
├─────────────────────────────────────────────────────┤
│                                                   │
│  用户操作 (Toolbar / Canvas / Inspector)           │
│       │                                           │
│       ▼                                           │
│  useStore.updateXXX()                              │
│       │                                           │
│       ▼                                           │
│  Zustand setState() → React重渲染                  │
│       │                                           │
│       ▼                                           │
│  LandmarkCanvas.useEffect() 监听landmarks变化      │
│       │                                           │
│       ▼                                           │
│  同步到React Flow状态 (setNodes/setEdges)         │
│       │                                           │
│       ▼                                           │
│  UI更新 (Canvas渲染 / Inspector显示)               │
│                                                   │
│  【保存时】                                        │
│  Toolbar.handleSave()                             │
│       │                                           │
│       ▼                                           │
│  useStore → 生成JSON → 下载文件                   │
│       │                                           │
│       ▼                                           │
│  useProjectStore.saveProjectSnapshot()              │
│       │                                           │
│       ▼                                           │
│  localStorage 持久化                               │
│                                                   │
└─────────────────────────────────────────────────────┘
```

---

## 6. UI主题规范

### 6.1 颜色系统

#### 6.1.1 设计模式 (Design Mode) - 深色主题

**主色板**:

| 变量名 | 色值 | 用途 |
|--------|------|------|
| `--bg-primary` | `#0f1117` | 页面背景 |
| `--bg-secondary` | `#1a1d27` | 次级背景（面板） |
| `--bg-card` | `#1e2130` | 卡片背景 |
| `--bg-hover` | `#252840` | 悬停状态 |
| `--bg-input` | `#131828` | 输入框背景 |

**边框与分割线**:

| 变量名 | 色值 | 用途 |
|--------|------|------|
| `--border-default` | `#2e3250` | 默认边框 |
| `--border-active` | `#4f6ef7` | 激活边框 |

**文本颜色**:

| 变量名 | 色值 | 用途 |
|--------|------|------|
| `--text-primary` | `#e8eaf0` | 主要文本 |
| `--text-secondary` | `#8891b0` | 次要文本 |
| `--text-muted` | `#4a5070` | 静默文本 |

**强调色**:

| 变量名 | 色值 | 用途 |
|--------|------|------|
| `--accent-blue` | `#4f6ef7` | 主强调色（按钮、选中） |
| `--accent-gold` | `#f5a623` | 金色（结局节点） |
| `--accent-green` | `#2ecc71` | 绿色（成功、连线类型） |
| `--accent-red` | `#e74c3c` | 红色（危险、删除） |
| `--accent-yellow` | `#f1c40f` | 黄色（计数连线） |
| `--accent-orange` | `#e67e22` | 橙色（Turn Limit连线） |

#### 6.1.2 游玩模式 (Play Mode) - 浅色主题

**主色板**:

| 变量名 | 色值 | 用途 |
|--------|------|------|
| `--bg-page` | `#f5f4f0` | 页面背景（暖白） |
| `--bg-panel` | `#ffffff` | 面板背景 |
| `--bg-surface` | `#f0ede8` | 表面色（浅米） |
| `--bg-stage` | `#e8e4dd` | 舞台背景 |
| `--bg-input` | `#ffffff` | 输入框 |

**文本颜色**:

| 变量名 | 色值 | 用途 |
|--------|------|------|
| `--text` | `#1a1814` | 主文本（深棕黑） |
| `--text-muted` | `#6b655c` | 次要文本 |
| `--text-dim` | `#9e9690` | 静默文本 |

**角色颜色**:

| 变量名 | 色值 | 用途 |
|--------|------|------|
| `--trip-color` | `#c0392b` | Trip角色（红） |
| `--grace-color` | `#2563a8` | Grace角色（蓝） |
| `--player-color` | `#1a6b40` | 玩家（绿） |
| `--narrator-color` | `#6b5c3e` | 叙述者（棕） |

### 6.2 排版规范

#### 6.2.1 字体族

```css
font-family: 'Inter', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
```

**特殊用途字体**:
- **品牌标题**: 默认字体栈
- **等宽文本**: `'Special Elite', 'Courier New', monospace` (Play模式横幅、 phase_tag)

#### 6.2.2 字号阶梯

| 用途 | 字号 | 字重 | 行高 |
|------|------|------|------|
| 页面标题 | 32px | 800 | 1.2 |
| 品牌标题 | 18px | 700 | - |
| 节点标题 | 14px | 700 | - |
| 正文文本 | 14px | 400 | 1.5 |
| 次要文本 | 13px | 500 | - |
| 小标签 | 12px | 600 | - |
| 辅助文本 | 11px | 500 | - |

#### 6.2.3 字间距

```css
/* 品牌标题 */
letter-spacing: -0.02em;

/* Play模式横幅 */
letter-spacing: 0.1em;
text-transform: uppercase;
```

### 6.3 间距系统

#### 6.3.1 基础间距单位

基于 **4px** 基准单位：

```css
/* 常用间距 */
padding: 4px, 6px, 8px, 10px, 12px, 14px, 16px, 20px, 24px, 32px
margin:  4px, 6px, 8px, 10px, 12px, 16px, 20px, 24px
gap:     4px, 6px, 8px, 10px, 12px, 16px
```

#### 6.3.2 组件内边距

| 组件 | padding | 说明 |
|------|---------|------|
| Toolbar | `0 16px` | 水平内边距 |
| Inspector头部 | `14px 16px` | 垂直+水平 |
| Field | `6px 10px` | 输入框 |
| Button (small) | `4px 10px` | 小按钮 |
| Button (medium) | `6px 18px` | 中按钮 |
| Button (large) | `10px 20px` | 大按钮 |
| Card | `20px` | 卡片 |
| Modal | `28px` | 对话框 |

#### 6.3.3 圆角规范

```css
--radius-sm: 4px;    /* 标签、Badge */
--radius-md: 6px;    /* 按钮、输入框 */
--radius-lg: 8px;    /* 面板、卡片 */
--radius-xl: 10px;   /* LandmarkNode */
--radius-2xl: 12px;  /* Modal、EmptyState */
```

### 6.4 阴影与边框

#### 6.4.1 阴影

```css
/* Play模式 */
--shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
--shadow-md: 0 2px 8px rgba(0,0,0,0.12);

/* 节点选中效果 */
box-shadow: 0 0 0 3px rgba(79,110,247,0.3), 0 4px 20px rgba(0,0,0,0.5);
```

#### 6.4.2 边框

```css
/* 默认边框 */
border: 1px solid var(--border-default);  /* #2e3250 */

/* 激活边框 */
border-color: var(--border-active);  /* #4f6ef7 */

/* 节点选中边框 */
border: 2px solid var(--accent-blue);
```

### 6.5 交互状态样式

#### 6.5.1 按钮状态

```css
/* 默认 */
background: rgba(255,255,255,0.04);
border: 1px solid var(--border-default);

/* 悬停 */
background: rgba(255,255,255,0.08);

/* 激活（选中） */
background: var(--accent-blue);  /* #4f6ef7 */
color: #fff;

/* 禁用 */
opacity: 0.5;
cursor: not-allowed;
```

#### 6.5.2 输入框状态

```css
/* 默认 */
background: var(--bg-input);
border: 1px solid var(--border-default);

/* 聚焦 */
border-color: var(--accent-blue);
box-shadow: 0 0 0 2px rgba(79,110,247,0.25);
outline: none;

/* 错误（自定义） */
border-color: var(--accent-red);
```

#### 6.5.3 可访问性

```css
/* 键盘焦点可见性 */
:focus-visible {
  outline: 2px solid var(--accent-blue);
  outline-offset: 2px;
}
```

### 6.6 动画与过渡

#### 6.6.1 过渡时间

```css
/* 通用过渡 */
transition: all 0.15s ease;

/* 颜色过渡 */
transition: background-color 0.15s, color 0.15s, opacity 0.15s;
```

#### 6.6.2 关键帧动画

```css
/* 淡入上升 */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* 滑入 */
@keyframes slideIn {
  from { opacity: 0; transform: translateX(8px); }
  to   { opacity: 1; transform: translateX(0); }
}

/* 打字机效果（Play模式） */
@keyframes typingBounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.3; }
  30%           { transform: translateY(-4px); opacity: 0.8; }
}

/* 说话指示脉冲 */
@keyframes speakingPulse {
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50%      { transform: scale(1.4); opacity: 1; }
}
```

#### 6.6.3 应用动画的类名

```css
.fade-in   → fadeIn 0.15s ease-out
.slide-in  → slideIn 0.2s ease-out
```

---

## 7. 核心交互状态流转

### 7.1 Design模式 - 画布交互

#### 7.1.1 节点操作状态机

```
                    ┌──────────────────┐
                    │   空闲状态       │
                    │  (无选中)       │
                    └──────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │ 单击节点 │   │ 框选拖拽 │   │ 连接拖拽 │
   │ selected │   │ 多选状态 │   │ 创建连线 │
   └──────────┘   └──────────┘   └──────────┘
          │               │               │
          ▼               ▼               ▼
   ┌──────────────────────────────────────────┐
   │         Inspector 显示属性                │
   │   - 单击：选中单个 → PropertiesTab      │
   │   - 双击：选中 + 聚焦Inspector         │
   │   - 多选：显示批量操作提示              │
   └──────────────────────────────────────────┘
          │
          ├─ 按Delete/Backspace → 删除节点（确认对话框）
          ├─ 拖拽移动 → 实时同步位置到store
          └─ 右键边 → 删除连线（确认对话框）
```

#### 7.1.2 连线类型视觉编码

| 连线类型 | 判断条件 | 箭头颜色 | 动画 |
|----------|----------|----------|------|
| **condition** | `conditions.length > 0` | 绿色 `#2ecc71` | 无 |
| **count** | `storylet_count != null` | 黄色 `#f1c40f` | 无 |
| **fallback** | `is_fallback === true` | 红色 `#e74c3c` | 流动动画 |
| **turnlimit** | `turn_limit != null` | 橙色 `#e67e22` | 无 |

**SVG箭头定义**:

```jsx
<marker id="arrow-condition" color="#2ecc71" />
<marker id="arrow-count"     color="#f1c40f" />
<marker id="arrow-fallback"  color="#e74c3c" />
<marker id="arrow-turnlimit" color="#e67e22" />
```

#### 7.1.3 撤销/重做快捷键

```
Ctrl + Z        → 撤销
Ctrl + Shift + Z → 重做
Ctrl + Y        → 重做（备选）
```

**限制**: 最多50步历史记录（防止内存溢出）

### 7.2 Play模式 - 对话交互

#### 7.2.1 对话轮流状态机

```
                    ┌──────────────────┐
                    │  后端处理中      │
                    │  (isLoading=true)│
                    └──────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │ 接收消息 │   │ 玩家输入 │   │ 游戏结束 │
   │ (chat)   │   │ (player_) │   │ (game_)   │
   │          │   │ turn      │   │ ended)    │
   └──────────┘   └──────────┘   └──────────┘
          │               │               │
          ▼               ▼               ▼
   ┌──────────────────────────────────────────┐
   │ 状态更新 →  UI更新                      │
   │   - messages.push()                     │
   │   - worldState 合并更新                │
   │   - currentLandmark/Storylet 更新      │
   │   - turn++                            │
   └──────────────────────────────────────────┘
                          │
                          ▼
                    ┌──────────────────┐
                    │  等待玩家输入    │
                    │ (isPlayerTurn)   │
                    └──────────────────┘
                          │
            ┌─────────────────┴─────────────────┐
            │                                   │
            ▼                                   ▼
   ┌────────────────┐                 ┌────────────────┐
   │ 玩家输入文本   │                 │ 玩家中立 (…)  │
   │ → sendMessage() │                 │ → isSilence    │
   └────────────────┘                 └────────────────┘
            │                                   │
            └───────────────┬───────────────────┘
                            ▼
                     ┌──────────────────┐
                     │  推入快照到栈   │
                     │  (_snapshotStack)│
                     └──────────────────┘
                            │
                            ▼
                     ┌──────────────────┐
                     │  发送 player_   │
                     │  input 到后端   │
                     └──────────────────┘
                            │
                            ▼
                     ┌──────────────────┐
                     │  后端处理中      │
                     │  (回到初始状态)  │
                     └──────────────────┘
```

#### 7.2.2 回退机制

```typescript
// 玩家输入前自动保存快照
const snapshot: PlaySnapshot = {
  messages: [...],
  worldState: {...},
  currentLandmarkId: string,
  currentStoryletId: string | null,
  turn: number,
}

// 回退操作
rollback: () => {
  const snap = _snapshotStack.pop()
  // 恢复所有状态
}
```

**限制**: 最多30层快照（防止内存溢出）

#### 7.2.3 连接状态管理

```
                    ┌──────────────────┐
                    │  未连接          │
                    │  (connected=false)│
                    │  (connecting=false)│
                    └──────────────────┘
                          │
                          │ 组件挂载时自动调用 connect()
                          ▼
                    ┌──────────────────┐
                    │  连接中          │
                    │  (connecting=true)│
                    └──────────────────┘
                          │
           ┌──────────────┴──────────────┐
           │                             │
           ▼                             ▼
    ┌─────────────┐            ┌────────────────┐
    │ 连接成功     │            │ 连接超时       │
    │ (onopen)    │            │ (> 5秒)       │
    └─────────────┘            └────────────────┘
           │                             │
           ▼                             ▼
    ┌──────────────────┐       ┌──────────────────┐
    │ 等待后端就绪    │       │ 显示错误提示     │
    │ (backendReady)  │       │ ConnectionBanner │
    └──────────────────┘       └──────────────────┘
           │
           │ 收到 'ready' 消息
           ▼
    ┌──────────────────┐
    │ 发送 init_scene   │
    │ (场景数据)       │
    └──────────────────┘
           │
           ▼
    ┌──────────────────┐
    │ 游戏就绪          │
    │ (可开始对话)     │
    └──────────────────┘
```

**重连机制**:

```typescript
// 指数退避重连
MAX_RECONNECT = 5
BASE_DELAY = 3000

function getReconnectDelay(): number {
  return Math.min(BASE_DELAY * Math.pow(2, reconnectAttempts), 60000)
}
```

### 7.3 面板切换交互

#### 7.3.1 右侧面板（Design模式）

```
Toolbar 右侧面板切换按钮
        │
        ├─ "蓝图" → rightPanel = 'inspector'
        │   显示：Inspector (节点属性)
        │
        ├─ "角色" → rightPanel = 'characters'
        │   显示：CharactersPanel (角色管理)
        │
        ├─ "变量" → rightPanel = 'worldstate'
        │   显示：WorldStatePanel (变量定义)
        │
        └─ "资源库" → rightPanel = 'library'
            显示：LibraryPanel (动作/表情/道具/位置)
```

**面板宽度**: 可拖拽调整（280-800px，默认380px）

#### 7.3.2 面板切换按钮样式

```css
/* 未选中 */
background: none;
color: var(--text-secondary);  /* #8891b0 */

/* 选中 */
background: var(--accent-color);  /* 蓝图:#4f6ef7, 角色:#f5a623, 变量:#e67e22, 资源库:#27ae60 */
color: #fff;
```

### 7.4 项目管理系统交互

#### 7.4.1 项目卡片交互

```
ProjectCard (项目卡片)
        │
        ├─ 点击卡片主体 → 无操作（等待明确指令）
        │
        ├─ 点击"编辑"按钮 → onEnterDesign()
        │   → loadFromJSON(project.snapshot)
        │   → setMode('design')
        │
        ├─ 点击"游玩"按钮 → onEnterPlay()
        │   → loadFromJSON(project.snapshot)
        │   → setMode('play')
        │
        └─ 点击"更多"(⋯) → 打开DropdownMenu
            ├─ "编辑" → onEnterDesign()
            ├─ "游玩" → onEnterPlay()
            └─ "删除" → confirm() → deleteProject()
```

#### 7.4.2 新建项目对话框

```
点击"新建项目"
        │
        ▼
    显示 ModalOverlay
        │
        ├─ 输入项目名称（必填）
        ├─ 输入简介（可选）
        │
        ├─ 点击"取消" → 关闭对话框
        │
        └─ 点击"创建" → handleCreate()
            → createProject(name, description)
            → loadFromJSON(defaults)
            → setCurrentProjectId(project.id)
            → setMode('design')
```

---

## 8. 关键设计决策与实现细节

### 8.1 React Flow集成策略

#### 8.1.1 双状态同步

**问题**: React Flow需要自己的nodes/edges状态用于流畅交互，但应用数据在Zustand store中。

**解决方案**: 使用`useEffect`双向同步

```typescript
// Store → React Flow (数据变化时)
useEffect(() => {
  setNodes((nds) =>
    nds.map((n) => ({
      ...n,
      data: { landmark: landmarks.find(l => l.id === n.id) }
    }))
  )
}, [landmarks])

// React Flow → Store (拖拽完成时)
onNodeDragStop: (_, node) => {
  useStore.getState().updateLandmarkPosition(node.id, node.position)
}
```

#### 8.1.2 多选支持

```typescript
// React Flow内置框选
selectionMode={SelectionMode.Partial}
selectionOnDrag={true}

// 自定义多选拖拽
onNodeDragStart: 记录所有选中节点的初始位置
onNodeDrag: 计算偏移量，批量更新store
onNodeDragStop: 只推送一次撤销快照
```

### 8.2 WebSocket连接管理

#### 8.2.1 单例模式

```typescript
// 模块级变量确保唯一连接
let wsInstance: WebSocket | null = null

function getWs(...) {
  // 已有连接且状态正常 → 复用
  if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
    return wsInstance
  }
  // 否则创建新连接
  wsInstance = new WebSocket(url)
}
```

#### 8.2.2 会话隔离

```typescript
// 每次进入Play模式创建新会话
const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
const wsUrlWithSession = `${WS_URL}?session_id=${sessionId}`
```

**原因**: 防止StrictMode双重渲染导致多个连接

### 8.3 性能优化策略

#### 8.3.1 组件记忆化

```typescript
// LandmarkNode使用memo防止不必要的重渲染
export const LandmarkNode = memo(({ data, selected }) => {
  // 只在data或selected变化时重渲染
})
```

#### 8.3.2 选择性订阅

```typescript
// 只订阅组件需要的状态，减少重渲染
const landmarks = useStore((s) => s.landmarks)
const selectedId = useStore((s) => s.selectedLandmarkId)
```

#### 8.3.3 历史记录限制

```typescript
// 防止内存泄漏
const UNDO_LIMIT = 50
if (undoStack.length > UNDO_LIMIT) undoStack.shift()

// Play模式快照限制
if (s._snapshotStack.length > 30) s._snapshotStack.shift()
```

### 8.4 数据持久化策略

#### 8.4.1 自动保存

```typescript
// 每次landmarks/storylets等数据变化
→ isDirty = true

// Toolbar显示"未保存"标识
{isDirty && <AlertTriangle />}

// 点击保存 → 下载JSON + 同步到localStorage
handleSave: () => {
  // 1. 下载JSON文件
  // 2. useProjectStore.saveProjectSnapshot()
  // 3. markClean()
}
```

#### 8.4.2 布局与数据分离

```typescript
// JSON导出格式
{
  landmarks: [...],  // 不含position
  landmarks_layout: [{ id, position }],  // 单独存储布局
  storylets: [...],
  characters: [...],
  ...
}
```

**原因**: 布局是前端临时状态，不应污染后端数据

---

## 9. 优化建议

### 9.1 性能优化

#### 9.1.1 虚拟滚动

**问题**: LandmarkCanvas中节点过多时（>100）渲染卡顿。

**建议**: 
- 使用`@tanstack/react-virtual`实现虚拟滚动
- 或分批渲染节点（IntersectionObserver）

#### 9.1.2 代码分割

**问题**: 所有组件打包到单一bundle，初始加载慢。

**建议**:
```typescript
// 懒加载PlayMode（较大）
const PlayMode = lazy(() => import('./components/play/PlayMode'))
```

### 9.2 用户体验优化

#### 9.2.1 拖拽优化

**问题**: 多选拖拽时每次鼠标移动都更新store，性能差。

**建议**: 使用`requestAnimationFrame`节流

```typescript
let rafId: number
onNodeDrag: (event, node) => {
  cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => {
    updateLandmarksPositions(...)
  })
}
```

#### 9.2.2 错误边界

**问题**: 单个组件崩溃导致整个应用白屏。

**建议**: 添加Error Boundary

```tsx
<ErrorBoundary fallback={<ErrorPage />}>
  <App />
</ErrorBoundary>
```

### 9.3 可访问性优化

#### 9.3.1 键盘导航

**当前状态**: 部分支持（快捷键、焦点可见性）

**建议补充**:
- LandmarkNode支持方向键微调位置
- Inspector表单支持Enter键保存
- ARIA标签完善

#### 9.3.2 屏幕阅读器

**建议**:
```tsx
<div role="application" aria-label="交互叙事编辑器">
  <LandmarkCanvas />
</div>
```

### 9.4 主题系统优化

#### 9.4.1 CSS变量统一

**当前问题**: Design模式和Play模式使用不同的CSS变量集。

**建议**: 统一为单一主题系统

```css
:root {
  /* 统一变量命名 */
  --color-bg-primary: #0f1117;
  --color-text-primary: #e8eaf0;
}

[data-theme="play"] {
  --color-bg-primary: #f5f4f0;
  --color-text-primary: #1a1814;
}
```

#### 9.4.2 暗色/亮色模式切换

**建议**: 在Toolbar添加主题切换按钮

### 9.5 文档与维护

#### 9.5.1 组件文档

**建议**: 使用Storybook为每个组件添加可视化文档

#### 9.5.2 类型安全

**当前状态**: 已使用TypeScript，但部分`any`类型

**建议**: 消除所有`any`，使用严格类型

---

## 附录

### A. 文件结构快速参考

```
frontend/src/
├── main.tsx                          # 入口文件
├── App.tsx                          # 根组件（模式路由）
├── index.css                        # 全局样式 + Tailwind主题
├── App.css                          # App级样式（空）
│
├── types.ts                         # 全局TypeScript类型定义
├── data/
│   └── defaults.ts                 # 默认项目数据
│
├── store/
│   ├── useStore.ts                 # 主Store (Design模式)
│   ├── usePlayStore.ts             # Play模式Store + WebSocket
│   ├── useProjectStore.ts          # 项目管理Store
│   └── cascadeWorldState.ts       # 世界状态级联更新
│
└── components/
    ├── StartScreen.tsx             # 首页（项目管理）
    ├── Toolbar.tsx                # 顶部工具栏
    │
    ├── canvas/                    # 画布相关
    │   ├── LandmarkCanvas.tsx     # React Flow画布
    │   ├── LandmarkNode.tsx       # 自定义节点
    │   └── TransitionEdge.tsx     # 自定义边
    │
    ├── inspector/                 # 检查器
    │   ├── Inspector.tsx          # 属性面板
    │   ├── TransitionsTab.tsx     # 出边管理
    │   └── StoryletPool.tsx      # Storylet池
    │
    ├── characters/                # 角色管理
    │   └── CharactersPanel.tsx
    │
    ├── worldstate/                # 世界状态
    │   └── WorldStatePanel.tsx
    │
    ├── library/                   # 资源库
    │   └── LibraryPanel.tsx
    │
    ├── modal/                     # 模态框
    │   └── StoryletModal.tsx
    │
    ├── play/                      # Play模式组件
    │   ├── PlayMode.tsx           # 主布局
    │   ├── LeftPanel.tsx          # 左栏
    │   ├── SceneStage.tsx         # 角色立绘
    │   ├── NarrativeBox.tsx       # 叙事文本
    │   ├── CommandBar.tsx         # 命令输入
    │   ├── InputBar.tsx          # 文本输入
    │   ├── LocationPanel.tsx      # 位置面板
    │   ├── RightPanel.tsx         # 右栏
    │   ├── ChatLog.tsx           # 对话日志
    │   └── DebugPanel.tsx        # 调试面板
    │
    └── shared/                   # 共享组件
        └── KeyInput.tsx          # 变量名输入（自动补全）
```

### B. 关键类型定义速查

```typescript
// 地标（Design模式核心数据）
interface Landmark {
  id: string
  title: string
  description: string
  phase_tag: string
  is_ending: boolean
  ending_content: string
  transitions: LandmarkTransition[]  // 出边
  max_storylets?: number
  narrative_constraints: NarrativeConstraints
  world_state_effects_on_enter: WorldStateEffect[]
  fallback_storylet?: string
  position?: { x: number; y: number }  // 前端布局用
}

// 叙事片段
interface Storylet {
  id: string
  title: string
  phase_tags: string[]
  narrative_goal: string
  conditions: Condition[]  // 前置条件
  content: Record<string, unknown>
  effects: WorldStateEffect[]  // 后置效果
  repeatability: 'never' | 'unlimited' | 'cooldown'
  sticky: boolean
  salience: Salience  // 调度优先级
  // ...
}

// 世界状态定义（Design模式）
interface WorldStateDefinition {
  qualities: QualityDef[]    // 数值变量
  flags: FlagDef[]          // 标志变量
  relationships: RelationshipDef[]  // 关系值
}

// 运行时世界状态（Play模式）
interface RuntimeWorldState {
  qualities: Record<string, number>
  flags: Record<string, boolean | string | number>
  relationships: Record<string, number>
}
```

### C. 常用样式代码片段

#### C.1 按钮样式模板

```tsx
// 主要按钮（蓝色）
<button style={{
  padding: '8px 20px',
  borderRadius: '8px',
  background: 'var(--accent-blue)',
  border: 'none',
  color: '#fff',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'opacity 0.15s',
}}>
  主要操作
</button>

// 次要按钮（透明）
<button style={{
  padding: '8px 20px',
  borderRadius: '8px',
  background: 'transparent',
  border: '1px solid var(--border-default)',
  color: 'var(--text-secondary)',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
}}>
  次要操作
</button>
```

#### C.2 输入框样式模板

```tsx
<input
  style={{
    width: '100%',
    padding: '10px 12px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border-default)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
  }}
  onFocus={(e) => {
    e.currentTarget.style.borderColor = 'var(--accent-blue)'
    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(79,110,247,0.25)'
  }}
  onBlur={(e) => {
    e.currentTarget.style.borderColor = 'var(--border-default)'
    e.currentTarget.style.boxShadow = 'none'
  }}
/>
```

---

## 总结

本文档详细分析了FacadeRemake前端项目的：

1. **技术栈** - React 19 + TypeScript + Vite + Tailwind CSS + Zustand + React Flow
2. **组件架构** - 三级模式（Home/Design/Play）+ 清晰的组件层级
3. **状态管理** - 三个独立Zustand Store，各司其职
4. **UI主题** - 深色（Design）/ 浅色（Play）双主题，完整的设计系统
5. **交互逻辑** - 画布操作、对话轮流、连接管理的完整状态机

**关键设计亮点**：
- ✅ 撤销/重做系统（50步历史）
- ✅ WebSocket实时通信 + 自动重连
- ✅ 双状态同步（React Flow + Zustand）
- ✅ 项目自动保存（localStorage持久化）
- ✅ 可访问性支持（键盘导航、焦点可见性）

**优化方向**：
- 🔧 虚拟滚动（大型画布）
- 🔧 代码分割（懒加载）
- 🔧 统一主题系统（暗色/亮色切换）
- 🔧 消除`any`类型（类型安全）

---

**文档结束** | 如有疑问，请参考源代码或联系开发团队。
