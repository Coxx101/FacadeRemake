# FacadeRemake — 系统架构文档

> 最后更新：2026-04-29
> **当前状态**：核心引擎已完整实现（`prototype/facade_remake/`），前端可视化编辑器（Design 模式）与实时游戏界面（Play 模式）均已完成并可正常运行。

---

## 一、设计哲学

### 1.1 核心问题

互动叙事系统面临的根本张力在于**叙事连贯性**与**玩家行动自由度**之间的内在矛盾。传统分支叙事结构通过预先枚举所有可能路径来保证叙事的可控性，但随着分支深度的增加，路径空间的组合爆炸问题导致内容创作成本呈指数级增长，难以构建兼具深度与广度的沉浸式叙事体验。与此相对，纯涌现式（emergent）叙事虽然赋予玩家充分的行动自由，却容易出现叙事失控、情节偏离主线等问题，致使整体故事失去必要的戏剧张力。

本系统的解法：**叙事骨架约束下的多智能体生成式内容**。

### 1.2 两层架构设计原则

```
┌─────────────────────────────────────────────────────────┐
│  叙事骨架层（预设计 · 只读）                              │
│  Landmark DAG + Storylet 池                              │
│  · 叙事设计师预定义剧情走向与关键节点                    │
│  · 通过阶段标签、条件规则、转场逻辑控制叙事空间边界      │
│  · 运行时保持只读，LLM 无法修改叙事骨架                  │
├─────────────────────────────────────────────────────────┤
│  内容生成层（运行时 · LLM 驱动）                         │
│  InputParser + DirectorAgent + CharacterAgent × N        │
│  · 多智能体协作控制每一轮对话的具体内容                  │
│  · 骨架提供约束边界，Agent 在约束内自由发挥              │
│  · 玩家以自然语言交互，不受预设选项限制                  │
└─────────────────────────────────────────────────────────┘
```

**核心设计原则：骨架管"发生什么"，Agent 管"怎么发生"。**

叙事骨架层确保叙事不会偏离预设轨道——无论玩家如何行动，故事都将经过预先设定的关键戏剧节点。内容生成层确保每次游玩体验的独特性——相同的叙事骨架，不同玩家所经历的具体对话完全不同。

### 1.3 多智能体协作模型

本系统的内容生成由三类 Agent 协作完成，每类 Agent 具有明确的职责边界：

| Agent              | 职责     | 输入                                | 输出                    |
| ------------------ | -------- | ----------------------------------- | ----------------------- |
| **InputParser**    | 输入守门 | 玩家自然语言输入                    | 合法性判定 + 语义条件匹配 |
| **DirectorAgent**  | 叙事导演 | 当前 Storylet + 世界状态 + 对话历史 | BeatPlan + 角色指导指令  |
| **CharacterAgent** | 角色扮演 | 角色档案 + 导演指令 + 对话历史       | 台词 + 内心独白 + 动作序列 |

协作流程：**InputParser 守门** → **DirectorAgent 规划** → **CharacterAgent 表演**。三类 Agent 各自独立调用 LLM，职责互不越界。

### 1.4 关键设计决策

- **不在 InputParser 做结构化意图分类**：DirectorAgent 与 CharacterAgent 自行理解玩家原文，避免结构化输出层的信息损失
- **Director 只给指导，不给台词**：DirectorAgent 决定情绪基调与叙事意图，而非直接生成具体台词
- **角色心口不一**：CharacterAgent 通过三步生成（内心独白 → 行为选择 → 台词/动作）实现内心想法与外显行为的分离
- **语义条件合并判断**：InputParser.analyze() 将多个 llm_trigger 条件合并为单次 LLM 调用，显著降低 API 开销

---

## 二、系统总体架构

### 2.1 分层架构全貌

```
┌─────────────────────────────────────────────────────────────────┐
│                   前端交互层 (React + TypeScript)                 │
│  ┌─────────────────────────┐  ┌──────────────────────────────┐  │
│  │      Design 模式         │  │          Play 模式            │  │
│  │  LandmarkCanvas (DAG)   │  │  ChatLog + InputBar          │  │
│  │  Inspector (属性编辑)    │  │  DebugPanel (状态调试)       │  │
│  │  Zustand (useProjectStore)│ │  Zustand (usePlayStore)      │  │
│  └─────────────────────────┘  └──────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────┘
                               │  WebSocket JSON (全双工)
                               │  ws://localhost:8000/ws/play
┌──────────────────────────────▼──────────────────────────────────┐
│               后端通信层 (FastAPI + uvicorn)                      │
│               ws_server.py  /ws/play  /api/health                │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                  游戏会话层 (GameSession)                         │
│  管理单次 WebSocket 连接的完整游戏会话生命周期                    │
│  协调各核心模块间的数据流转与异步 LLM 调用                        │
├────────────────────┬─────────────────────┬───────────────────────┤
│   叙事骨架层(只读)  │    内容生成层(运行时) │    状态管理层          │
│                    │                     │                       │
│  LandmarkManager   │  InputParser        │  WorldState           │
│  StoryletManager   │  DirectorAgent      │   - Qualities         │
│  StorySelector     │  CharacterAgent × N │   - Flags             │
│                    │  LLMClient          │   - Relationships     │
│  [DAG · 预设计]    │  [LLM驱动 · 多Agent] │  StateManager         │
└────────────────────┴─────────────────────┴───────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│              叙事推进引擎 (CLI 模式专用)                           │
│  GameEngine + GameEventLoop                                      │
│  三轨并发：player_input_loop / narrative_push_loop / event_consumer│
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 运行时数据流（完整交互回合）

```
玩家自然语言输入
        │
        ▼
┌─────────────────────────────────────┐
│  InputParser.analyze()              │
│  · 规则层：meta检测 / 物理违规过滤  │
│  · LLM层：语义合法性判断            │
│  · 语义条件匹配（批量一次调用）     │
│  输出: valid + matched_semantic_ids │
└──────────────┬──────────────────────┘
               │
       ┌───────┴───────┐
       │ hard/soft     │  valid
       │ 拒绝          │
       ▼               ▼
  忽略/困惑反应   ┌──────────────────────┐
                 │   StorySelector       │
                 │  · 标签过滤           │
                 │  · 条件过滤           │
                 │  · llm_trigger 匹配   │
                 │  · Salience 评分排序  │
                 └──────────┬───────────┘
                            │  选出 Storylet
                            ▼
                 ┌──────────────────────┐
                 │   DirectorAgent       │
                 │  · generate_beat_plan │
                 │  · GoalTracker        │
                 │  · InstructionGenerator│
                 │  输出: BeatPlan序列   │
                 └──────────┬───────────┘
                            │  逐 Beat 执行
                            ▼
                 ┌──────────────────────┐
                 │  CharacterAgent × N   │
                 │  Step0: 内心独白      │
                 │  StepA: 行为选择      │
                 │  StepB: 台词/动作生成 │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │   后处理              │
                 │  · 执行 Effects       │
                 │  · 检查 Landmark 推进 │
                 │  · 更新 WorldState   │
                 │  · 推送 state_update  │
                 └──────────────────────┘
                            │
                            ▼
                       输出给玩家（WebSocket / CLI）
```

---

## 三、叙事骨架层（Narrative Skeleton Layer）

叙事骨架层是系统的核心基础设施，负责维护故事的高层结构约束。该层在运行时保持只读状态，确保叙事始终沿预设的戏剧性弧线推进。

### 3.1 Landmark（叙事阶段节点）

Landmark 是剧情的阶段级锚点，以**有向无环图（DAG）**结构组织，定义故事的高层走向与关键转折点。每个 Landmark 代表一个叙事阶段，控制该阶段内可用的 Storylet 范围与信息揭露边界。

**关键属性：**

| 属性                          | 说明                                             |
| ----------------------------- | ------------------------------------------------ |
| `id`                          | 唯一标识，格式 `lm_x_xxx`                        |
| `title`                       | 阶段名称                                         |
| `phase_tag`                   | 阶段标签（act1/act2/act3/act4）                  |
| `transitions`                 | 出边列表，声明推进到后续阶段的条件规则            |
| `narrative_constraints`       | 叙事约束：`allowed_storylet_tags` / `forbidden_reveals` |
| `world_state_effects_on_enter`| 进入该阶段时自动触发的世界状态变更                |
| `fallback_storylet`           | 无候选 Storylet 时的兜底方案                     |
| `is_ending`                   | 是否为结局节点（统一建模，无需独立结局处理逻辑）  |
| `ending_content`              | 结局节点的叙事文本                               |

**转场条件（OR 语义，任一满足即推进）：**

```
1. world_state 条件：指定 flag/quality 组合（AND 语义）
2. or_turn_limit：回合数达到上限（防卡死兜底）
3. or_player_input：玩家输入关键词精确匹配
4. llm_semantic：玩家输入语义匹配（由 InputParser.analyze() 统一判断）
```

**Facade 剧情 Landmark DAG（当前内置场景）：**

```
lm_1_arrive（做客·初见）
     │
     ▼
lm_2_cracks（关系裂缝）
     │
     ├──→ lm_3a_trip（Trip 坦白路线）  ← 玩家追问 Trip 触发
     │
     └──→ lm_3b_grace（Grace 揭露路线）← 玩家私下问 Grace 触发
               │
               ▼
          lm_4_resolve（摊牌与抉择）
               │
               ├──→ lm_5a_reconciliation（和解结局）
               │
               └──→ lm_5b_breakup（破裂结局）
```

### 3.2 Storylet（叙事片段单元）

Storylet 是最小可执行的叙事单元，通常持续 3～8 轮对话，提供一个具体叙事目标。它既是内容调度的基本单位，也是世界状态变更的触发载体。

**与 Landmark 的关系：**
- Landmark 定义"当前阶段允许哪类叙事内容"（通过标签约束）
- Storylet 是该阶段内具体可执行的叙事事件
- 每个 Landmark 配备 2～5 个专用 Storylet + 1 个通用兜底

**关键字段分类：**

| 类别   | 字段                                         | 说明                              |
| ------ | -------------------------------------------- | --------------------------------- |
| 身份   | id, title, phase_tags, narrative_goal        | 基本描述与叙事目标                |
| 前置   | conditions, llm_trigger                      | 结构性触发条件 + 语义触发描述     |
| 内容   | director_note, tone, character_focus         | 导演注释与情绪基调                |
| 后置   | effects, conditional_effects                 | 世界状态变更效果                  |
| 调度   | salience, repeatability, sticky, cooldown    | 选择优先级与重复策略              |
| 结束   | completion_trigger, force_wrap_up            | 自然/强制结束条件                 |

### 3.3 StorySelector（场景选择器）

StorySelector 负责在每个交互回合中从候选 Storylet 集合中选出最适合当前叙事情境的场景执行，采用**三层过滤 + Salience 评分**策略：

```
所有 Storylet
     │
     ├── Step 1: 标签过滤 ── current_landmark.allowed_storylet_tags
     │
     ├── Step 2: 条件过滤 ── storylet.can_trigger()（flag/quality/cooldown）
     │              + llm_trigger 必须出现在 matched_semantic_ids 中
     │
     ├── Step 3: Salience 评分 ── base + modifiers（世界状态驱动）
     │              + priority_override（优先级覆盖，用于关键剧情点）
     │
     ├── Step 4: LLM 评估（可选，当前默认关闭 use_llm_evaluator=False）
     │              取 Top-3 交由 LLM 二次评估选最优
     │
     └── 无候选时：使用 current_landmark.fallback_storylet
```

### 3.4 WorldState（世界状态）

WorldState 是系统的**共享叙事黑板（Narrative Blackboard）**，所有 Agent 的条件判断、效果触发均基于此进行。

| 状态类型       | 示例                          | 说明                                |
| -------------- | ----------------------------- | ----------------------------------- |
| Qualities      | `tension`, `grace_trust`      | 数值型状态，支持比较与累加操作      |
| Flags          | `arrived`, `trip_confessed`   | 布尔型标记，记录关键叙事事件是否发生 |
| Relationships  | `trip_to_player`, `grace_to_player` | 角色间关系数值                |

**更新来源：**Storylet effects（场景切换时触发）、conditional_effects（条件满足时触发）、Landmark 进入效果（阶段推进时触发）、Beat delta（逐节拍增量更新，CLI 模式）。

---

## 四、内容生成层（Content Generation Layer）

内容生成层采用多智能体协作架构，模拟戏剧制作中的导演与演员关系，实现叙事规划与角色扮演的职责分离。

### 4.1 InputParser — 输入守门人

**文件：** `prototype/facade_remake/agents/input_parser.py`

InputParser 是玩家输入进入系统的统一入口，承担两大核心职责：

#### 职责一：合法性检查（`validate_input()`）

```
玩家输入
     │
     ▼
第一层：规则层（零 LLM 成本）
     ├── Meta 输入（"你是AI/游戏"） → soft reject, response_mode=deflect
     ├── 物理违规（砸/打/跳窗）      → hard reject, response_mode=ignore
     └── 超长输入（>200字符）        → soft reject, response_mode=confused
     │ 规则层无法判断时
     ▼
第二层：LLM 语义判断
     └── 场景约束 + 当前语境 → valid / severity / reason
```

**分发策略：**

| 结果         | severity | 系统行为                              |
| ------------ | -------- | ------------------------------------- |
| hard reject  | hard     | 忽略输入，不生成角色响应              |
| soft reject  | soft     | 角色困惑反应（注入 Director 特殊指令）|
| valid        | —        | 进入正常处理流程                      |

#### 职责二：语义条件匹配（`analyze()`）

将当前 Landmark 范围内的所有 Storylet `llm_trigger` 与 Landmark 转场的 `llm_semantic` 条件**合并为单次 LLM 调用**，同时完成合法性检查与条件匹配：

```
InputParser.analyze(player_input, conditions, context)
     │
     ├── conditions 为空 → 仅执行合法性检查
     │
     ├── 规则层 hard reject → 直接返回，不执行条件匹配
     │
     └── LLM 统一判断：
         ├── 任务1：输入是否合法？
         └── 任务2：匹配哪些语义条件？→ matched_semantic_ids
```

**条件剪枝策略：** 只收集当前 Landmark 范围内的语义条件（2～15 条），避免全量语义检索的计算开销。

**SemanticConditionStore：** 条件索引接口，当前以全量列表实现，`search()` 接口预留向量检索扩展能力，上层代码无需改动。

### 4.2 DirectorAgent — 叙事导演

**文件：** `prototype/facade_remake/agents/director.py`

DirectorAgent 参考 IBSEN 论文的 Director-Actor 分离架构，但采用**间接控制**而非直接脚本控制：Director 只给出情绪基调与行为方向，不直接生成台词。

#### 内部核心组件

**GoalTracker（目标追踪器）：** 追踪当前 Storylet 的叙事目标进度。每回合调用 `advance_turn()` 更新进度状态（IN_PROGRESS / NEARLY_COMPLETE / COMPLETE / FAILED）。当目标干预次数 ≥ 3 次时标记 FAILED，触发叙事干预机制。

**InstructionGenerator（指导生成器）：** 基于当前 Storylet 内容、世界状态与对话历史，生成 `DirectorInstruction` 对象，包含叙事节奏（push/maintain/release/accelerate）、情绪基调指导、角色特定指令与禁忌话题列表。

**DirectorAgent（协调器）：** 提供两种工作模式：
- **LLM 模式**（`use_llm=True`）：调用 LLM 生成精细化导演指导
- **规则模式**（`use_llm=False`）：纯规则生成，零 API 消耗

#### BeatPlan 生成

DirectorAgent 在场景切换或玩家输入后调用 `generate_beat_plan()`，生成当前叙事节拍序列。每个 Beat 包含：

| 字段               | 说明                              |
| ------------------ | --------------------------------- |
| `speaker`          | 发言者（trip/grace/narrator/player_turn） |
| `addressee`        | 接收者（player/grace/trip/all）   |
| `intent`           | 叙事意图描述                      |
| `urgency`          | 紧迫程度（high/medium/low）       |
| `world_state_delta`| 预测的世界状态变化                |
| `state_change_hint`| 状态变化提示（用于 CLI 显示）     |

#### 发言决策（`decide_speakers()`）

采用 DRAMA LLAMA 风格的动态发言角色决策，五级优先规则：
1. **玩家点名** → 被点名角色必须回应
2. **对话平衡** → 最近 8 条历史中发言差值 > 2 时触发平衡干预
3. **叙事目标** → 回应服务于当前 Storylet 的 narrative_goal
4. **自然度** → 通常 1 人回应最自然，2 人需理由
5. **沉默权利** → 非发言角色可仅做肢体动作

### 4.3 CharacterAgent — 角色扮演者

**文件：** `prototype/facade_remake/agents/character_agent.py`

每个角色（Trip、Grace）拥有独立的 CharacterAgent 实例，实现**三步生成架构**，参考 DRAMA LLAMA + StoryVerse + IBSEN 的设计：

#### Step 0：内心独白（`_generate_inner_thought()`）

- **目的：** 让角色先构建内心想法，支持心口不一的表现
- **Temperature：** 0.75（保留情感张力）
- **输出：** 1～2 句第一人称内心独白，注入后续步骤作为隐性上下文
- **Monologue 选择：** 扫描玩家输入关键词 → 情绪状态映射 → 选择对应的 IBSEN Monologue 模板；无匹配时 LLM 自动选择

#### Step A：行为选择（`_select_behavior()`）

- **目的：** 从预定义行为库选择一个叙事行为 ID（StoryVerse Action Schema 风格）
- **Temperature：** 0.1（确定性选择）
- **行为库：** 共 15 种行为（deflect/go_quiet/admit/cold_truth 等），Storylet 可通过 `allowed_behaviors` 字段约束可选范围
- **Salience Boost：** 特定行为携带 Salience 加成（admit: +5, cold_truth: +5）

#### Step B：台词/动作生成（主体）

- **Temperature：** 0.6
- **输入构建：** 角色档案 + 秘密知识 + 内心独白（Step 0）+ 行为模式（Step A）+ 导演指令 + IBSEN 结构化对话历史
- **IBSEN 对话历史：** 自身发言映射为 `assistant`，其余所有发言（含玩家）映射为 `user`，以 `__INPUT__` 行标记待回复的玩家输入
- **输出格式：** `{"dialogue": str, "action": str, "thought": str}`

#### IBSEN 式质量防护机制

```
LLM 原始输出
     │
     ├── NG words 检测 → 重试（最多 3 次）+ system 追加提示
     ├── 关键词冲突检测（玩家问A但回B）→ 降温重试（temperature=0.3）
     ├── 重复检测（字符重叠率 > 50%）→ 截断历史重生成
     ├── JSON 格式校验 → 结构重试
     └── 角色名前缀清理（trip:/grace:/特拉维斯: 等）
```

### 4.4 LLMClient — LLM 调用统一接口

**文件：** `prototype/facade_remake/agents/llm_client.py`

封装 OpenAI API 兼容格式的调用逻辑，支持 GPT-4o / GPT-4o-mini / DeepSeek 等多模型服务商。提供：
- `call_llm(prompt, max_tokens, temperature)` — 单轮对话
- `chat_completion(messages)` — 多轮对话
- `on_debug` 回调接口 — WebSocket 模式下实时推送 LLM 调试信息到前端

**异步策略：** LLM 调用为同步阻塞，通过 `asyncio.run_in_executor()` 放入线程池执行，避免阻塞主事件循环。

---

## 五、叙事推进引擎（Narrative Engine，CLI 模式）

叙事推进引擎基于 asyncio 异步事件循环实现，是命令行模式下的核心调度中心，协调三条并发执行轨道。

### 5.1 GameEngine — 核心业务引擎

**文件：** `prototype/facade_remake/engine/game_engine.py`

GameEngine 封装所有游戏核心业务逻辑，通过 DIContainer 依赖注入容器统一管理各模块实例，消除循环依赖：

- **`handle_player_input()`：** 处理玩家输入，流程为：输入验证 → 状态计数更新 → Beat delta 计算 → 调解行为检测 → 转场检查 → BeatPlan 刷新
- **`handle_player_silence()`：** 处理玩家沉默，与输入处理流程类似，但跳过合法性检查
- **`handle_auto_beat()`：** 执行当前 Beat，调用 CharacterAgent 生成响应，更新 beat_index
- **`_switch_to_storylet()`：** 场景切换，应用效果、重置计数、刷新 BeatPlan、触发过渡 Beat
- **`_check_and_handle_transitions()`：** 检查 Landmark/Storylet 转场条件，触发阶段推进

**Beat Delta 双轨机制：**
- **Storylet 级效果**：场景切换时一次性应用（`=` 操作，设定状态值）
- **Beat 级增量**：每次 Beat 执行后累积计算（基于 effect_trends + player_input 上下文）

### 5.2 GameEventLoop — 异步事件循环

**文件：** `prototype/facade_remake/engine/event_loop.py`

GameEventLoop 封装所有 asyncio 逻辑，通过 `asyncio.gather()` 并行运行三条协程：

```
asyncio.gather(
    _player_input_loop(),     // 输入轨道
    _narrative_push_loop(),   // 叙事推进轨道
    _event_consumer(),        // 事件消费轨道
)
```

| 协程                    | 职责                                                        |
| ----------------------- | ----------------------------------------------------------- |
| `_player_input_loop()`  | 从线程池异步读取玩家输入，支持 quit/status 命令，投递事件队列 |
| `_narrative_push_loop()`| 按 BeatPlan 序列自动推进，处理 player_turn 超时（45秒后催促，再30秒后视为沉默）|
| `_event_consumer()`     | 消费事件队列，将 player_input/player_silence/auto_beat 事件分发给 GameEngine |

**同步机制：** 通过 `beat_done_event`（asyncio.Event）实现叙事推进轨道与事件消费轨道的 Beat 完成同步。

---

## 六、状态与数据管理层（State Management Layer）

### 6.1 WorldState — 世界状态容器

**文件：** `prototype/facade_remake/core/world_state.py`

WorldState 以 Python dataclass 管理三类状态变量，提供统一读写接口：

```python
# 状态读写接口
get_quality(key) / set_quality(key, value)
get_flag(key)   / set_flag(key, value)
get_relationship(key) / set_relationship(key, value)

# 效果应用（支持 = / + / - / max / min 操作符）
apply_effect(effect: Dict)

# 条件检查（支持 == / != / > / < / >= / <= 比较）
check_condition(condition: Dict) → bool

# 观察者模式
add_change_listener(listener: Callable)

# 序列化
to_dict() → Dict
```

**compute_beat_delta()：** 根据当前 Storylet 的 effect_trends 和玩家行为上下文动态计算即时状态增量，支持玩家缓解行为触发逆趋势调整，增强叙事动态响应能力。

### 6.2 StateManager — 事务性状态管理器

**文件：** `prototype/facade_remake/core/state_manager.py`

在 WorldState 基础上增加：
- **事务支持：** 原子性状态更新与回滚能力
- **变更通知：** `_change_listeners` 集合自动触发所有已注册的监听器
- **历史记录：** `_snapshots` 列表支持状态回溯与调试

### 6.3 DIContainer — 依赖注入容器

**文件：** `prototype/facade_remake/core/di_container.py`

统一管理所有模块实例，采用**惰性初始化**模式（Property + lazy init），确保依赖关系的正确解析顺序，消除模块间的直接耦合。提供 `init_world_state()` 与 `load_data()` 方法从 ScenarioConfig 完成初始化。

---

## 七、WebSocket 通信层（ws_server.py）

### 7.1 服务架构

```
前端 (React)  ←── WebSocket ──→  FastAPI (ws_server.py)
                                         │
                                         └── GameSession（每连接一个实例）
                                             ├── WorldState
                                             ├── StoryletManager
                                             ├── LandmarkManager
                                             ├── StorySelector
                                             ├── DirectorAgent
                                             ├── InputParser
                                             ├── SemanticConditionStore
                                             ├── CharacterAgent × 2（trip/grace）
                                             └── LLMClient
```

**端点：**
- `/ws/play`：主游戏 WebSocket 通信通道
- `/api/health`：REST 健康检查端点

### 7.2 通信协议（前后端 JSON 消息）

#### 前端 → 后端

| 消息类型          | 触发时机             | 核心数据                                          |
| ----------------- | -------------------- | ------------------------------------------------- |
| `init_scene`      | 进入 Play 模式时     | `{landmarks, storylets, characters, world_state_definition}` |
| `player_input`    | 玩家发送消息         | `{text: "玩家输入文本"}`                          |
| `debug_worldstate`| Debug 面板修改状态   | `{qualities, flags, relationships}`               |
| `reset`           | 点击重置按钮         | —                                                 |

#### 后端 → 前端

| 消息类型           | 说明                 | 核心数据                                           |
| ------------------ | -------------------- | -------------------------------------------------- |
| `chat`(role=player)| 玩家消息回显         | `{speech}`                                         |
| `chat`(role=trip/grace) | 角色响应        | `{speaker_name, speech, action, thought}`          |
| `chat`(role=narrator) | 旁白             | `{speech}`                                         |
| `chat`(role=system) | 系统提示           | `{speech}`                                         |
| `state_update`     | 完整状态快照         | `{world_state, current_landmark_id, current_landmark, current_storylet_id, current_storylet, turn, game_ended}` |
| `llm_debug`        | LLM 调试信息         | `{event, data: {model, messages, content, ...}}`   |
| `error`            | 错误信息             | `{message}`                                        |

### 7.3 会话生命周期

```
[WebSocket 连接建立]
     │
     ├─ init_scene → 创建 GameSession + 初始化所有子模块
     │   ├── 初始化 WorldState（qualities/flags/relationships）
     │   ├── 加载 Landmarks + Storylets
     │   ├── 初始化 CharacterAgent（角色配置由前端下发）
     │   ├── 初始化 DirectorAgent
     │   ├── 选择初始 Storylet + 应用 Effects
     │   └── 推送 state_update + 开场消息
     │
     ├─ player_input → process_turn()
     │   ├── InputParser.analyze()（合法性检查 + 语义匹配）
     │   ├── StorySelector 选/切换 Storylet
     │   ├── DirectorAgent.generate_beat_plan()
     │   ├── CharacterAgent × N 生成响应（线程池异步执行）
     │   ├── LandmarkManager.check_progression()
     │   └── 推送所有消息 + state_update
     │
     ├─ debug_worldstate → apply_debug_worldstate()
     ├─ reset → 清空 GameSession 状态
     └─ [WebSocket 断开]
```

---

## 八、前端交互层（Frontend Layer）

### 8.1 技术栈

| 模块          | 技术选型                              |
| ------------- | ------------------------------------- |
| UI 框架       | React 18 + TypeScript                 |
| 构建工具      | Vite 5.4                              |
| 样式          | Tailwind CSS v4                       |
| 状态管理      | Zustand + Immer                       |
| DAG 编辑器    | React Flow                            |
| 实时通信      | WebSocket（原生浏览器 API）            |

### 8.2 两大工作模式

#### Design 模式（叙事内容可视化编辑）

```
App
├── Toolbar（工具栏：保存/加载/模式切换）
├── LandmarkCanvas（React Flow DAG 画布）
│   ├── LandmarkNode（自定义节点：颜色区分阶段/结局）
│   └── TransitionEdge（自定义边：动画区分转场类型）
└── Inspector（右侧属性面板）
    ├── StoryletPool（场景池管理）
    ├── CharactersPanel（角色配置：档案/秘密/独白/行为）
    └── WorldStatePanel（世界状态变量定义）
```

**状态管理：** `useProjectStore`（Zustand）管理项目级数据（Landmark/Storylet/Character），支持撤销/重做（最多 50 步历史）。

#### Play 模式（沉浸式游戏体验）

```
PlayMode
├── ChatLog（对话历史流：自动滚动/新消息高亮/thought 折叠）
├── InputBar（玩家输入框：空输入识别为沉默）
└── DebugPanel（调试面板）
    ├── 世界状态实时查看与修改
    ├── 当前 Landmark/Storylet 信息
    └── LLM 调试日志（请求/响应详情，最多 200 条）
```

**状态管理：** `usePlayStore`（Zustand + Immer）管理游戏会话数据，支持：
- 回退（Rollback）：快照栈（最多 30 步），恢复到上一回合状态
- 乐观更新：玩家发送消息后立即本地显示，无需等待后端响应
- WebSocket 单例：连接断开后自动 3 秒重连

### 8.3 前后端数据同步

`useProjectStore` 中的编辑器数据（Landmarks/Storylets/Characters/WorldStateDefinition）通过 `sendInitScene()` 序列化后经 WebSocket 下发至后端，后端 GameSession 据此完成初始化。Play 模式中的实时状态（WorldState / LandmarkId / StoryletId）由后端通过 `state_update` 消息主动推送，前端被动同步。

---

## 九、架构层级总览（四层叙事控制粒度）

```
┌────────────────────────────────────────────────────────┐
│  Layer 1: Landmark 层（剧情阶段级）                     │
│  · 4个阶段：lm_1→lm_2→lm_3a/3b→lm_4→lm_5a/5b（含结局）│
│  · 控制允许哪些 Storylet 标签进入候选池                  │
│  · 控制禁止 LLM 提及的叙事信息（forbidden_reveals）     │
│  · 转场条件：世界状态 OR 回合限制 OR 输入关键词 OR 语义  │
├────────────────────────────────────────────────────────┤
│  Layer 2: Storylet 层（场景片段级，3-8轮对话）           │
│  · 多个专用 Storylet + 1个兜底                          │
│  · 三层过滤：标签→条件→Salience评分                     │
│  · llm_trigger 语义条件由 InputParser 统一批量判断      │
│  · allowed_behaviors 约束角色可执行的行为范围            │
├────────────────────────────────────────────────────────┤
│  Layer 3: CharacterAgent 层（台词/动作级）              │
│  · BeatPlan 驱动：Director 规划，Character 执行         │
│  · 三步生成：内心独白(0.75) → 行为选择(0.1) → 台词(0.6)│
│  · IBSEN 式质量防护：NG重试 + 重复检测 + JSON校验       │
│  · 心口不一（thought ≠ speech）                        │
├────────────────────────────────────────────────────────┤
│  Layer 4: InputParser 层（语义理解级）                   │
│  · 合法性检查：规则过滤 + LLM语义判断（meta/暴力/语境）  │
│  · 语义条件匹配：Storylet llm_trigger + Landmark llm_semantic│
│  · analyze() 单次 LLM 调用完成合法性 + 条件匹配两项任务  │
│  · SemanticConditionStore 预留向量检索扩展接口           │
└────────────────────────────────────────────────────────┘
```

---

## 十、技术栈总览

| 模块           | 技术方案                          | 文件位置                                |
| -------------- | --------------------------------- | --------------------------------------- |
| 世界状态容器   | Python dataclass + 观察者模式     | `core/world_state.py`                   |
| 状态管理器     | 事务性 StateManager               | `core/state_manager.py`                 |
| Landmark 管理  | DAG 结构 + LandmarkManager        | `core/landmark.py`                      |
| Storylet 管理  | 数据结构 + StoryletManager        | `core/storylet.py`                      |
| 场景选择器     | 三层过滤 + Salience 评分          | `agents/story_selector.py`              |
| 输入解析       | 规则层 + LLM语义判断 + 条件索引   | `agents/input_parser.py`                |
| 叙事导演       | GoalTracker + InstructionGenerator| `agents/director.py`                    |
| 角色扮演       | 三步生成 + IBSEN防护机制          | `agents/character_agent.py`             |
| LLM 调用       | OpenAI API 兼容格式               | `agents/llm_client.py`                  |
| 游戏引擎       | DIContainer + 业务逻辑封装        | `engine/game_engine.py`                 |
| 异步事件循环   | asyncio 三轨并发                  | `engine/event_loop.py`                  |
| WebSocket 服务 | FastAPI + uvicorn                 | `prototype/ws_server.py`                |
| 前端框架       | React 18 + TypeScript + Vite 5.4  | `frontend/src/`                         |
| 状态管理（前端）| Zustand + Immer                  | `frontend/src/store/`                   |
| DAG 编辑器     | React Flow                        | `frontend/src/components/canvas/`       |

---

## 十一、与相关工作的架构对应

| 本研究              | DRAMA LLAMA     | IBSEN           | StoryVerse          | Dramamancer  |
| ------------------- | --------------- | --------------- | ------------------- | ------------ |
| InputParser         | 自然语言前置条件 | —               | —                   | —            |
| DirectorAgent       | —               | Director        | Act Director        | —            |
| CharacterAgent      | Speaker 自决    | Actor           | Character Simulator | —            |
| Landmark            | —               | —               | Abstract Acts       | —            |
| Storylet            | Storylet        | —               | Narrative Plan      | Storylet     |
| 三步生成            | —               | Monologue       | —                   | —            |
| Salience 选择       | Salience        | —               | —                   | Time fallback|
| BeatPlan            | —               | Beat Dependency | Narrative Plan      | Beat         |
| NG words 重试       | —               | NG retry        | —                   | —            |

---

*文档版本：v2.0 | 最后更新：2026-04-29 | 状态：与实际代码库同步（engine/ + ws_server.py）*
