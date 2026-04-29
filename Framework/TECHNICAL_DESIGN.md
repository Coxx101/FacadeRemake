# FacadeRemake 技术设计文档

> 最后更新：2026-04-29
> 本文档是项目的 **source of truth**，修改数据/代码时请同步更新对应章节。

***

## 1. 项目概述

**目标：** 基于叙事骨架约束与多智能体协作机制，复刻并拓展 Facade 原作的互动叙事体验。

**核心架构：** Landmark-Storylet 双层叙事骨架 + DirectorAgent-CharacterAgent 多智能体系统 + 自然语言输入解析层。

**系统运行模式：**

- **CLI 模式：** `main.py` 命令行交互，GameEngine + GameEventLoop（asyncio 三轨并发）
- **WebSocket 模式：** `ws_server.py` 服务端 + React 前端，通过 WebSocket JSON 协议通信

**叙事场景（内置 Dinner Party 场景）：**

- **Trip**（特拉维斯，30岁）和 **Grace**（格蕾丝，30岁）是一对结婚约八年的夫妻
- 双方各有对方未知的秘密——核心戏剧张力来源
- 阶层差异（Grace 富裕 vs Trip 贫困）构成深层矛盾
- **玩家角色：** Trip 和 Grace 的大学老友，受邀来公寓做客

***

## 2. 项目文件结构

```
prototype/
├── ws_server.py                # FastAPI WebSocket 服务器（前后端通信）
├── requirements.txt            # Python 依赖
├── .env.local                  # 环境变量（OPENAI_API_KEY, LLM_MODEL）
│
└── facade_remake/
    ├── main.py                 # CLI 模式入口（独立于 ws_server）
    ├── core/                   # 核心叙事引擎
    │   ├── world_state.py      # 世界状态容器（qualities/flags/relationships）
    │   ├── storylet.py         # Storylet 数据结构 + StoryletManager
    │   ├── landmark.py         # Landmark + LandmarkManager（DAG）
    │   ├── state_manager.py    # 事务性状态管理器（快照/回滚/通知）
    │   ├── di_container.py     # 依赖注入容器（惰性初始化）
    │   └── logging.py          # 分级日志（GameLogger）
    ├── agents/                 # 智能体系统
    │   ├── llm_client.py       # LLMClient（统一 LLM 接口）
    │   ├── director.py         # DirectorAgent（BeatPlan + 导演指导）
    │   ├── character_agent.py  # CharacterAgent（三步生成架构）
    │   ├── input_parser.py     # InputParser + SemanticConditionStore
    │   └── story_selector.py   # StorySelector（三层过滤 + Salience）
    ├── engine/                 # 游戏推进引擎（CLI 模式专用）
    │   ├── game_engine.py      # GameEngine（核心业务逻辑）
    │   ├── event_loop.py       # GameEventLoop（asyncio 三轨并发）
    │   ├── output.py           # 终端输出格式化工具
    │   └── output_parser.py    # 动作序列解析器
    ├── config/
    │   ├── characters.py       # 内置角色配置（CLI 模式）
    │   └── scenario_schema.py  # ScenarioConfig 数据结构定义
    └── data/
        └── builtin_scenarios/
            └── dinner_party.py # 内置 Dinner Party 场景数据

frontend/
└── src/
    ├── App.tsx                 # 路由与模式切换
    ├── components/
    │   ├── canvas/             # Landmark DAG 画布（React Flow）
    │   ├── inspector/          # 属性检查面板
    │   ├── play/               # Play 模式（对话界面 + 调试面板）
    │   ├── characters/         # 角色配置面板
    │   └── worldstate/         # 世界状态定义面板
    ├── store/
    │   ├── useProjectStore.ts  # 设计模式全局状态（Zustand）
    │   ├── usePlayStore.ts     # Play 模式运行时状态（Zustand + WebSocket）
    │   ├── useStore.ts         # 项目级数据访问
    │   └── cascadeWorldState.ts# 级联世界状态工具
    ├── types.ts                # 全局 TypeScript 类型定义
    └── data/defaults.ts        # 默认数据模板
```

***

## 3. 世界状态注册表

### 3.1 数值型状态（Qualities）

| Key                  | 初始值 | 类型    | 说明            | 修改者                          |
| -------------------- | --- | ----- | ------------- | ---------------------------- |
| `tension`            | 0   | float | 婚姻紧张度，驱动叙事节奏  | 多个 Storylet effects          |
| `grace_trust`        | 0   | float | Grace 对玩家的信任度 | Storylet effects             |
| `trip_trust`         | 0   | float | Trip 对玩家的信任度  | Storylet effects             |
| `conversation_turns` | 0   | int   | 对话回合计数        | GameEngine / LandmarkManager |

### 3.2 布尔型标记（Flags）

按叙事阶段分组，遵循**单向写入**原则（只从 False 变为 True，不可逆）：

#### Act 1：做客初见（lm\_1\_arrive）

| Flag             | 初始值   | 设置者                 | 触发条件             | 消费者（检查方）            |
| ---------------- | ----- | ------------------- | ---------------- | ------------------- |
| `arrived`        | False | 初始 Storylet effects | 游戏启动时            | 多个 Act1 Storylet 条件 |
| `drinks_started` | False | Storylet effects    | `arrived=True` 后 | Director 叙事目标判断     |

#### Act 2：关系裂缝（lm\_2\_cracks）

| Flag               | 初始值   | 设置者              | 触发条件         | 消费者                        |
| ------------------ | ----- | ---------------- | ------------ | -------------------------- |
| `renovation_fight` | False | Storylet effects | 装修话题被触发      | `sl_renovation_tension` 条件 |
| `grace_exposed`    | False | Storylet effects | Grace 揭露路线触发 | Landmark lm\_3b 进入条件       |
| `trip_confessed`   | False | Storylet effects | Trip 坦白路线触发  | Landmark lm\_3a 进入条件       |

#### Act 3+：摊牌与结局

| Flag                  | 初始值   | 设置者                         | 触发条件                              | 消费者             |
| --------------------- | ----- | --------------------------- | --------------------------------- | --------------- |
| `secrets_revealed`    | False | Storylet effects            | 双方秘密均被揭露                          | 结局判定 + 玩家调解检测   |
| `player_mediated`     | False | `_check_player_mediation()` | `secrets_revealed=True` 后玩家输入含调解词 | 结局判定（"儿子的角色"结局） |
| `final_decision_made` | False | Storylet effects            | Act4 摊牌完成                         | 结局节点进入条件        |

### 3.3 关系型状态（Relationships）

| Key               | 初始值 | 说明                |
| ----------------- | --- | ----------------- |
| `trip_to_player`  | 0   | Trip 对玩家的态度（负为疏远） |
| `grace_to_player` | 0   | Grace 对玩家的态度      |

***

## 4. 叙事流程设计

### 4.1 Landmark 推进链（主线 DAG）

```
[游戏开始]
     │
     ▼
lm_1_arrive（做客·初见）
     │ 允许标签: act1, arrive
     │ 禁止提及: [trip/grace 的核心秘密内容]
     │ 兜底 Storylet: sl_generic_arrive
     │
     ▼  arrived=True 且 drinks_started=True  /  回合 ≥ N
     │
lm_2_cracks（关系裂缝）
     │ 允许标签: act1, act2, cracks
     │
     ├── [玩家追问 Trip 方向]
     │    llm_semantic 匹配 "lm2→lm3a"
     │    ▼
     │   lm_3a_trip（Trip 坦白路线）
     │    │ 允许标签: act3, trip_route
     │    ▼
     │   trip_confessed=True  /  回合兜底
     │    │
     │    └──→ lm_4_resolve
     │
     └── [玩家私下问 Grace 方向]
          llm_semantic 匹配 "lm2→lm3b"
          ▼
         lm_3b_grace（Grace 揭露路线）
          │ 允许标签: act3, grace_route
          ▼
         grace_exposed=True  /  回合兜底
          │
          └──→ lm_4_resolve

lm_4_resolve（摊牌与抉择）
     │ 允许标签: act4, resolve
     │
     ├── secrets_revealed=True ∧ trip_confessed=True
     │    ▼
     │   lm_5a_reconciliation（和解结局，is_ending=True）
     │
     └── tension >= 阈值 ∨ final_decision_made=True
          ▼
         lm_5b_breakup（破裂结局，is_ending=True）
```

### 4.2 Landmark 转场条件语义

`LandmarkManager.check_progression()` 的转场判定为 **OR 语义**（任一满足即推进）：

```python
# 四种推进条件
1. world_state 条件：{"key": value, ...}（AND 语义：全部 key 满足）
2. or_turn_limit：回合数达到上限（防卡死兜底）
3. or_player_input：玩家输入关键词精确匹配（OR 语义）
4. llm_semantic：InputParser.analyze() 返回的 matched_semantic_ids 中包含对应条件 ID
```

### 4.3 Storylet 调度流程（每回合）

```python
# ws_server.process_turn() / engine.handle_player_input()
1. InputParser.analyze(player_input, semantic_conditions, context)
   → matched_semantic_ids: ["sl_xxx", "lm2→lm3b", ...]

2. StorySelector.select(world_state, turn, matched_semantic_ids)
   → 三层过滤（标签 → 条件 → Salience）
   → 选出 new_storylet

3. if new_storylet != current_storylet:
       → 应用 effects（set flags/qualities）
       → director.set_current_goal(narrative_goal)
       → landmark_manager.increment_storylet_count()
       → 刷新 BeatPlan

4. director.generate_beat_plan(storylet_content, world_state, history)
   → beat_plan: [Beat, Beat, ...]

5. for beat in beat_plan:
       director.generate_instruction_for(speaker)
       character_agent.generate_response(beat, context)

6. landmark_manager.check_progression(world_state, player_input, matched_semantic_ids)
   → 检查是否推进到下一个 Landmark
```

***

## 5. 数据结构契约

### 5.1 Storylet 完整字段规范

```python
{
    "id": str,                        # 唯一标识，格式 sl_xxx
    "title": str,                     # 显示标题
    "phase_tags": [str],              # 阶段标签，用于 Landmark 过滤
    "narrative_goal": str,            # 叙事目标（注入 LLM prompt）
    "conditions": [Condition],        # 触发前置条件（全部满足）
    "llm_trigger": str | None,        # LLM 语义触发描述
                                      # （必须出现在 matched_semantic_ids 中才可进入候选池）
    "content": {
        "type": "llm_prompt",         # 当前固定为 llm_prompt
        "director_note": str,         # 导演指导（注入 DirectorAgent 和 CharacterAgent prompt）
        "tone": str,                  # 情绪基调（映射为 DirectorInstruction.tone_guidance）
        "character_focus": str,       # 已废弃，仅作 fallback（发言决策由 decide_speakers() 统一处理）
        "primary_speaker": str,       # fallback 时的默认发言人
        "allowed_behaviors": list | dict | None,  # 行为白名单（None=全部可用；dict 按角色分组）
        "forbidden_reveals": [str],   # 禁止 LLM 提及的关键词（在 Step B prompt 中注入）
    },
    "effects": [Effect],              # 进入时应用的效果（执行一次）
    "conditional_effects": [CondEffect], # 条件效果（当前未使用）
    "repeatability": "never" | "unlimited" | "cooldown",
    "cooldown": int | None,           # 冷却回合数（cooldown 模式生效）
    "sticky": bool,                   # True = 不会被自动切换，直到达到 force_wrap_up
    "priority_override": int | None,  # Salience 额外加成（关键叙事点使用，如 100）
    "salience": {
        "base": float,                # 基础 Salience 分数
        "modifiers": [{
            "key": str,               # 检查的 quality key
            "threshold": float,       # 阈值
            "bonus": float,           # 达到阈值时加分
            "penalty": float          # 未达到阈值时扣分
        }]
    },
    "on_interrupt": "pause" | "abort" | "continue",
    "completion_trigger": {
        "max_turns": int              # 在此 Storylet 中最多持续的回合数
    },
    "force_wrap_up": {
        "max_turns": int,             # sticky Storylet 的强制结束回合上限
        "conditions": [Condition]     # 满足任一条件时强制结束
    } | None,
    "beat_sequence": dict | None,     # Beat 序列（已实现架构，当前无数据）
    "mix_ins": [dict],                # Beat Mix-in（架构预留）
}
```

### 5.2 Effect 格式规范

```python
# 赋值操作（op="="）：类型由 value 决定
{"key": "arrived", "op": "=", "value": True}          # bool → 存为 flag
{"key": "tension",  "op": "=", "value": 2.0}          # float → 存为 quality
{"key": "phase",    "op": "=", "value": "act2"}        # str → 存为 flag（字符串值）

# 数值算术操作
{"key": "tension", "op": "+",   "value": 1.5}         # 加
{"key": "tension", "op": "-",   "value": 0.5}         # 减
{"key": "tension", "op": "max", "value": 5.0}         # 取大值（clamp 上限）
{"key": "tension", "op": "min", "value": 0.0}         # 取小值（clamp 下限）
```

### 5.3 Condition 格式规范

```python
# Flag 检查
{"type": "flag_check",    "key": "arrived", "op": "==", "value": True}

# Quality 检查
{"type": "quality_check", "key": "tension", "op": ">=", "value": 3.0}

# LLM 语义条件（用于 Landmark 转场）
{"type": "llm_semantic",  "id": "lm2→lm3a",
 "description": "玩家明确追问 Trip 关于婚姻问题"}

# 支持的比较运算符：==  !=  >  <  >=  <=
```

> `llm_semantic` 条件由 `InputParser.analyze()` 统一判断，`id` 字段对应 `SemanticConditionStore` 中注册的条件 ID。

### 5.4 Landmark 字段规范

```python
{
    "id": str,                       # 唯一标识，格式 lm_x_xxx
    "title": str,
    "description": str,
    "phase_tag": str,                # 阶段标签（act1/act2/act3/act4）
    "order": int,                    # 排序序号（用于 DAG 可视化布局参考）
    "entry_conditions": {
        "world_state": [Condition],  # 进入条件（AND 语义）
        "or_player_input": [str]     # 玩家输入关键词（OR 语义）
    },
    "narrative_constraints": {
        "allowed_storylet_tags": [str],  # 允许的 Storylet phase_tags
        "forbidden_reveals": [str]       # 禁止 LLM 提及的关键词
    },
    "transitions": [{                # 出边列表（OR 语义）
        "target_id": str,
        "label": str,                # 边标签（用于 UI 显示）
        "conditions": [Condition],   # 转场条件（包含 world_state / llm_semantic 等）
        "or_turn_limit": int,        # 回合兜底
        "or_player_input": [str],    # 关键词触发
        "is_fallback": bool,         # 是否为兜底转场（无条件，turn 到达即触发）
    }],
    "fallback_storylet": str,        # 无匹配 Storylet 时使用的兜底 ID
    "world_state_effects_on_enter": [Effect],  # 进入时自动执行
    "is_ending": bool,               # 是否为结局节点
    "ending_content": str | None,    # 结局文本（is_ending=True 时使用）
}
```

### 5.5 Beat 数据结构

DirectorAgent 生成的 BeatPlan 中每个 Beat 的结构：

```python
{
    "speaker": "trip" | "grace" | "narrator" | "player_turn",
    "addressee": "player" | "grace" | "trip" | "all",
    "intent": str,              # 叙事意图，注入 CharacterAgent prompt
    "urgency": "high" | "medium" | "low",  # 影响 CLI 阅读延迟
    "world_state_delta": {key: float},     # 预测的状态变化（beat_delta 计算参考）
    "state_change_hint": str,              # 状态变化说明（调试显示用）
    "content": str,                        # speaker=narrator 时的旁白文本
}
```

### 5.6 WebSocket 通信消息完整结构

#### state\_update 详细结构

```json
{
  "type": "state_update",
  "world_state": {
    "qualities":     {"tension": 2.5, "grace_trust": 1.0},
    "flags":         {"arrived": true, "trip_confessed": false},
    "relationships": {"trip_to_player": 0.5}
  },
  "current_landmark_id": "lm_2_cracks",
  "current_landmark": {
    "id": "lm_2_cracks",
    "title": "关系裂缝",
    "phase_tag": "act2",
    "is_ending": false
  },
  "current_storylet_id": "sl_renovation_tension",
  "current_storylet": {
    "id":            "sl_renovation_tension",
    "title":         "装修矛盾",
    "narrative_goal":"让玩家感受到 Trip 和 Grace 之间的紧张关系",
    "phase_tags":    ["act2", "cracks"]
  },
  "turn": 8,
  "game_ended": false
}
```

***

## 6. 核心模块详细说明

### 6.1 InputParser — 多职责输入解析器

**文件：** `agents/input_parser.py`

InputParser 承担两大功能，通过 `analyze()` 合并为单次 LLM 调用实现：

#### 合法性检查流水线

```
玩家输入
     │
     ▼
第一层：规则快速过滤（零 LLM 成本）
     ├── Meta 检测（"你是AI/游戏模型"）   → soft reject, deflect
     ├── 物理违规（砸/打/跳窗/威胁）        → hard reject, ignore
     └── 超长输入（>200字符）               → soft reject, confused
     │
     ▼ 规则层通过
第二层：LLM 语义判断
     └── 传入：场景约束 + storylet_title + 当前语境
         → {valid: bool, severity: "hard"|"soft"|null, reason: str, response_mode: str}
```

#### 语义条件匹配流水线

```python
# _collect_semantic_conditions() 收集当前 Landmark 范围内的条件
conditions = []
# 1. 当前 Landmark 下候选 Storylet 的 llm_trigger（通过标签/结构性条件过滤）
# 2. 当前 Landmark 出边 transition 的 llm_semantic 条件
→ 通常 2~15 条，全量传入 LLM 判断（无需向量检索）

# analyze() LLM 调用结构
输入：player_input + conditions[{id, description}] + context
输出：{valid, matched_conditions: ["sl_xxx", "lm2→lm3b", ...]}
```

**matched\_semantic\_ids 的下游消费路径：**

1. `StorySelector.select(matched_semantic_ids=...)` → llm\_trigger Storylet 必须在列表中
2. `LandmarkManager.check_progression(matched_semantic_ids=...)` → llm\_semantic 转场条件匹配

#### SemanticConditionStore

```python
class SemanticConditionStore:
    def add(condition: SemanticCondition)       # 注册单条条件
    def add_many(conditions: List[...])         # 批量注册
    def remove(condition_id: str)               # 移除单条
    def remove_by_prefix(prefix: str)           # 按前缀批量移除（Landmark 切换时清理）
    def search(query: str, top_k: int)          # 检索（当前返回全量）
    def clear()                                 # 清空

@dataclass
class SemanticCondition:
    id: str               # 唯一标识，如 "sl_push_trip" 或 "lm2→lm3a"
    source_type: str      # "storylet" | "landmark_transition"
    description: str      # 自然语言描述（用于 LLM 判断）
    metadata: Dict        # 扩展元数据（含 transition_target 等）
```

### 6.2 DirectorAgent — IBSEN 导演系统

**文件：** `agents/director.py`

DirectorAgent 参考 IBSEN 论文架构，关键区别在于控制粒度：

| 维度          | IBSEN  | FacadeRemake       |
| ----------- | ------ | ------------------ |
| Director 输出 | 完整剧情脚本 | 指导性指令（情绪基调 + 行为方向） |
| Actor 自由度   | 严格执行脚本 | 有自由度，但服务于叙事目标      |
| 控制方式        | 直接控制台词 | 间接控制——提供方向         |

#### GoalTracker

```python
@dataclass
class NarrativeGoal:
    id: str
    description: str         # 叙事目标描述（来自 Storylet.narrative_goal）
    target_turns: int = 5    # 预期完成回合数
    current_turns: int = 0   # 已进行回合数
    status: GoalStatus       # IN_PROGRESS / NEARLY_COMPLETE / COMPLETE / FAILED
    interventions: int = 0   # 干预次数（≥3 次标记 FAILED）

# 接口
set_goal(goal)              # Storylet 切换时调用
advance_turn()              # 每回合调用一次
check_completion(history, world_state) → (bool, str)  # 可选 LLM 判断
```

#### InstructionGenerator

叙事节奏判断逻辑：

```python
if "揭露" in goal or "摊牌" in goal and tension >= HIGH:
    beat = "push"       # 积极推进叙事
elif "维持" in goal or "掩盖" in goal:
    beat = "maintain"   # 维持当前张力
elif "道歉" in goal or "原谅" in goal:
    beat = "release"    # 释放紧张情绪
elif storylet_turn >= 4:
    beat = "accelerate" # 尝试推进当前场景
else:
    beat = "maintain"
```

生成的 `DirectorInstruction` 字段：

| 字段                    | 说明                                       |
| --------------------- | ---------------------------------------- |
| `primary_goal`        | 当前主要叙事目标（来自 Storylet.narrative\_goal）    |
| `tone_guidance`       | 情绪基调的详细描述（从 tone 字符串映射展开）                |
| `narrative_beat`      | 叙事节奏标签（push/maintain/release/accelerate） |
| `character_specific`  | 针对特定角色的指导（来自 allowed\_behaviors dict）    |
| `forbidden_topics`    | 禁止话题列表（来自 Landmark.forbidden\_reveals）   |
| `optional_motivation` | 角色动机提示（引导内心独白方向）                         |
| `pacing_note`         | 节奏提示文本                                   |

#### BeatPlan 生成接口

```python
class DirectorAgent:
    def set_current_goal(self, narrative_goal: str, target_turns: int = 5)
    def advance_turn(self)
    def generate_beat_plan(self, storylet_content: dict,
                           world_state: dict,
                           dialogue_history: List[str]) -> List[Dict]
    def generate_instruction_for(self, character: str,
                                 storylet_content: dict,
                                 world_state: dict,
                                 history: List[str],
                                 player_input: str = "") -> str
    def decide_speakers(self, player_input: str,
                        storylet_content: dict,
                        dialogue_history: List[str],
                        characters: List[str]) -> List[str]
    def generate_transition_beat_plan(self, old_storylet_title: str,
                                      new_storylet_title: str, ...) -> List[Dict]
    def check_and_update_goal(self, world_state: dict,
                               history: List[str]) -> Tuple[bool, str]
```

### 6.3 CharacterAgent — 三步生成架构

**文件：** `agents/character_agent.py`

#### Step 0：内心独白（`_generate_inner_thought()`）

**Monologue 选择策略（`_select_relevant_monologue()`）：**

1. 扫描玩家输入关键词 → 映射到 Monologue 类别（核心秘密/心理博弈/心理压抑/认知盲区/临界状态/现实压力）
2. 检查 `world_state.emotional_state[character]` 情绪状态映射
3. 有关键词/情绪匹配 → 选择对应类别的 IBSEN Monologue 模板
4. 无匹配 → LLM 自动选择（temperature=0.3）
5. 最终兜底 → 返回 `monologue_knowledge[0]`

**Step 0 Prompt 骨架（有 Monologue 时）：**

```
你是戏剧角色 {character}。
【身份背景】{identity}
【你内心深处的声音】{monologue.monologue}
【本幕叙事目标】{narrative_goal}
【导演说明】{director_note}
【当前情绪标签】{emotion_tags}
最近的对话：{近4条}
刚才你的大学老友说："{player_input}"
请基于你"内心深处的声音"，用第一人称写出你此刻真实的内心想法（1-2句话）。
- 这是内心独白，不是说出口的话；可以和你即将说的话相矛盾
```

#### Step A：行为选择（`_select_behavior()`）

**行为库完整列表（`data/character_behaviors.py`）：**

| 行为 ID                 | 归属    | 标签    | Salience Boost |
| --------------------- | ----- | ----- | -------------- |
| `deflect`             | 共用    | 转移话题  | 0              |
| `go_quiet`            | 共用    | 沉默欲言  | 1              |
| `make_excuse`         | 共用    | 找借口   | 0              |
| `ask_player`          | 共用    | 反问求助  | 2              |
| `surface_normal`      | 共用    | 维持表面  | 0              |
| `subtle_hint`         | 共用    | 话里有话  | 2              |
| `admit`               | Trip  | 承认真相  | 5              |
| `get_angry`           | Trip  | 情绪爆发  | 3              |
| `apologize`           | Trip  | 真诚道歉  | 5              |
| `shut_down`           | Trip  | 彻底关闭  | 1              |
| `cold_truth`          | Grace | 冷静揭示  | 5              |
| `care_through_action` | Grace | 行动表关心 | 1              |
| `controlled_sarcasm`  | Grace | 克制讽刺  | 2              |
| `withdraw`            | Grace | 情感撤退  | 1              |
| `break_down`          | Grace | 情绪崩溃  | 4              |

#### Step B：台词/动作生成

**System Prompt 完整注入结构：**

```
你是一场戏剧中的角色：{character}。
【身份】{identity}
【性格】{personality}
【背景】{background 列表}
【你知道的/你不知道的】{secret_knowledge 列表}
【当前场景与叙事目标】{narrative_goal}
  → 思考：你的言行如何让这个目标更进一步？
【导演指导】{director_note}
【情绪基调】{behavior.tone_hint}      ← Step A 输出覆盖
【当前行为模式】{behavior_id}（{label}）：{behavior.description}
【额外指令】{director_instruction}     ← DirectorAgent 生成
【绝对禁止】{forbidden_reveals 列表}
【你此刻内心真实想法】{inner_thought}  ← Step 0 输出
  （注意：你不会直接说出内心想法，言行可与内心相矛盾）
【关键指令】
  1. 必须直接回应对话历史的最后一行
  2. 不要重复之前说过的话
  3. 只输出 JSON：{"dialogue": "...", "action": "..."}
  4. 只能扮演 {character}
  5. 语气自然——像真实的人而非戏剧角色
```

**IBSEN 对话历史构建（`_build_dialogue_history_for_actor()`）：**

```python
# 取最近 6 条对话历史，映射到 OpenAI messages 格式
角色自身发言      → role="assistant"
旁白              → role="user",    content="（{content}）"
__INPUT__（玩家） → role="user",    content="玩家: {player_input}"
其他角色          → role="user",    content="{role}: {content}"
```

#### IBSEN 式质量防护（`_verify_and_fix_response()`）

```
LLM 原始输出
     ├── Step 1: NG words 二次检查 → 重试（最多3次），追加 system 提示
     ├── Step 2: 关键词冲突检测（玩家问A但回B） → 降温重试（temperature=0.3）
     ├── Step 3: JSON 格式校验 → 结构重试
     ├── 重复检测：字符重叠率 > 50% → 截断历史后重生成
     └── 前缀清理：trip: / grace: / 特拉维斯: / 格蕾丝: 等
```

#### CharacterAgent 对外接口

```python
class CharacterAgent:
    def generate_response(self,
                          player_input: str,
                          storylet_content: dict,
                          world_state: dict,
                          dialogue_history: List[str],
                          director_instruction: str = "",
                          forbidden_topics: List[str] = [],
                          beat_intent: str = "",
                          addressee: str = "") -> Dict
    # 返回：{"thought": str, "dialogue": str, "actions": str, "emotion_tags": list}

    def set_debug(self, debug: bool)
```

### 6.4 StorySelector — 三层过滤选择器

**文件：** `agents/story_selector.py`

```python
class StorySelector:
    def select(self,
               world_state: WorldState,
               turn: int,
               player_input: str = "",
               matched_semantic_ids: List[str] = []) -> Optional[Storylet]:

# 内部三层过滤（+ 可选第四层）：
# Layer 1: 标签过滤
#   current_landmark.get_allowed_tags() 与 storylet.phase_tags 取交集
# Layer 2: 条件过滤
#   storylet.can_trigger(world_state, turn) → flag/quality/cooldown 全部通过
#   有 llm_trigger 的 Storylet → 必须在 matched_semantic_ids 中
# Layer 3: Salience 评分
#   score = salience.base + sum(modifier 条件加减分) + priority_override
#   取最高分的 Storylet（同分随机选一）
# Layer 4（默认关闭）: LLM 二次评估
#   取 Top-3 交由 LLM 选最优（use_llm_evaluator=False）
# Fallback: current_landmark.fallback_storylet
```

### 6.5 GameEngine — 核心业务逻辑引擎（CLI 模式）

**文件：** `engine/game_engine.py`

GameEngine 通过 DIContainer 注入所有依赖，封装以下核心业务方法：

| 方法                                | 职责                                               |
| --------------------------------- | ------------------------------------------------ |
| `handle_player_input(text)`       | 处理玩家输入：验证 → 计数 → delta → 调解检测 → 转场 → 刷新 BeatPlan |
| `handle_player_silence()`         | 处理沉默：计数 → delta → 转场 → 刷新 BeatPlan               |
| `handle_auto_beat()`              | 执行当前 Beat：生成角色响应 → 更新 beat\_index → delta        |
| `_switch_to_storylet(new, ...)`   | 切换场景：应用效果 → 设置目标 → 刷新 BeatPlan → 触发过渡 Beat       |
| `_check_and_handle_transitions()` | 检查 Landmark/Storylet 转场条件并触发推进                   |
| `_refresh_beat_plan()`            | 异步刷新 BeatPlan（run\_in\_executor）                 |
| `_generate_transition_beats()`    | 生成场景切换的衔接 Beat 序列                                |
| `_apply_beat_delta()`             | 应用 Beat 级状态增量（compute\_beat\_delta 计算）           |
| `_trigger_initial_storylet()`     | 游戏启动时选择初始 Storylet                               |

**Beat Delta 双轨更新机制：**

```
Storylet 切换时：_apply_storylet_effects()
     └── 应用 op="=" 效果（设定状态基准值）
     └── 初始化 effect_trends 和 accumulated_delta

每个 Beat 执行后：_apply_beat_delta(player_input, beat)
     └── WorldState.compute_beat_delta(effect_trends, accumulated_delta, player_input)
         → 根据趋势和玩家行为计算即时增量
         → 支持玩家缓解行为触发逆趋势调整
     └── StateManager.set_quality(key, current + val)
     └── accumulated_delta[key] += val
```

### 6.6 GameEventLoop — asyncio 三轨并发调度

**文件：** `engine/event_loop.py`

三轨并发架构，通过 asyncio.gather() 并行运行：

```
┌─────────────────────────────────────────────────────────┐
│             GameEventLoop（asyncio.gather）               │
├──────────────────┬──────────────────────────────────────┤
│ _player_input_loop│      _narrative_push_loop           │
│                   │                                      │
│ • run_in_executor │ • 按 BeatPlan 顺序执行               │
│   读取 stdin      │ • player_turn → 激活等待              │
│ • 投递事件到 Queue│ • narrator → 直接输出                 │
│ • 支持 quit/status│ • character beat → 投递 auto_beat    │
│   命令            │ • 等待 beat_done_event               │
│                   │ • 阅读延迟（urgency 决定范围）         │
│                   │ • 超时（45s）→ 催促；再超时视为沉默    │
├──────────────────┴──────────────────────────────────────┤
│                  _event_consumer                         │
│ • 消费 event_queue（FIFO）                                │
│ • player_input  → run_in_executor(handle_player_input)  │
│ • player_silence → run_in_executor(handle_player_silence)│
│ • auto_beat     → run_in_executor(handle_auto_beat)     │
│ • LLM 调用（同步）在线程池中执行，不阻塞事件循环          │
└─────────────────────────────────────────────────────────┘
```

**同步机制：**

- `beat_done_event`（asyncio.Event）：auto\_beat 执行完成后 GameEngine 通过 `call_soon_threadsafe` 通知叙事推进轨道
- `pending_beat_task`（asyncio.Task）：保存当前等待中的 Task，玩家输入时可取消

***

## 7. WebSocket 服务器（ws\_server.py）

### 7.1 GameSession 内部结构

```python
class GameSession:
    # 通信
    ws: WebSocket
    _loop: asyncio.AbstractEventLoop   # 主事件循环引用（线程安全回调用）

    # 核心模块
    world_state: WorldState
    storylet_manager: StoryletManager
    landmark_manager: LandmarkManager
    story_selector: StorySelector
    input_parser: InputParser
    condition_store: SemanticConditionStore
    llm_client: LLMClient
    director_agent: DirectorAgent
    trip_agent: CharacterAgent
    grace_agent: CharacterAgent

    # 会话状态
    current_storylet: Storylet | None
    storylet_turn_count: int
    conversation_history: List[str]
    turn: int
    game_ended: bool
    scene_loaded: bool
```

### 7.2 LLM 调试信息推送

LLMClient 的 `on_debug` 回调机制实现 WebSocket 模式下的实时调试信息推送：

```python
def _ws_debug_callback(event_type: str, payload: dict):
    """在线程池中执行，通过 call_soon_threadsafe 调度到主线程发送"""
    msg = {"type": "llm_debug", "event": event_type, "data": payload, "ts": time()}
    loop_ref.call_soon_threadsafe(loop_ref.create_task, ws_ref.send_json(msg))
```

前端 `usePlayStore` 接收后存入 `debugLogs`（最多 200 条），在 DebugPanel 中实时展示。

### 7.3 LLM 初始化与降级策略

```python
# ws_server 启动时的 LLM 初始化流程
1. 加载 .env.local / .env 中的环境变量
2. 读取 LLM_PROVIDER（默认 "openai"）与 LLM_MODEL
3. 创建 LLMClient + DirectorAgent
4. 若 OPENAI_API_KEY 未设置 → RuntimeError
   → 捕获后以"无 LLM 模式"运行（WorldState/Storylet/Landmark 调度正常，LLM 功能不可用）
```

### 7.4 角色配置下发机制

CharacterAgent 不使用硬编码角色配置，而由前端在 `init_scene` 时下发完整配置：

```python
# _init_characters_from_scene() 从前端数据构造 character_profile
profile = {
    "name": str,
    "identity": str,          # 角色身份设定
    "personality": str,       # 性格描述
    "background": [str],      # 背景故事列表
    "secret_knowledge": [str],# 秘密知识（仅注入该角色的 prompt）
    "ng_words": [str],        # 禁止用语列表
    "monologue_knowledge": [{  # IBSEN Monologue 模板
        "ref_secret": str,
        "category": str,
        "monologue": str,
        "emotion_tags": [str],
    }],
    "behaviors": [str],        # 行为 ID 列表（StoryVerse Action Schema）
    "behavior_meta": {str: {...}}, # 行为元数据字典
}
```

***

## 8. 前端设计与状态管理

### 8.1 useProjectStore（设计模式状态）

管理叙事蓝图编辑器的全局状态：

```typescript
interface ProjectStore {
  landmarks: Landmark[]          // Landmark 节点列表（含 position 位置信息）
  storylets: Storylet[]          // Storylet 列表
  characters: Character[]        // 角色配置列表
  worldStateDefinition: WorldStateDefinition  // 世界状态变量定义

  // 撤销/重做（最多 50 步）
  _history: ProjectSnapshot[]
  _future: ProjectSnapshot[]
  undo: () => void
  redo: () => void

  // CRUD 操作
  addLandmark: (lm) => void
  updateLandmark: (id, patch) => void
  deleteLandmark: (id) => void
  addStorylet: (sl) => void
  updateStorylet: (id, patch) => void
  // ...
}
```

### 8.2 usePlayStore（游戏运行时状态）

管理 Play 模式的实时状态与 WebSocket 通信：

```typescript
interface PlayStore {
  // 运行时状态
  messages: ChatMessage[]
  worldState: RuntimeWorldState
  currentLandmarkId: string
  currentStoryletId: string | null
  currentLandmark: LandmarkInfo | null
  currentStorylet: StoryletInfo | null
  turn: number
  isLoading: boolean
  gameEnded: boolean
  connected: boolean
  debugLogs: LlmDebugEntry[]   // LLM 调试日志（最多 200 条）

  // 操作
  sendMessage: (text: string) => void   // 乐观更新 + WS发送
  rollback: () => void                  // 从快照栈恢复
  resetGame: () => void                 // 清空状态 + 重发 init_scene

  // WebSocket 管理
  connect: () => void
  disconnect: () => void
  _handleWsMessage: (data) => void
}
```

**快照栈（回退机制）：**

```typescript
// 每次 sendMessage 前压栈（最多 30 步）
_snapshotStack.push({
  messages, worldState, currentLandmarkId, currentStoryletId, turn
})
// rollback() 弹栈并恢复所有状态（不重发 WS 请求）
```

### 8.3 组件层级结构

```
App.tsx（模式路由：start / design / play）
│
├── [start 模式]
│   └── StartScreen（项目选择/新建）
│
├── [design 模式]
│   ├── Toolbar（工具栏：保存/加载/模式切换）
│   ├── LandmarkCanvas（React Flow DAG 画布）
│   │   ├── LandmarkNode（自定义节点：颜色区分阶段/结局）
│   │   └── TransitionEdge（自定义边：动画区分转场类型）
│   └── Inspector（右侧属性面板）
│       ├── TransitionsTab（Landmark 转场条件编辑）
│       ├── StoryletPool（场景池管理）
│       ├── CharactersPanel（角色档案/秘密/独白/行为配置）
│       └── WorldStatePanel（qualities/flags/relationships 定义）
│
└── [play 模式]
    └── PlayMode
        ├── ChatLog（对话历史流：自动滚动 + thought 折叠）
        ├── InputBar（玩家输入：空输入 = 沉默）
        └── DebugPanel（调试面板）
            ├── WorldState 实时查看与修改
            ├── 当前 Landmark / Storylet 信息显示
            └── LLM 调试日志（请求/响应详情展开查看）
```

***

## 9. 角色配置与 IBSEN 独白模板

### 9.1 Trip（特拉维斯）角色档案

| 维度                | 内容                                         |
| ----------------- | ------------------------------------------ |
| identity          | 30岁，普通家庭出身，金融行业从业，Grace 的丈夫                |
| personality       | 表面热情好客、幽默健谈；实际防御性强、被动攻击、因自卑衍生控制欲           |
| secret\_knowledge | 自己也有婚外情（Grace 不知道）；一直无法接受 Grace 作为艺术家的身份   |
| ng\_words         | "亲爱的"、"宝贝"、"语言模型"、"AI"、"助手"、"让我们一起来"、"深呼吸" |

**IBSEN 独白模板：**

| ID                     | 类别   | 核心情绪    | ref\_secret |
| ---------------------- | ---- | ------- | ----------- |
| `mon_trip_affair`      | 核心秘密 | 愧疚、自我辩护 | 婚外情         |
| `mon_trip_class_shame` | 深层创伤 | 自卑、不甘   | 贫困出身的阶层羞耻感  |

### 9.2 Grace（格蕾丝）角色档案

| 维度                | 内容                                     |
| ----------------- | -------------------------------------- |
| identity          | 30岁，富裕家庭出身，有天赋的艺术家，Trip 的妻子            |
| personality       | 表面友好优雅；内心积压不满、被娇生惯养、在压力下冷静直击要害         |
| secret\_knowledge | 在 Trip 求婚前一晚与 Vince 发生了关系；婚姻扼杀了她的艺术才华  |
| ng\_words         | "我好生气啊"、"气死我了"、"我要离婚"、"语言模型"、"AI"、"助手" |

**IBSEN 独白模板：**

| ID                    | 类别   | 核心情绪     | ref\_secret |
| --------------------- | ---- | -------- | ----------- |
| `mon_grace_vince`     | 核心秘密 | 内疚、恐惧    | 与 Vince 的关系 |
| `mon_grace_smothered` | 心理压抑 | 失落、压抑的愤怒 | 艺术才华被婚姻扼杀   |

***

## 10. 技术债与已知限制

### 🟡 低优先级待改进

#### 10.1 LLM 评估器默认关闭

- `agents/story_selector.py` 中 `use_llm_evaluator = False`
- 评估器代码（`_llm_evaluate_candidates()`）已完整实现
- 建议待主线叙事流程全部调试通过后再启用

#### 10.2 Beat 系统未挂载叙事数据

- Beat 执行路径（BeatManager + engine.handle\_auto\_beat）已完整实现
- 当前 Storylet 数据中无 `beat_sequence` 字段
- `PARALLEL/WAIT` BeatType 框架代码路径不完整

#### 10.3 WorldState 级联状态（cascadeWorldState）

- 前端 `store/cascadeWorldState.ts` 中存在级联更新工具，尚未与后端状态完全同步
- 后续可完善级联计算逻辑（如 tension 影响 character\_focus 等）

#### 10.4 ws\_server 与 engine 双套逻辑

- `ws_server.py` 中的 `process_turn()` 与 `engine/game_engine.py` 中的 `handle_player_input()` 存在部分重复逻辑
- 建议后续将 ws\_server 的业务逻辑迁移到 GameEngine，ws\_server 仅作薄通信层

#### 10.5 SemanticConditionStore 向量检索未实现

- 当前 `search()` 返回全量条件列表
- 预留接口为 top-k cosine similarity 向量检索
- 在 Landmark 内条件数量 > 15 条时性能可能下降

***

## 11. 运行与配置

### 11.1 启动方式

```bash
# WebSocket 服务器模式（前后端联调）
cd prototype
pip install -r requirements.txt    # fastapi, uvicorn, python-dotenv, openai
python ws_server.py                 # 监听 ws://localhost:8000/ws/play

# 前端开发服务器
cd frontend
npm install
npm run dev                         # 默认 http://localhost:5173

# CLI 模式（命令行直接游玩）
cd prototype/facade_remake
python main.py                      # 默认 debug 模式开启
python main.py --no-debug           # 关闭调试输出
python main.py --provider deepseek  # 切换 LLM 服务商
```

### 11.2 环境变量

| 变量               | 说明         | 默认值           |
| ---------------- | ---------- | ------------- |
| `OPENAI_API_KEY` | LLM API 密钥 | 无（必填）         |
| `LLM_MODEL`      | LLM 模型名称   | `gpt-4o-mini` |
| `LLM_PROVIDER`   | LLM 服务商    | `openai`      |

配置文件位置：`prototype/.env.local`（优先）或 `prototype/.env`

### 11.3 调试模式输出前缀

| 前缀标记             | 说明                        |
| ---------------- | ------------------------- |
| `[DEBUG]`        | InputParser 输入解析结果        |
| `[Director]`     | DirectorAgent BeatPlan 信息 |
| `[DRAMA]`        | 本轮发言角色决策                  |
| `[thought]`      | 角色内心独白                    |
| `[behavior]`     | 角色行为选择                    |
| `[llm_trigger]`  | 语义触发判断结果                  |
| `💭 [xxx 内心]`    | 格式化内心独白（调试）               |
| `[Storylet] xxx` | Storylet 切换信息             |
| `[进入新阶段: xxx]`   | Landmark 推进信息             |

***

## 12. 完整数据流示例

以玩家输入"你们之间到底发生了什么"为例，追踪完整数据流路径：

```
[前端] InputBar.onSubmit("你们之间到底发生了什么")
     ↓
[usePlayStore.sendMessage()]
     → 压快照到 _snapshotStack
     → 本地立即显示玩家消息（乐观更新）
     → _sendWs({type: "player_input", text: "你们之间到底发生了什么"})
     ↓
[WebSocket] → ws_server.py /ws/play
     ↓
[GameSession.process_turn("你们之间到底发生了什么")]
     ↓
[Step 1: InputParser.analyze()]
     → 规则层：通过
     → 收集语义条件：
       - sl_renovation_tension.llm_trigger = "玩家询问 Trip/Grace 关系..."
       - sl_ask_grace.llm_trigger = "玩家私下询问 Grace..."
       - lm2→lm3b.llm_semantic = "玩家强烈追问婚姻状况..."
     → 单次 LLM 调用判断：
       valid=true
       matched_conditions=["sl_renovation_tension", "sl_ask_grace", "lm2→lm3b"]
     ↓
[Step 2: StorySelector.select(matched_semantic_ids=[...])]
     → Layer1 标签过滤：act2 通过
     → Layer2 条件过滤：
       sl_ask_grace: conditions 全部满足 ✓, llm_trigger 在 matched_ids 中 ✓
     → Layer3 Salience 评分：sl_ask_grace score=8.5（最高）
     → 选中：sl_ask_grace
     → 切换 Storylet（之前为 sl_renovation_tension）
     → 应用 effects: grace_exposed=True（进入条件）
     → director.set_current_goal("玩家私下问 Grace 关于婚姻秘密")
     ↓
[Step 3: DirectorAgent.generate_beat_plan()]
     → LLM 调用生成 BeatPlan：
       [{speaker:"grace", addressee:"player", intent:"欲言又止，手指摩挲酒杯", urgency:"high"},
        {speaker:"trip",  addressee:"player", intent:"转移话题，制造干扰", urgency:"medium"},
        {speaker:"player_turn", ...}]
     ↓
[Step 4: Beat 逐个执行]
     ▶ Beat[0]: speaker=grace
       → DirectorAgent.generate_instruction_for("grace")
         → "Grace 在阳台，似乎在做重大决定。不要让她太快说出秘密。"
       → CharacterAgent(grace).generate_response(beat, context)
         → Step0 内心独白(temperature=0.75):
             "他终于问了……我该告诉他吗？不，我不能，如果我说了一切就完了。"
         → StepA 行为选择(temperature=0.1): "go_quiet"
         → StepB 台词生成(temperature=0.6):
             dialogue: "你知道我最讨厌什么吗？不是他不欣赏我的画。
                        是他从来不想了解画画对我来说意味着什么。"
             action:   "*手指在酒杯边缘轻轻划过，目光望向窗外*"
       → 写入 conversation_history: "grace: [台词] [动作]"
       → 推送 WS: {type:"chat", role:"grace", speech:"...", action:"...", thought:"..."}

     ▶ Beat[1]: speaker=trip
       → CharacterAgent(trip).generate_response(beat, context)
         → 结果：{dialogue:"酒快没了，我去拿一瓶。", action:"*起身走向厨房*"}
       → 推送 WS: {type:"chat", role:"trip", ...}
     ↓
[Step 5: 后处理]
     → LandmarkManager.check_progression(world_state, player_input, matched_semantic_ids)
       matched_ids 包含 "lm2→lm3b" → 触发推进
       → set_current("lm_3b_grace", world_state)
       → apply world_state_effects_on_enter
     → 推送 WS: {type:"chat", role:"system", speech:"[进入新阶段: Grace 揭露路线]"}
     → 构建 state_update snapshot
     → 推送 WS: {type:"state_update", world_state:{...}, current_landmark_id:"lm_3b_grace", ...}
     ↓
[前端] usePlayStore._handleWsMessage()
     → 逐条处理 WS 消息
     → 更新 messages（展示 grace/trip 台词）
     → 更新 worldState / currentLandmarkId / currentStoryletId / turn
     → DebugPanel 实时反映状态变化
```

***

## 13. 设计参考文献

| 论文/资料                        | 核心贡献                                 |
| ---------------------------- | ------------------------------------ |
| Facade 原作（Mateas & Stern）    | Beat/Storylet 架构、社交互动游戏理论基础          |
| Triangle Framework           | 混合叙事架构（预设计骨架 + 涌现式内容）                |
| DRAMA LLAMA                  | 自然语言 Trigger、Speaker 自决发言顺序          |
| IBSEN 论文                     | Director-Actor 分离、NG 重试机制、结构化对话历史    |
| StoryVerse（Wang 2024）        | Action Schema（行为库设计）、角色行为显式定义        |
| Piloto 2025                  | 间接控制哲学、多智能体叙事系统设计原则                  |
| Wu 2025                      | Hybrid 架构理论、Plot-based Reflection 机制 |
| NarrativeGenie（Kumaran 2024） | Beat 依赖图、Adaptive Dialogue Manager   |
| De Lima 2021                 | Story Arc 张力曲线、自适应叙事干预机制             |
| Dramamancer                  | Storylet 选择机制、时间兜底策略                 |

