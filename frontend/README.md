# FacadeRemake Frontend

FacadeRemake 互动叙事系统的可视化编辑与游玩前端，提供叙事蓝图编辑（Design 模式）与实时互动体验（Play 模式），通过 WebSocket 与 Python 后端通信。

## 模式概览

应用包含三种模式，通过顶部工具栏切换：

- **Home**：项目管理界面，支持新建、导入、编辑、游玩、删除项目，基于 localStorage 持久化
- **Design**：叙事蓝图编辑器，以 React Flow 画布可视化编辑 Landmark DAG、Storylet 池、角色设定、世界状态定义
- **Play**：互动游玩界面，通过 WebSocket 连接后端引擎，实时对话、查看世界状态、回溯历史

## 技术栈

| 类别 | 技术 |
|------|------|
| 构建工具 | Vite 5.4 |
| 界面框架 | React 18 + TypeScript 6 |
| 样式方案 | Tailwind CSS v4（@tailwindcss/vite 插件） |
| 可视化编辑 | @xyflow/react（React Flow）节点画布 |
| 状态管理 | Zustand 5 + immer（不可变更新） |
| 图标系统 | Lucide React |
| 通信协议 | WebSocket（自研消息协议） |

## 启动方式

```bash
cd frontend
npm install
npm run dev -- --port 5173
```

需先启动后端 WebSocket 服务（`prototype/ws_server.py`），前端 Play 模式依赖后端通信。

## 目录结构

```
frontend/src/
├── main.tsx                      # 应用入口
├── App.tsx                       # 根组件（模式路由 + DesignMode 布局）
├── types.ts                      # 核心类型定义（与后端数据结构对应）
├── components/
│   ├── StartScreen.tsx           # Home 模式：项目卡片网格
│   ├── Toolbar.tsx               # 全局工具栏（模式切换 / 项目操作）
│   ├── canvas/
│   │   ├── LandmarkCanvas.tsx    # React Flow 画布（拖拽/连线/缩放）
│   │   ├── LandmarkNode.tsx      # 自定义 Landmark 节点渲染
│   │   └── TransitionEdge.tsx    # 自定义 DAG 转换边渲染
│   ├── inspector/
│   │   ├── Inspector.tsx         # 右侧属性面板（可伸缩宽度）
│   │   ├── StoryletPool.tsx      # Storylet 池列表
│   │   └── TransitionsTab.tsx    # Landmark 转换编辑面板
│   ├── modal/
│   │   └── StoryletModal.tsx     # Storylet 编辑弹窗（90s Windows 风格）
│   ├── characters/
│   │   └── CharactersPanel.tsx   # 角色设定编辑面板
│   ├── worldstate/
│   │   └── WorldStatePanel.tsx   # 世界状态定义编辑器
│   ├── library/
│   │   └── LibraryPanel.tsx      # 元素库（动作/表情/道具/地点）
│   ├── shared/
│   │   ├── ImageUpload.tsx       # 图片上传组件
│   │   └── KeyInput.tsx          # 键盘输入组件
│   └── play/
│       ├── PlayMode.tsx          # Play 模式主布局（三栏）
│       ├── LeftPanel.tsx         # 左侧叙事面板
│       ├── SceneStage.tsx        # 场景舞台（角色立绘/地点背景）
│       ├── NarrativeBox.tsx      # 叙事框（角色对话气泡）
│       ├── ChatLog.tsx           # 对话日志（打字机效果/自动滚底）
│       ├── InputBar.tsx          # 玩家输入栏
│       ├── CommandBar.tsx        # 指令栏（回退/重置/LLM模式切换）
│       ├── DebugPanel.tsx        # 调试面板（WorldState 实时双向同步）
│       ├── RightPanel.tsx        # 右侧面板容器
│       └── LocationPanel.tsx     # 位置信息面板
├── store/
│   ├── useStore.ts               # Design 模式主 Store（Zustand + immer）
│   ├── usePlayStore.ts           # Play 模式 Store（WebSocket 通信逻辑）
│   ├── useProjectStore.ts        # 项目管理 Store（localStorage 持久化）
│   └── cascadeWorldState.ts      # WorldState 联动更新逻辑
└── data/
    └── defaults.ts               # 默认场景模板数据
```

## Design 模式功能

Design 模式以 90s Windows 复古 UI 风格呈现，使用 MS Sans Serif 字体与灰白配色方案。右侧面板支持四种视图切换：Inspector（属性编辑）、Characters（角色设定）、WorldState（世界状态定义）、Library（元素库）。

核心功能：
- **Landmark DAG 编辑**：React Flow 画布支持节点拖拽/创建/删除、转换边连线、条件编辑，节点位置实时同步到 JSON 导出
- **Storylet 编辑**：弹窗式编辑器，支持标题、内容、前置条件、后置效果、调度策略、Salience 评分配置
- **角色编辑**：CharactersPanel 支持角色身份、性格、秘密知识与独白模板编辑
- **撤销/重做**：基于快照栈，支持 50 步历史
- **JSON 导入/导出**：支持保存为 JSON 文件、从 JSON 文件恢复、导出 Unity 兼容格式
- **数据解耦**：Design 模式下编辑的配置动态流转至 Play 模式，无需手动同步

## Play 模式功能

Play 模式以亮色主题呈现，三栏布局（左侧叙事面板、中央舞台、右侧调试面板）。

核心功能：
- **实时对话**：WebSocket 连接后端引擎，每次玩家输入触发完整叙事循环（InputParser → Director BeatPlan → CharacterAgent 回应）
- **打字机效果**：角色对话以逐字动画呈现
- **LLM/Mock 切换**：通过 CommandBar 按钮在真实 LLM 调用与 Mock 预设响应之间切换
- **Debug 面板**：实时展示 WorldState 完整状态（qualities / flags / relationships），修改后推送后端并触发 Storylet/Landmark 重新评估
- **对话回退**：基于快照的对话历史回退，支持恢复到之前的叙事状态
- **自动滚底**：新消息到达时自动滚动到对话底部
- **角色立绘与位置**：SceneStage 展示角色立绘，LocationPanel 显示当前位置信息

## WebSocket 消息协议

前端与后端通过自研消息协议通信，消息类型包括：

| 消息类型 | 方向 | 说明 |
|----------|------|------|
| `init_scene` | 前端→后端 | 场景初始化（传入场景配置） |
| `player_input` | 前端→后端 | 玩家输入文本 |
| `chat` | 后端→前端 | 角色对话（speech / action / thought） |
| `state_snapshot` | 后端→前端 | 完整 WorldState 快照 |
| `scene_loaded` | 后端→前端 | 场景加载完成通知 |
| `game_ended` | 后端→前端 | 游戏结束通知 |
| `debug_set_state` | 前端→后端 | Debug 面板手动修改状态后推送 |
| `debug_state_result` | 后端→前端 | 状态修改后 Storylet/Landmark 重新评估结果 |
| `request_game_log` | 前端→后端 | 请求游戏日志 |
| `game_log` | 后端→前端 | 游戏日志数据 |

## 与后端的数据对应

前端类型定义（`types.ts`）与 Python 后端数据结构保持一一对应：Landmark、LandmarkTransition、Storylet、WorldStateEffect、Condition、Salience 等核心结构均使用相同的字段命名与语义。Design 模式下编辑的 JSON 配置可直接加载到后端 GameEngine 使用。

## 当前实现状态

- [x] Home 模式项目管理（localStorage 持久化）
- [x] Design 模式 React Flow 画布（Landmark DAG 可视化编辑）
- [x] Storylet 弹窗编辑器（90s Windows 风格）
- [x] 角色设定编辑面板
- [x] 世界状态定义编辑器
- [x] 元素库面板（动作/表情/道具/地点）
- [x] 撤销/重做（50 步历史）
- [x] JSON 导入/导出/Unity 导出
- [x] Play 模式三栏布局
- [x] WebSocket 前后端通信链路
- [x] 对话日志（打字机效果 + 自动滚底）
- [x] Debug 面板 WorldState 双向同步
- [x] LLM/Mock 切换
- [x] 对话回退与重置
- [x] 框架与数据解耦（Design 编辑动态同步至 Play）
