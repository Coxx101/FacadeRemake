# FacadeRemake 技术架构文档

> 版本：v2.0 [Retro Edition] | 更新日期：2026-05-11

---

## 一、项目概述

FacadeRemake 是一个基于 LLM 驱动的交互式叙事游戏框架，灵感来源于经典游戏《Facade》。项目由两个核心部分组成：

| 模块 | 路径 | 技术栈 | 职责 |
|------|------|--------|------|
| **prototype（后端）** | `e:\FacadeRemake\prototype` | Python 3.x + WebSocket (uvicorn/FastAPI) | 游戏逻辑引擎、LLM 编排、世界状态管理 |
| **frontend（前端）** | `e:\FacadeRemake\frontend` | React 19 + TypeScript + Vite + Zustand | 可视化编辑器、Play 模式、调试面板 |

系统采用 **编辑器-运行时分离架构**：用户在 Design 模式下通过蓝图编辑器配置 Landmark（叙事节点）和 Storylet（叙事片段），在 Play 模式下通过 WebSocket 与后端 LLM 引擎实时交互。

---

## 二、prototype（后端）目录结构

```
prototype/
├── facade_remake/               # 主包
│   ├── __init__.py
│   ├── main.py                  # 入口：初始化并运行游戏
│   ├── agents/                  # 智能体模块
│   │   ├── __init__.py
│   │   ├── character_agent.py   # 角色 Agent（Trip / Grace 行为逻辑）
│   │   ├── director.py          # 导演 Agent（叙事控制中心）
│   │   ├── input_parser.py      # 输入解析器（玩家输入分析）
│   │   ├── llm_client.py        # LLM 客户端（OpenAI 兼容 API）
│   │   └── story_selector.py    # Storylet 选择器（条件匹配）
│   ├── config/                  # 配置模块
│   │   ├── characters.py        # 角色配置（Trip / Grace 预设）
│   │   └── scenario_schema.py   # 场景数据校验（Pydantic 模型）
│   ├── core/                    # 核心数据模型
│   │   ├── __init__.py
│   │   ├── di_container.py      # 依赖注入容器
│   │   ├── landmark.py          # Landmark 数据模型
│   │   ├── location_manager.py  # 位置系统管理器
│   │   ├── logging.py           # 日志系统配置
│   │   ├── state_manager.py     # 游戏状态管理器
│   │   ├── storylet.py          # Storylet 数据模型
│   │   └── world_state.py       # 世界状态（qualities / flags / relationships）
│   ├── data/                    # 数据目录
│   │   ├── __init__.py
│   │   └── builtin_scenarios/   # 内置场景
│   │       ├── __init__.py
│   │       └── dinner_party.py  # 晚宴场景定义
│   └── engine/                  # 引擎模块
│       ├── __init__.py
│       ├── event_loop.py        # 事件循环（异步任务调度）
│       ├── game_engine.py       # 游戏引擎主控
│       ├── output.py            # 输出格式化
│       └── output_parser.py     # LLM 输出解析器
├── ws_server.py                 # WebSocket 服务器（FastAPI + uvicorn）
├── test_ws.py                   # WebSocket 测试客户端
└── requirements.txt             # Python 依赖
```

---

## 三、prototype 核心功能模块介绍

### 3.1 core/ — 核心数据模型

#### WorldState（world_state.py）

世界状态是整个系统的"记忆"，存储三类变量：

| 类别 | 类型 | 示例 | 用途 |
|------|------|------|------|
| `qualities` | `Dict[str, float]` | `trip_anger: 7.5` | 数值型品质（连续） |
| `flags` | `Dict[str, bool\|str\|number]` | `grace_knows_secret: true` | 布尔/字符串/数值标记 |
| `relationships` | `Dict[str, float]` | `trip_to_grace_trust: 5.0` | 人际关系数值 |

关键方法：
- `get_all_qualities()` → 获取所有质量值
- 读取/更新三类变量，支持前端 debug 调试面板直接编辑

#### Landmark（landmark.py）

叙事节点，定义游戏的故事阶段划分。每个 Landmark 包含：
- `id` / `title` / `description` / `phase_tag`：标识与描述
- `is_ending`：是否为结局节点
- `transitions[]`：出边列表（跳转到下一阶段的规则）
- `max_storylets`：该阶段最多执行的 Storylet 数量
- `world_state_effects_on_enter`：进入时触发的世界状态效果
- `narrative_constraints`：叙事约束（允许的 Storylet 标签、禁止揭露的信息）

#### Storylet（storylet.py）

叙事片段的抽象定义。每个 Storylet 包含：
- `conditions[]`：触发条件（flag/quality/keyword 检查）
- `llm_trigger`：LLM 触发指令（可选）
- `content`：叙事内容模板
- `effects[]` / `conditional_effects[]`：执行后的世界状态效果
- `repeatability`：可重复性（never / once_per_phase / always）
- `salience`：显著性（base + modifiers，用于优先级排序）
- `sticky`：是否粘滞（不被其他 Storylet 打断）
- `completion_trigger`：完成条件触发器

#### StateManager（state_manager.py）

管理游戏运行时的核心状态，协调 WorldState、Landmark、Storylet 之间的状态转换。主要职责：
- 追踪当前 Landmark / Storylet
- 管理游戏回合计数
- 快照机制（用于前端 rollback）

#### LocationManager（location_manager.py）

RPG 风格的位置系统管理器。功能：
- 定义场景的多个位置节点及其邻接关系
- 追踪玩家当前位置
- 追踪角色和物品在各位置的分布 (`entityLocations`)
- 支持玩家在相邻位置间移动

#### DIContainer（di_container.py）

依赖注入容器，用于管理各模块间的依赖关系，避免硬编码耦合。

#### Logging（logging.py）

统一的日志配置模块，定义日志格式和级别。

---

### 3.2 agents/ — 智能体模块

#### Director（director.py）

叙事导演 Agent，作为游戏逻辑的最高层控制器。职责：
- 管理叙事节奏和阶段切换
- 与 StorySelector 协作选择当前阶段的 Storylet
- 协调 CharacterAgent 的角色行为生成
- 维护叙事的连贯性

#### CharacterAgent（character_agent.py）

角色 Agent，负责生成 Trip 和 Grace 两个 NPC 的言行。核心参数：
- `identity`：角色身份描述（注入 LLM system prompt）
- `personality`：性格特征
- `background[]`：角色背景条目
- `secret_knowledge[]`：秘密知识（分梯度：系统知道、角色自己知道、角色不知道）
- `ng_words[]`：禁忌词（绝不可提及的话题）
- `monologues[]`：内心独白模板（当特定条件触发时生成独白）

每次响应包含三个维度的输出：
1. **speech**：口头语言（对话文本）
2. **action**：动作描述
3. **thought**：内心独白（调试用，不展示给玩家）

#### InputParser（input_parser.py）

玩家输入解析器。功能：
- 分析玩家输入的语义意图
- 提取关键词（用于 Storylet 的 `player_input_keyword` 条件匹配）
- 情绪分析
- 话题分类

#### LLMClient（llm_client.py）

LLM 调用客户端，封装与 OpenAI 兼容 API 的交互。支持：
- 模型选择和温度控制
- 系统提示词注入
- 多轮对话上下文管理
- LLM 调用日志记录（返回 raw 请求/响应供前端 Debug 面板展示）

#### StorySelector（story_selector.py）

Storylet 选择器，基于条件匹配和 Salience 排序从 Storylet Pool 中选择当前应执行的叙事片段。关键逻辑：
- 检查 Storylet 的 conditions 是否满足当前 WorldState
- 检查 llm_trigger 条件是否匹配
- 按 salience 排序选择优先级最高的
- 处理 sticky 和 on_interrupt 逻辑

---

### 3.3 engine/ — 引擎模块

#### GameEngine（game_engine.py）

游戏引擎主控制器。从 `main.py` 接收场景配置，初始化并驱动整个游戏。流程：
1. 接收前端的 `init_scene` 数据（Landmarks + Storylets + Characters + WSD）
2. 初始化 WorldState
3. 进入主循环：Director → StorySelector → CharacterAgent → OutputParser → 返回前端

#### EventLoop（event_loop.py）

异步事件循环管理器。职责：
- 管理玩家输入事件队列
- 管理 LLM 调用的并发
- 控制回合流转
- 管理 Beat Plan（节奏计划）的刷新

#### Output（output.py）

输出格式化模块，将 LLM 原始输出转换为结构化的 ChatMessage。包含：
- 角色发言结构
- 动作描述
- 内心独白
- 世界状态更新

#### OutputParser（output_parser.py）

LLM 输出解析器。将 LLM 返回的非结构化或半结构化文本解析为系统内部使用的结构化数据。核心挑战：
- 从对话文本中分离 speech / action / thought
- 提取世界状态变更意图
- 解析 Storylet 完成标记

---

### 3.4 config/ — 配置模块

#### Characters（characters.py）

Trip 和 Grace 的角色预设配置，包含默认的 identity、personality、background 等。

#### ScenarioSchema（scenario_schema.py）

基于 Pydantic 的场景数据校验模型。定义前端传入的 `init_scene` 数据结构规范，确保类型安全。

---

### 3.5 data/ — 数据目录

#### builtin_scenarios/dinner_party.py

内置场景：晚宴场景。预定义了 Landmark 蓝图、初始 WorldState 和 Storylet Pool。

---

### 3.6 ws_server.py — WebSocket 服务器

基于 FastAPI + uvicorn 的 WebSocket 服务器。

**端点**：`ws://localhost:8000/ws/play?session_id=<session_id>`

**消息协议**：

| 方向 | 消息类型 | 说明 |
|------|----------|------|
| 前端→后端 | `init_scene` | 初始化场景数据 |
| 后端→前端 | `ready` | 后端已初始化，等待 init_scene |
| 前端→后端 | `player_input` | 玩家输入文本 |
| 后端→前端 | `chat` | 角色发言 / 旁白 |
| 后端→前端 | `state_update` | 世界状态 + Landmark/Storylet 变更 |
| 后端→前端 | `player_turn` | 轮到玩家输入 |
| 后端→前端 | `llm_debug` | LLM 调用调试日志 |
| 前端→后端 | `move_location` | 玩家移动到新位置 |
| 后端→前端 | `location_update` | 位置状态更新 |
| 后端→前端 | `location_info` | 完整位置信息（含导航列表） |
| 后端→前端 | `beat_plan_refresh` | Beat Plan 刷新 |
| 前端→后端 | `debug_worldstate` | 调试面板修改 WorldState |
| 后端→前端 | `error` | 错误消息 |

---

## 四、frontend（前端）目录结构

```
frontend/
├── index.html
├── prototype-play-ui.html
├── package.json
├── vite.config.ts
├── tsconfig*.json
├── eslint.config.js
├── check.cjs
├── public/
│   ├── favicon.svg
│   └── icons.svg
└── src/
    ├── main.tsx                   # React 入口
    ├── App.tsx                    # 根组件（路由/模式切换）
    ├── App.css
    ├── index.css                  # 全局样式（90s Retro + TailwindCSS）
    ├── types.ts                   # 全局 TypeScript 类型定义
    ├── data/
    │   └── defaults.ts            # DEMO 默认数据
    ├── store/
    │   ├── useStore.ts            # Design 模式主 Store（zustand+immer）
    │   ├── usePlayStore.ts        # Play 模式运行时 Store（WebSocket）
    │   ├── useProjectStore.ts     # 项目持久化 Store（localStorage）
    │   └── cascadeWorldState.ts   # WSD 级联同步逻辑
    └── components/
        ├── StartScreen.tsx
        ├── Toolbar.tsx
        ├── canvas/                # React Flow 蓝图
        │   ├── LandmarkCanvas.tsx
        │   ├── LandmarkNode.tsx
        │   └── TransitionEdge.tsx
        ├── inspector/             # 属性面板
        │   ├── Inspector.tsx
        │   ├── TransitionsTab.tsx
        │   └── StoryletPool.tsx
        ├── characters/
        │   └── CharactersPanel.tsx
        ├── worldstate/
        │   └── WorldStatePanel.tsx
        ├── library/
        │   └── LibraryPanel.tsx
        ├── modal/
        │   └── StoryletModal.tsx
        ├── shared/
        │   └── KeyInput.tsx
        └── play/                  # Play 模式组件
            ├── PlayMode.tsx
            ├── LeftPanel.tsx
            ├── SceneStage.tsx
            ├── NarrativeBox.tsx
            ├── ChatLog.tsx
            ├── CommandBar.tsx
            ├── InputBar.tsx
            ├── RightPanel.tsx
            ├── DebugPanel.tsx
            └── LocationPanel.tsx
```

---

## 五、frontend 核心功能模块介绍

### 5.1 状态管理层（三个 Zustand Store）

| Store | 文件 | 职责 |
|-------|------|------|
| **useStore** | `store/useStore.ts` | Design 模式：Landmark/Storylet/Character/WSD/Library 的完整 CRUD + undo/redo |
| **usePlayStore** | `store/usePlayStore.ts` | Play 模式：WebSocket 通信、对话消息、运行时 WorldState、位置系统 |
| **useProjectStore** | `store/useProjectStore.ts` | 项目持久化：基于 localStorage 的项目元信息和快照 |

#### undo/redo 架构（useStore）

- 模块级 `undoStack` / `redoStack`（最大 50 步）
- 每次变更通过 `pushUndo()` 推入快照（JSON 深拷贝）
- `performUndo()` / `performRedo()` 恢复完整编辑器状态
- WSD 变更通过 `cascadeWorldStateChange()` 级联清理引用

#### WebSocket 管理（usePlayStore）

- 单例模式 `wsInstance`（防多连接）
- `forceNew` 参数强制新会话
- 自动重连（指数退避，最大 5 次）
- 待发送消息队列 `pendingMessages`
- 场景数据缓存 `pendingSceneData`

### 5.2 蓝图编辑器（Design 模式）

#### LandmarkCanvas — React Flow v12 蓝图

基于 `@xyflow/react` 构建：
- 4 种连线类型：condition / count / fallback / turnlimit
- 多选拖拽（偏移量实时同步）
- 删除快捷键（单/多选批量）
- 中键平移（自定义 PointerEvent 绕过 React Flow 限制）

#### Inspector — 属性面板

- 属性 Tab：ID、标题、描述、Phase Tag、Max Storylets、结局配置
- 出边 Tab：条件编辑器 + 目标选择 + 兜底/计数/回合限制
- Storylet Pool：按 phase_tag 过滤，内联卡片管理

#### CharactersPanel — 角色编辑器

完整的 LLM prompt 配置：身份描述、性格、背景条目、秘密知识梯度、内心独白模板

#### WorldStatePanel + LibraryPanel

WSD 变量定义（品质/标记/关系）和资源库（动作/表情/物品/地点）的 CRUD

### 5.3 Play 模式（运行时）

三栏布局（Windows 3.1 90s Retro 风格）：
- **左栏**：时钟 + 当前位置 + WorldState（Qualities / Flags / Relationships）
- **中栏**：SceneStage（立绘） + NarrativeBox（对话） + CommandBar（输入）
- **右栏**：GAME LOG + Debug Panel（叙事状态、品质/标记/关系编辑、内心独白、LLM 日志）

**打字机效果**：`useTypewriter` Hook，按字逐步显示最后一条消息的 speech 和 action。

**位置系统**：LocationPanel → 位置列表 → 点击移动 → WebSocket 同步。

---

## 六、数据流说明

### 6.1 Design 模式数据流

```
用户操作 → 组件 → useStore (set) → immer 更新
                                   ↓
                              pushUndo (变更前) → undoStack
                                   ↓
                              isDirty = true
                                   ↓
                   useProjectStore.saveProjectSnapshot()
                                   ↓
                           localStorage 持久化
```

### 6.2 Play 模式数据流（WebSocket）

```
 PlayMode.mount
     ├→ clear state
     ├→ connect(forceNew=true)
     └→ WebSocket 建立连接
              ↓
         后端 ready → set { backendReady: true }
              ↓
         sendInitScene() → { type: 'init_scene', data: {...} }
              ↓
         后端 → 前端: chat / state_update / player_turn
              ↓
         玩家输入 → sendMessage → player_input → 后端
              ↓ (循环)
         LLM 响应 → chat → ... → player_turn
```

### 6.3 位置系统数据流

```
配置: LibraryPanel → useStore.locationLibrary → init_scene
运行时:
  后端 → location_info → LocationPanel 渲染
  玩家点击 → moveToLocation → move_location → 后端处理
  后端 → location_update → 更新玩家位置 + 实体分布
```

---

## 七、开发规范

### 7.1 TypeScript / React

| 项目 | 规范 |
|------|------|
| zustand | v5 + immer middleware；始终使用 selector 模式：`useStore((s) => s.xxx)` |
| React Flow | v12，node data 必须继承 `Record<string, unknown>` |
| StrictMode | 使用 `mountedRef` 防止 React 19 双重挂载 |
| WebSocket | 单例管理，`pendingMessages` 队列防丢 |
| 样式 | TailwindCSS v4 + CSS Variables (90s Retro Theme) |
| UI 风格 | 当前主流用白底（NarrativeBox + CommandBar + RightPanel） |
| 暗色备选 | ChatLog + InputBar + DebugPanel（历史遗留，备选） |

### 7.2 Python

| 项目 | 规范 |
|------|------|
| 异步 | `uvicorn` + `asyncio`；event_loop 管理并发 |
| 类型 | Pydantic BaseModel 用于 schema 校验 |
| 日志 | `core/logging.py` 统一配置 |

---

> **文档维护**：此文档应随项目迭代保持更新。如有新增模块或接口变更，请同步更新对应章节。