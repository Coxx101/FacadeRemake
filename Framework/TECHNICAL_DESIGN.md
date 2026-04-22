# FacadeRemake 技术设计文档

> 最后更新：2026-04-23
> 本文档是项目的 **source of truth**，修改数据/代码时请同步更新对应章节。

---

## 1. 项目概述

**目标**：用现代 LLM + Agent 技术复刻 Facade 的互动叙事体验。

**核心架构**：Storylet-Landmark 双层叙事引擎 + Director-Actor Agent + LLM 角色扮演。

**叙事场景**（忠实于 Facade 原版）：
- **Trip**（特拉维斯，30岁）和 **Grace**（格蕾丝，30岁）是一对结婚约八年的夫妻
- Grace 在 Trip 求婚前一晚与大学同学 Vince 发生了关系，Trip 也有婚外情
- 双方都有对方不知道的秘密——核心戏剧张力来源
- 阶层差异（Grace 富裕 vs Trip 贫困）是深层矛盾
- **玩家角色**：Trip 和 Grace 的大学老友，受邀来公寓做客
- 公寓是 Grace 唯一的创作出口——她把艺术才华全部倾注在装修上

**前端**：Vite 5.4 + React 18 + TypeScript + Tailwind v4 + React Flow（Design 模式蓝图编辑 + Play 模式对话界面）。

---

## 2. 文件结构

```
prototype/
├── ws_server.py                # FastAPI WebSocket 服务器（前后端通信）
├── requirements.txt            # Python 依赖
├── .env.local                  # 环境变量（OPENAI_API_KEY, OPENAI_MODEL）
│
├── facade_remake/
│   ├── main.py                 # 游戏主循环（命令行 CLI，独立于 ws_server）
│   ├── __init__.py
│   ├── core/                   # 核心引擎
│   │   ├── world_state.py      # 世界状态容器（qualities/flags/relationships）
│   │   ├── storylet.py         # Storylet 数据结构 + StoryletManager
│   │   ├── landmark.py         # Landmark 锚点 + LandmarkManager（DAG）
│   │   ├── story_selector.py   # 三层选择器（标签→条件→Salience）
│   │   ├── input_parser.py     # InputParser（输入合法性检查 + 语义条件匹配）+ SemanticConditionStore
│   │   ├── beat.py             # Beat 叙事原子（已实现，未启用）
│   │   └── __init__.py
│   ├── agents/
│   │   ├── llm_client.py       # LLMClient + CharacterAgent（三步生成）
│   │   ├── director.py         # DirectorAgent（IBSEN 导演-演员系统）
│   │   └── __init__.py
│   ├── config/
│   │   ├── characters.py       # 角色配置 + IBSEN Monologue 模板
│   │   └── __init__.py
│   └── data/
│       ├── default_storylets.py    # 默认 Storylet 数据集
│       ├── default_landmarks.py    # 默认 Landmark 数据集（含结局）
│       ├── character_behaviors.py  # 角色叙事行为库（StoryVerse Action Schema）
│       └── __init__.py
│
frontend/                        # 前端项目（详见前端技术文档）
├── src/
│   ├── components/             # React 组件
│   │   ├── design/             # Design 模式（蓝图编辑器）
│   │   ├── play/               # Play 模式（对话界面 + Debug 面板）
│   │   └── home/               # Home 模式（项目选择/创建）
│   ├── stores/                 # Zustand 状态管理
│   ├── types.ts                # 全局类型定义
│   └── App.tsx                 # 路由 / 模式切换
└── package.json
```

---

## 3. 世界状态注册表

### 3.1 数值型状态（Qualities）

| Key | 初始值 | 类型 | 说明 | 谁修改 |
|-----|--------|------|------|--------|
| `marriage_tension` | 0 | float | 婚姻紧张度，控制叙事节奏 | 多个 Storylet 的 effects |
| `conversation_turns` | 0 | int | 对话轮数计数 | 兜底 Storylet + 初始化 Storylet |
| `father_deflection_count` | 0 | int | 父亲回避次数 | `sl_father_work_excuse` effects；`sl_player_notices` salience 修正器 |

### 3.2 布尔型标记（Flags）

按叙事阶段分组：

#### Act1：到达与晚餐

| Flag | 初始值 | 设置者 | 条件（何时触发） | 消费者（谁检查） |
|------|--------|--------|------------------|------------------|
| `arrived` | False | `sl_welcome_home` effects | 无前置条件，游戏首个 Storylet | `sl_dinner_table_silence`, `sl_mother_extra_food` |
| `dinner_started` | False | `sl_dinner_table_silence` effects | `arrived=True` | `sl_father_phone_ring`, `sl_mother_extra_food` |
| `phone_incident` | False | `sl_father_phone_ring` effects | `dinner_started=True` | `sl_father_work_excuse`, **Landmark lm_0→lm_1 推进** |
| `mother_extra_care` | False | `sl_mother_extra_food` effects | `arrived=True, dinner_started=True` | —（无消费者，仅作为触发门控） |
| `father_work_excuse` | False | `sl_father_work_excuse` effects | `phone_incident=True` | —（无消费者，仅作为触发门控） |
| `player_asked_wrong` | False | `sl_player_notices_something_wrong` effects | `marriage_tension>=1.5` | `sl_mother_slips` |

#### Act2：真相揭露

| Flag | 初始值 | 设置者 | 条件 | 消费者 |
|------|--------|--------|------|--------|
| `mother_slipped` | False | `sl_mother_slips` effects | `player_asked_wrong=True` | **Landmark lm_1→lm_2 推进**, `lm_2_revelation` 进入条件 |
| `secret_exposed` | False | `sl_secret_exposed` effects | `marriage_tension>=3` | `sl_father_defends`, `sl_son_asked_tuition`, 兜底 Storylet 条件 |
| `father_explained` | False | `sl_father_defends` effects | `secret_exposed=True` | `sl_mother_three_months` |
| `mother_revealed_timing` | False | `sl_mother_three_months` effects | `father_explained=True` | **Landmark lm_2→lm_3 推进**, `sl_confrontation_silence`, `lm_3_confrontation` 进入条件 |
| `tuition_mentioned` | False | `sl_son_asked_tuition` effects | `secret_exposed=True` | —（无消费者，仅作为触发门控） |

#### Act3：摊牌与结局

| Flag | 初始值 | 设置者 | 条件 | 消费者 |
|------|--------|--------|------|--------|
| `confrontation_started` | False | `sl_confrontation_silence` effects | `mother_revealed_timing=True` | `sl_father_asks_forgiveness`, 兜底 Storylet 条件 |
| `father_apologized` | False | `sl_father_asks_forgiveness` effects | `confrontation_started=True` | `sl_mother_decision`, **Ending "诚实开始"** |
| `mother_decided` | False | `sl_mother_decision` effects | `father_apologized=True` | **Ending "诚实开始"/"儿子的角色"**, **Landmark lm_3 推进** |
| `player_mediated` | False | `_check_player_mediation()` 关键词检测 | Act3 阶段玩家输入含调解词 | **Ending "儿子的角色"** |

> ✅ `player_mediated` 已在 `main.py._check_player_mediation()` 实现：在 `lm_3_confrontation` 阶段检测20个调解关键词，匹配即设为 True。

---

## 4. 叙事流程图

### 4.1 主线推进链

```
[游戏开始]
    │
    ▼
lm_0_surface (表面平静)
    │ 允许标签: act1, surface
    │ 禁止提及: money, debt, loan
    │ 兜底: sl_generic_act1
    │
    ├── sl_welcome_home ──→ set arrived
    ├── sl_dinner_table_silence ──→ set dinner_started
    ├── sl_mother_extra_food ──→ set mother_extra_care
    │
    ▼ phone_incident=True 或 回合≥8
    │
lm_1_cracks (裂缝)
    │ 允许标签: act1, first_crack, transition
    │ 禁止提及: thirty_thousand, debt_amount
    │ 兜底: sl_generic_act1
    │
    ├── sl_father_phone_ring ──→ set phone_incident
    ├── sl_father_work_excuse ──→ set father_work_excuse [llm_trigger]
    ├── sl_player_notices_something_wrong ──→ set player_asked_wrong [llm_trigger]
    ├── sl_mother_slips ──→ set mother_slipped
    │
    ▼ mother_slipped=True 或 回合≥15
    │
lm_2_revelation (真相)
    │ 允许标签: act2, revelation
    │ 禁止提及: 无
    │ 兜底: sl_generic_act2
    │
    ├── sl_secret_exposed ──→ set secret_exposed [priority_override=100]
    ├── sl_father_defends ──→ set father_explained
    ├── sl_mother_three_months ──→ set mother_revealed_timing
    ├── sl_son_asked_tuition ──→ set tuition_mentioned [llm_trigger]
    │
    ▼ mother_revealed_timing=True 或 回合≥20
    │
lm_3_confrontation (摊牌)
    │ 允许标签: act3, confrontation, resolution
    │ 禁止提及: 无
    │ 兜底: sl_generic_act3
    │
    ├── sl_confrontation_silence ──→ set confrontation_started
    ├── sl_father_asks_forgiveness ──→ set father_apologized [llm_trigger]
    ├── sl_mother_decision ──→ set mother_decided
    │
    ▼ mother_decided=True 或 回合≥30
    │
[结局判定]
    ├── ending_honest_beginning: father_apologized=True ∧ mother_decided=True
    ├── ending_unresolved: marriage_tension ≥ 4
    ├── ending_son_mediated: player_mediated=True ∧ mother_decided=True
    └── ending_default: 兜底（无条件）
```

> 标注 `[llm_trigger]` 的 Storylet 需要玩家输入语义匹配才能进入候选池（由 InputParser.analyze() 统一匹配，不再单独调用 LLM）。

### 4.2 Landmark 推进语义

`Landmark.check_progression()` 的推进条件是 **OR 语义**——满足任一即推进：

```python
# 四种推进条件（任一满足即推进到 next_landmark）
1. world_state 条件:  指定 flag 全部为 True
2. or_turn_limit:     回合数达到上限（兜底防卡死）
3. or_player_input:   玩家输入匹配关键词（精确匹配）
4. llm_semantic:      玩家输入语义匹配（由 InputParser.analyze() 统一判断）
```

> `world_state` 条件用的是 **AND 语义**（字典中所有 key 都必须匹配），但当前每个 Landmark 的 world_state 条件只有一个 key，所以实际效果等同于单条件判断。

---

## 5. 数据契约

### 5.1 Storylet 字段规范

```python
{
    "id": str,                        # 唯一标识，格式 sl_xxx
    "title": str,                     # 显示标题
    "phase_tags": [str],              # 阶段标签，用于 Landmark 过滤
    "narrative_goal": str,            # 叙事目标（注入 LLM prompt）
    "conditions": [condition],        # 触发前置条件（全部满足才可触发）
    "llm_trigger": str | None,        # LLM 语义触发描述（由 InputParser.analyze() 统一匹配；有 llm_trigger 的 Storylet 必须出现在 matched_semantic_ids 中才可进入候选池）
    "content": {
        "type": "llm_prompt",         # 当前固定为 llm_prompt
        "director_note": str,         # 导演指导（注入 LLM prompt）
        "tone": str,                  # 情绪基调
        "character_focus": str,       # 已废弃，仅作 fallback 用（母线由 _decide_speakers() 决定）
        "primary_speaker": str,       # focus="both" fallback 时的默认发言人
        "allowed_behaviors": list|dict|None,  # 行为白名单（None=全部可用；dict 按角色名分组）
    },
    "effects": [effect],              # 触发时应用的效果（首次进入时执行一次）
    "conditional_effects": [cond_fx], # 条件效果（当前无 Storylet 使用）
    "repeatability": str,             # "never" / "unlimited" / "cooldown"
    "cooldown": int | None,           # 冷却回合数（cooldown 模式下生效）
    "sticky": bool,                   # 是否粘性（不会被自动切换）
    "priority_override": int | None,  # Salience 额外加成
    "salience": {
        "base": float,                # 基础分数
        "modifiers": [{               # 条件修正
            "key": str,               # 检查的 quality key
            "threshold": float,       # 阈值
            "bonus": float,           # 达到阈值加分
            "penalty": float          # 未达到扣分
        }]
    },
    "choices_hint": [str],            # 首回合提示玩家可以做什么
    "on_interrupt": str,              # 被打断时的行为（"pause"/"abort"/"continue"）
    "completion_trigger": {           # 完成触发条件
        "max_turns": int              # 在此 Storylet 中最多持续回合
    },
    "force_wrap_up": dict | None,     # 强制结束条件
    "beat_sequence": dict | None,     # Beat 序列（当前无 Storylet 使用）
    "mix_ins": [dict],                # Beat Mix-in（当前无 Storylet 使用）
}
```

### 5.2 Effect 格式

```python
# 赋值
{"key": "arrived", "op": "=", "value": True}          # 设置 flag
{"key": "current_landmark", "op": "=", "value": "lm_0_surface"}  # 设置字符串 flag

# 数值操作
{"key": "marriage_tension", "op": "+", "value": 1}    # 加
{"key": "marriage_tension", "op": "-", "value": 0.5}  # 减
{"key": "marriage_tension", "op": "max", "value": 5}  # 取大值
{"key": "marriage_tension", "op": "min", "value": 0}  # 取小值
```

> `op="="` 的类型判断：`value` 是 `bool` → 存为 flag，是 `int/float` → 存为 quality，是 `str` → 存为 flag。

### 5.3 Condition 格式

```python
# Flag 检查
{"type": "flag_check", "key": "arrived", "op": "==", "value": True}

# 数值检查
{"type": "quality_check", "key": "marriage_tension", "op": ">=", "value": 3}

# LLM 语义匹配（用于 Landmark 转场条件）
{"type": "llm_semantic", "id": "lm2→lm3a", "description": "玩家明确表达了失望或要求 Trip 道歉"}

# 支持的比较运算符: ==, !=, >, <, >=, <=
```

> `llm_semantic` 条件由 InputParser.analyze() 在语义匹配阶段统一判断，不需要单独调用 LLM。`id` 字段对应 SemanticConditionStore 中注册的条件 ID。

### 5.4 Landmark 字段规范

```python
{
    "id": str,                        # 唯一标识，格式 lm_x_xxx
    "title": str,
    "description": str,
    "phase_tag": str,                 # 阶段标签
    "order": int,                     # 排序序号
    "entry_conditions": {
        "world_state": [condition],   # 进入条件（全部满足）
        "or_player_input": [str]      # 玩家输入关键词（OR 语义）
    },
    "narrative_constraints": {
        "allowed_storylet_tags": [str],  # 允许的 Storylet 标签
        "forbidden_reveals": [str]       # 禁止 LLM 提及的关键词
    },
    "progression_rules": {
        "advance_when": {
            "world_state": {key: value},  # 推进条件（AND 语义）
            "or_turn_limit": int,          # 回合兜底
            "or_player_input": [str]       # 输入触发（OR 语义）
        },
        "next_landmark": str | None   # 下一个 Landmark ID（最后一个为 None）
    },
    "fallback_storylet": str,         # 无匹配 Storylet 时使用
    "world_state_effects_on_enter": [effect]  # 进入时自动执行
}
```

### 5.5 Ending 字段规范

```python
{
    "id": str,
    "title": str,
    "description": str,
    "conditions": [condition],        # 全部满足才触发；空列表=兜底结局
    "narrative_content": str          # 结局文本
}
```

---

## 6. WebSocket 服务器 (`ws_server.py`)

### 6.1 架构概述

```
前端 (React)  ←── WebSocket ──→  FastAPI (ws_server.py)
                                        │
                                        ├── GameSession（每连接一个）
                                        │   ├── WorldState
                                        │   ├── StoryletManager
                                        │   ├── LandmarkManager
                                        │   ├── StorySelector
                                        │   ├── DirectorAgent
                                        │   ├── InputParser + SemanticConditionStore
                                        │   ├── CharacterAgent × 2
                                        │   └── LLMClient
                                        │
                                        └── 场景数据由前端下发
```

`ws_server.py` 使用 FastAPI + uvicorn，提供：
- **WebSocket 端点** `/ws/play`：主要游戏通信通道
- **REST 端点** `/api/health`：健康检查

### 6.2 连接生命周期

```
[WebSocket 连接建立]
    │
    ├─ 前端发送 init_scene → 创建 GameSession
    │   ├── 初始化 WorldState（qualities/flags/relationships）
    │   ├── 加载 Landmarks + Storylets
    │   ├── 初始化 CharacterAgent（角色配置由前端下发）
    │   ├── 初始化 DirectorAgent
    │   ├── 选择初始 Storylet + 应用 Effects
    │   └── 返回 state_update + 开场消息
    │
    ├─ 前端发送 player_input → process_turn()
    │   ├── InputParser.analyze()（合法性检查 + 语义条件匹配）
    │   ├── hard reject → 忽略输入
    │   ├── soft reject → 角色困惑反应
    │   ├── valid → 正常流程
    │   ├── DirectorAgent.advance_turn()
    │   ├── LandmarkManager.increment_turn_count()
    │   ├── 玩家消息回显
    │   ├── 检测玩家调解行为
    │   ├── Storylet 选择/切换检查（matched_conditions 驱动）
    │   ├── LLM 生成角色响应（线程池异步）
    │   ├── Landmark 推进检查（matched_semantic_ids 驱动）
    │   └── 返回 state_update
    │
    ├─ 前端发送 debug_worldstate → apply_debug_worldstate()
    │   ├── 直接修改 WorldState
    │   ├── 触发 Landmark 推进检查
    │   ├── 触发 Storylet 选择检查
    │   └── 返回 state_update
    │
    ├─ 前端发送 reset → 清空 GameSession 状态
    │
    └─ [WebSocket 断开]
```

### 6.3 前后端通信协议

所有消息均为 JSON 格式，通过 WebSocket 双向传输。

#### 前端 → 后端

| 消息类型 | 触发时机 | 数据结构 |
|---------|---------|---------|
| `init_scene` | 进入 Play 模式时 | `{type: "init_scene", data: {landmarks: [...], storylets: [...], characters: [...], world_state_definition: {...}}}` |
| `player_input` | 玩家发送消息时 | `{type: "player_input", text: "玩家输入文本"}` |
| `debug_worldstate` | Debug 面板修改状态时 | `{type: "debug_worldstate", data: {qualities: {...}, flags: {...}, relationships: {...}}}` |
| `reset` | 点击重置按钮时 | `{type: "reset"}` |

#### 后端 → 前端

| 消息类型 | 说明 | 数据结构 |
|---------|------|---------|
| `chat` (role=player) | 玩家消息回显 | `{type: "chat", role: "player", speech: "..."}` |
| `chat` (role=trip/grace) | 角色响应 | `{type: "chat", role: "trip", speaker_name: "Trip", speech: "...", action: "...", thought: "..."}` |
| `chat` (role=narrator) | 旁白 | `{type: "chat", role: "narrator", speech: "..."}` |
| `chat` (role=system) | 系统提示 | `{type: "chat", role: "system", speech: "[Storylet] ..."}` |
| `state_update` | 状态快照 | `{type: "state_update", world_state: {...}, current_landmark_id, current_landmark: {...}, current_storylet_id, current_storylet: {...}, turn, game_ended}` |
| `error` | 错误 | `{type: "error", message: "..."}` |

#### state_update 详细结构

```json
{
  "type": "state_update",
  "world_state": {
    "qualities": {"marriage_tension": 2.5},
    "flags": {"arrived": true, "phone_incident": false},
    "relationships": {"trip_grace": -1.5}
  },
  "current_landmark_id": "lm_0_surface",
  "current_landmark": {
    "id": "lm_0_surface",
    "title": "表面平静",
    "phase_tag": "act1",
    "is_ending": false
  },
  "current_storylet_id": "sl_welcome_home",
  "current_storylet": {
    "id": "sl_welcome_home",
    "title": "回家",
    "narrative_goal": "让 Trip 和 Grace 表现出热情好客的姿态...",
    "phase_tags": ["act1", "surface"]
  },
  "turn": 5,
  "game_ended": false
}
```

### 6.4 LLM 初始化策略

```python
# ws_server.py 的 LLM 初始化流程：
1. 尝试 import LLMClient
2. 加载 .env.local / .env 中的 OPENAI_API_KEY
3. 读取 OPENAI_MODEL（默认 gpt-4o-mini）
4. 创建 LLMClient + DirectorAgent

# 如果 OPENAI_API_KEY 不存在：
# - LLMClient 抛出 RuntimeError
# - ws_server 捕获，打印提示
# - 以"无 LLM 模式"运行（仅 WorldState/Storylet/Landmark 调度可用）
```

### 6.5 角色配置下发

CharacterAgent 不再使用硬编码角色配置，而是由前端在 `init_scene` 时下发：

```python
# _init_characters_from_scene() 从前端数据构造 character_profile：
profile = {
    "name": "Trip",
    "identity": "Trip 全名 Travis...",
    "personality": "表面热情好客...",
    "background": [...],
    "secret_knowledge": [...],
    "ng_words": [...],
    "monologue_knowledge": [...],  # IBSEN Monologue 模板
    "behaviors": [...],            # 行为库（前端下发）
    "behavior_meta": {...},
}
```

### 6.6 发言角色决策（Director 统一决策）

发言决策由 `DirectorAgent.decide_speakers()` 统一处理（不再在 ws_server 中独立调用 LLM），利用 Director 的全局叙事视野：

**调用链**：
```
ws_server._decide_speakers()
    └── self.director_agent.decide_speakers()
        ├── 分析最近 8 条对话的发言分布（防止垄断）
        ├── 检测玩家点名（trip/特拉维斯/grace/格蕾丝）
        └── LLM 综合判断（叙事目标 + 发言平衡 + 点名 + 自然度）
```

**五级优先级规则**：
1. **玩家点名** → 被点名的角色必须回应，不能被另一个角色代替
2. **对话平衡** → 如果某角色最近说话过多（差值 > 2），优先让另一个角色回应
3. **叙事目标** → 回应应服务于当前 Storylet 的 narrative_goal
4. **自然度** → 通常 1 人回应最自然；2 人回应需要理由
5. **沉默的权利** → 另一个角色可以选择不说话、只做肢体动作

**Fallback 链**（Director/LLM 不可用时）：
```
Director.decide_speakers() LLM 失败
    → 先检测玩家点名关键词
    → 再看 character_focus 字段
    → 兜底 primary_speaker + secondary
```

关键设计点：
- 发言分布统计取最近 8 条历史，Trip/Grace 发言差 > 2 时触发平衡干预
- **只给被选中的角色生成 Director 指令**，避免浪费 API 调用
- **第二个角色收到追加指令**：「不要重复对方的内容」
- ws_server 的 `_decide_speakers()` 现在只是薄代理层，实际逻辑全部在 DirectorAgent

### 6.7 异步策略

LLM 调用是同步的（OpenAI SDK），ws_server 使用 `asyncio.run_in_executor()` 放入线程池，避免阻塞事件循环：

```python
response_msgs = await loop.run_in_executor(
    None,
    partial(self._generate_storylet_response, self.current_storylet, player_input)
)
```

---

## 7. 核心模块说明

### 7.1 游戏主循环 (`main.py`)

每个回合的执行流程：

```
玩家输入
    │
    ▼
1. Beat 模式？──是──→ BeatManager.execute_next()
    │ 否
    ▼
2. InputParser.validate_input()  （规则过滤 + LLM 合法性检查）
    │
    ▼
3. _check_player_mediation()  （Act3 检测调解行为）
    │
    ▼
4. _execute_storylet()
    ├── _decide_speakers()   ← DRAMA LLAMA：LLM 自决本轮发言角色
    └── for each speaker:
            _generate_character_response()
                ├── _generate_inner_thought()  ← Step 0：内心独白
                ├── _select_behavior()         ← Step A：行为选择
                └── chat_completion()          ← Step B：台词/动作生成
    │
    ▼
5. Landmark 推进检查
    │
    ▼
6. Storylet 切换检查（默认 5 回合后切换）
    │  首次进入新 Storylet 时：_apply_storylet_effects()
    │
    ▼
7. 结局检查（仅在 lm_3_confrontation 时）
```

### 7.2 Storylet 选择 (`story_selector.py`)

三层过滤：

```
所有 Storylet
    │
    ├─ Step 1: 标签过滤 ── current_landmark.allowed_storylet_tags
    │
    ├─ Step 2: 条件过滤 ── storylet.can_trigger() [flag/quality/cooldown]
    │              + llm_trigger 语义匹配 ← 由 InputParser.analyze() 统一完成
    │              （有 llm_trigger 的 Storylet 必须出现在 matched_semantic_ids 中）
    │
    ├─ Step 3: Salience 评分 ── base + modifiers
    │              + priority_override（sl_secret_exposed = 100）
    │
    ├─ Step 4: LLM 评估 ── 取 Top-3 交给 LLM 选最优（当前关闭：use_llm_evaluator=False）
    │
    └─ 无候选时：使用 current_landmark.fallback_storylet
```

### 7.3 角色生成 (`llm_client.py`) — 三步生成架构

`CharacterAgent.generate_response()` 实现三步生成，参考 DRAMA LLAMA + StoryVerse + IBSEN：

#### Step 0：内心独白（`_generate_inner_thought()`）
- **目的**：让角色先想后说，支持心口不一
- **Temperature**：0.75（保留情感张力）
- **max_tokens**：80
- **输出**：1-2 句第一人称真实内心想法
- **注入**：作为上下文传入 Step B，不对外显示（调试模式 `[thought]` 前缀）

**Monologue 选择策略**（`_select_relevant_monologue()`）：
1. 扫描 `player_input` 中的关键词，映射到 Monologue 类别（核心秘密/心理博弈/心理压抑/认知盲区/临界状态/现实压力）
2. 检查 `world_state.emotional_state[character]` 情绪映射
3. 有关键词/情绪匹配 → 选择对应类别的 Monologue
4. 无匹配 → LLM 选择（`_llm_select_monologue`，temperature=0.3）
5. 最终兜底 → 返回 `monologue_knowledge[0]`

**Step 0 Prompt 结构**（策略1：有 Monologue）：
```
你是戏剧角色 {character}。

【身份背景】{identity}
【你内心深处的声音】{monologue.monologue}
【本幕叙事目标】{narrative_goal}
【导演说明】{director_note}
【当前情绪标签】{emotion_tags}

最近的对话：{近4条}

刚才你的大学老友（玩家）说："{player_input}"

现在，请基于你"内心深处的声音"，用第一人称写出你此刻真实的内心想法（1-2句话）。
- 这是内心独白，不是说出口的话
- 可以和你即将说的话相矛盾
- 反映你当前最真实的情绪、顾虑或打算
```

**Step 0 Prompt 结构**（策略2：无 Monologue，fallback）：
```
你是戏剧角色 {character}。

【身份】{identity}
【你内心知道的秘密/隐情】{secret_knowledge 列表}
【本幕叙事目标】{narrative_goal}
【导演说明】{director_note}

最近的对话：{近4条}

刚才你的大学老友（玩家）说："{player_input}"

现在，请用第一人称写出你此刻真实的内心想法（1-2句话）。
```

#### Step A：行为选择（`_select_behavior()`）
- **目的**：从行为库选择一个叙事行为 ID（StoryVerse Action Schema 风格）
- **行为库来源**：前端 `character_profile.behaviors`（ID 列表）+ `character_profile.behavior_meta`（元数据字典）
- **Temperature**：0.1（确定性选择）
- **max_tokens**：20
- **约束**：Storylet 可通过 `allowed_behaviors` 字段限制可用行为列表
- **输出**：行为 ID（如 `"deflect"`, `"cold_truth"`, `"apologize"`）
- **Fallback**：行为库未加载时返回 `"surface_normal"`

**Step A Prompt 结构**：
```
你是戏剧角色 {character}。

角色性格：{personality}
叙事目标：{narrative_goal}
导演指导：{director_note}
玩家（你的大学老友）刚刚说："{player_input}"
最近对话：{近3条}

请从以下行为列表中选择一个最适合当前情境的行为，只输出行为的英文 ID：

{编号列表，每条格式：N. {id}（{label}）：{description}}

你的选择（只输出 ID）：
```

**输出解析**：严格匹配 → 子串匹配 → 兜底 `surface_normal`

#### Step B：台词/动作生成（`generate_response()` 主体）
- **Temperature**：0.6
- **输出格式**：`{"speech": str, "action": str}`（JSON）
- **返回值**：`{"thought": str, "speech": str, "action": str, "emotion_tags": list}`

**Step B System Prompt 完整结构**：
```
你是一场戏剧中的角色：{character}。和你在一起的是你的配偶以及你们共同的大学老友（玩家）。

【身份】{identity}
【性格】{personality}
【背景】{background 列表}
【你知道的/你不知道的】{secret_knowledge 列表}

【当前场景与叙事目标】
{narrative_goal}

你的每一句台词和每一个动作都必须服务于这个叙事目标。思考：
- 你在这个场景中要制造/维持/打破什么？
- 你的言行如何让这个目标更近一步？
- 如果目标是制造紧张感，不要轻易化解矛盾；如果目标是掩盖秘密，不要主动透露。

【导演指导】{director_note}
【情绪基调】{tone}                                    ← 由 Step A 的 tone_hint 覆盖
【当前行为模式】{selected_behavior}（{label}）        ← Step A 输出
执行方式：{behavior.description}
情绪基调覆盖：{behavior.tone_hint}
【额外指令】{director_instruction}                     ← DirectorAgent 生成
【绝对禁止】...禁止话题列表...                         ← forbidden_reveals
【你此刻内心真实想法】{inner_thought}                 ← Step 0 输出
（注意：你不会直接说出内心想法，你的言行可以和内心相矛盾）

【关键指令】
1. 对话历史的最后一行是玩家（你的大学老友）刚刚说的话，你的回复必须直接回应这一行。
2. 不要重复你之前说过的话，不要回答历史中更早的问题。
3. 只输出 JSON，不要有任何其他文字。
4. 只能扮演 {character}，不能扮演其他角色。
5. 你在和一个老朋友说话，语气要自然——像真实的人一样对话，不要过于正式或戏剧化。

JSON 格式：
{"speech": "你说的话", "action": "*动作描述*"}
```

#### 对话历史构建（`_build_dialogue_history_for_actor()`）

IBSEN 风格的历史构建，关键机制是 **`__INPUT__` 待回复行**：

```python
# 取最近 6 条对话历史
for line in history[-6:]:
    if ": " in line:
        role, content = line.split(": ", 1)
        structured.append({"role": role, "content": content})

# 玩家输入作为末尾待回复行（IBSEN 核心机制）
structured.append({"role": "__INPUT__", "content": f"玩家: {player_input}"})
```

**映射到 OpenAI messages**：
| 历史角色 | OpenAI role | content 格式 |
|---------|-------------|-------------|
| `self.character`（自身） | `assistant` | 原始内容 |
| `旁白` | `user` | `（{content}）` |
| `__INPUT__`（玩家输入） | `user` | `玩家: {player_input}` |
| 其他角色 | `user` | `{role}: {content}` |

> 自身的对话映射为 `assistant`，其他所有人的对话（包括旁白和玩家）映射为 `user`。这使得 LLM 天然理解"我要接在哪些话后面说"。

#### IBSEN 式质量防护

```
LLM 原始输出
    │
    ├── _generate_with_ng_retry()
    │   └── 检测 NG words → 重试（最多 3 次），重试时追加 system 提示
    │
    ├── _verify_and_fix_response()
    │   ├── Step 1: NG words 二次检查 → 重试
    │   ├── Step 2: 关键词冲突检测（玩家问A但回B）→ 重试（temperature=0.3）
    │   └── Step 3: JSON 格式校验 → 重试
    │
    ├── _parse_speech_action()
    │   ├── 标准 JSON → 直接解析
    │   ├── Markdown 代码块 → 去除 ``` 包裹
    │   └── 非 JSON → 全部作为 speech，action 为空
    │
    ├── _is_too_similar() 重复检测
    │   └── 字符重叠率 > 50% → 截断历史重生成（只保留 system + 最后 2 条）
    │
    └── _strip_name_prefix()
        └── 清理 LLM 自加的角色名前缀（trip:/grace:/特拉维斯:/格蕾丝: 等）
```

### 7.4 发言角色决策 (`main.py._decide_speakers()`) — DRAMA LLAMA 风格

```python
# 每轮由 LLM 决定哪个（些）角色回应
speakers = _decide_speakers(player_input, storylet_content, parsed_input)
# 返回：["trip"] 或 ["grace"] 或 ["grace", "trip"] 等
# 失败时 fallback 到旧的 character_focus 字段（向后兼容）
```

- 使用 `call_llm(prompt, max_tokens=20, temperature=0.2)` 调用
- 第二个角色收到追加指令：「不要重复对方的内容，可以沉默、肢体回应或简短说话」
- 玩家输入在循环外统一记录到对话历史，避免重复

### 7.5 角色叙事行为库 (`data/character_behaviors.py`) — 已实现

StoryVerse Action Schema 设计，将角色可执行行为显式定义为有限集合：

| 行为 ID | 归属 | 标签 | Salience Boost |
|---------|------|------|---------------|
| `deflect` | 共用 | 转移话题 | 0 |
| `go_quiet` | 共用 | 沉默 | 1 |
| `make_excuse` | 共用 | 找借口 | 0 |
| `ask_player` | 共用 | 求助/询问 | 2 |
| `surface_normal` | 共用 | 维持表面正常 | 0 |
| `subtle_hint` | 共用 | 话里有话 | 2 |
| `admit` | Trip | 承认真相 | 5 |
| `get_angry` | Trip | 情绪爆发 | 3 |
| `apologize` | Trip | 道歉 | 5 |
| `shut_down` | Trip | 彻底关闭 | 1 |
| `cold_truth` | Grace | 冷静说出真相 | 5 |
| `care_through_action` | Grace | 用行动表达关心 | 1 |
| `controlled_sarcasm` | Grace | 克制的讽刺 | 2 |
| `withdraw` | Grace | 情感撤退 | 1 |
| `break_down` | Grace | 情绪崩溃 | 4 |

### 7.6 InputParser (`core/input_parser.py`) — 玩家输入守门人

InputParser 是玩家输入进入系统的统一入口，承担两大职责：

#### 职责 1：输入合法性检查（`validate_input()`）

检测破坏叙事体验的输入，两层过滤：

```
玩家输入
    │
    ▼
第一层：规则快速过滤（零成本）
    ├── Meta 输入（"你是AI/游戏"）→ soft reject, response_mode=deflect
    ├── 物理违规（砸/打/跳窗）     → hard reject, response_mode=ignore
    └── 超长输入（>200字符）       → soft reject, response_mode=confused
    │ 规则层无法判断
    ▼
第二层：LLM 语义判断
    └── 场景约束 + 当前语境 → valid/severity/reason
```

**分发策略**：
| 结果 | severity | 系统行为 |
|------|----------|---------|
| hard reject | hard | 忽略输入，不生成角色响应 |
| soft reject | soft | 角色困惑反应（注入 Director 指令） |
| valid | — | 正常流程 |

#### 职责 2：语义条件匹配（`analyze()`）

将 Storylet `llm_trigger` 和 Landmark 转场的语义条件合并为**一次 LLM 调用**：

```
InputParser.analyze(player_input, conditions, context)
    │
    ├── conditions 为空？→ 只做合法性检查
    │
    ├── 规则层 hard reject？→ 直接返回，不过滤条件
    │
    └── LLM 统一判断：
        ├── 任务1：输入是否合法？
        └── 任务2：匹配哪些语义条件？（返回条件编号列表）
            → 映射回 matched_semantic_ids
```

**剪枝策略**：只收集当前 Landmark 范围内的语义条件（当前阶段 Storylet 的 `llm_trigger` + 出边 Landmark 的语义条件），通常 2~15 条，无需向量检索。

**条件来源**（`_collect_semantic_conditions()`）：
```python
conditions = []
# 1. 当前 Landmark 下所有候选 Storylet 的 llm_trigger
for storylet in candidates:
    if storylet.llm_trigger:
        conditions.append(SemanticCondition(
            id=storylet.id,
            source_type="storylet",
            description=storylet.llm_trigger
        ))
# 2. 当前 Landmark 出边的 llm_semantic 条件
for transition in current_landmark.transitions:
    for cond in transition.conditions:
        if cond.type == "llm_semantic":
            conditions.append(SemanticCondition(
                id=cond.id,
                source_type="landmark_transition",
                description=cond.description
            ))
```

**matched_semantic_ids 的下游消费者**：
- `StorySelector.select(matched_semantic_ids=...)` → 有 `llm_trigger` 的 Storylet 必须在列表中
- `LandmarkManager.check_progression(matched_semantic_ids=...)` → `llm_semantic` 条件必须匹配

#### SemanticConditionStore — 条件索引接口

```python
class SemanticConditionStore:
    """语义条件索引。
    当前实现：全量列表存储，search() 返回全部。
    未来实现：替换为向量检索（cosine similarity top-k），上层代码无需改动。
    """
    def add(condition: SemanticCondition)      # 注册一条条件
    def add_many(conditions: List[...])        # 批量注册
    def remove(condition_id: str)              # 移除一条
    def remove_by_prefix(prefix: str)          # 按前缀批量移除（Landmark 切换时）
    def search(query: str, top_k: int)         # 检索相关条件（当前返回全部）
    def clear()                                # 清空
```

#### 数据结构

```python
@dataclass
class SemanticCondition:
    id: str                    # 唯一标识，如 "sl_push_trip" 或 "lm2→lm3a"
    source_type: str           # "storylet" | "landmark_transition"
    description: str           # 自然语言描述（用于 LLM 判断 / embedding）
    metadata: Dict[str, Any]   # 扩展元数据
```

#### 设计决策

- **不再做结构化意图分类**（intent/target/topic_tags）：CharacterAgent 和 Director 会自行理解玩家原文，结构化输出无人消费
- **合并为一次 LLM 调用**：旧设计中每个 `llm_trigger` Storylet 单独调一次 LLM，现在 analyze() 合并判断，N 次 → 1 次
- **向量检索预留接口**：SemanticConditionStore 的 search() 接口保持不变，当前全量列表实现，未来可替换为向量检索

### 7.7 Beat 系统 (`beat.py`) — 已实现但未启用

代码完整，`BeatManager.execute_next()` 已在主循环中接入，但当前没有 Storylet 挂载 Beat 序列。设计用于精确编排关键叙事节点的 NPC 对话顺序（参考 Facade 原作）。

---

## 8. DirectorAgent (`agents/director.py`) — IBSEN 导演-演员系统

### 8.1 设计理念

参考 IBSEN 论文的 Director-Actor 分离架构，但做了关键调整：

| 维度 | IBSEN | FacadeRemake |
|------|-------|-------------|
| Director 输出 | 完整剧情脚本（outline） | 指导性指令（instruction） |
| Actor 自由度 | 严格执行脚本 | 有自由度，但服务于叙事目标 |
| 控制方式 | 直接控制台词 | 间接控制——提供方向 |

### 8.2 核心组件

#### GoalTracker（目标追踪器）

```python
@dataclass
class NarrativeGoal:
    id: str
    description: str               # 叙事目标描述（来自 Storylet.narrative_goal）
    target_turns: int = 5          # 预期完成回合数
    current_turns: int = 0
    status: GoalStatus             # IN_PROGRESS / NEARLY_COMPLETE / COMPLETE / FAILED
    interventions: int = 0         # 干预次数（≥3 则标记 FAILED）
    checkpoints: List[str]         # 目标检查点
```

- `set_goal()`：Storylet 切换时由 ws_server/main.py 调用
- `advance_turn()`：每回合调用一次
- `check_completion()`：可使用 LLM 判断目标是否真正完成

#### InstructionGenerator（指导生成器）

生成 `DirectorInstruction` 对象，包含：

| 字段 | 说明 |
|------|------|
| `primary_goal` | 当前主要目标（来自 Storylet.narrative_goal） |
| `tone_guidance` | 情绪基调指导（映射中文 tone → 具体描述） |
| `narrative_beat` | 叙事节奏：push / maintain / release / accelerate |
| `character_specific` | 针对角色的指导（来自 allowed_behaviors dict） |
| `forbidden_topics` | 禁止话题列表 |
| `optional_motivation` | 角色动机提示（内心独白引导） |
| `pacing_note` | 节奏提示 |

叙事节奏判断逻辑：
- 叙事目标含"揭露/摊牌" + 高张力 → `push`
- 叙事目标含"维持/掩盖" → `maintain`
- 叙事目标含"道歉/原谅" → `release`
- Storylet 回合 ≥ 4 → `accelerate`
- 其他 → `maintain`

#### DirectorAgent（协调器）

```python
class DirectorAgent:
    def __init__(self, llm_client=None)
    def set_current_goal(self, narrative_goal, target_turns)  # Storylet 切换时调用
    def advance_turn(self)                                     # 每回合调用
    def generate_instruction_for(self, character, ...) -> str  # 生成导演指导
    def check_and_update_goal(self, world_state, history) -> (bool, str)  # 检查目标状态
```

有两种指导生成模式：
1. **LLM 模式**（`use_llm=True`）：调用 `generate_llm_instruction()`，LLM 生成精细导演指导
2. **规则模式**（`use_llm=False`）：纯规则生成，不消耗 API 调用

### 8.3 发言决策（`decide_speakers()`）

`DirectorAgent.decide_speakers()` 是 DRAMA LLAMA 风格的发言角色决策器，2026-04-22 从 ws_server 独立 call_llm 迁移到 DirectorAgent：

```python
speakers = director.decide_speakers(
    player_input, storylet_content, dialogue_history, characters=["trip", "grace"]
)
# 返回：["trip"] 或 ["grace"] 或 ["grace", "trip"]
```

与 `generate_instruction_for()` 共享 Director 的全局状态（叙事目标、对话历史），使发言决策和角色指导保持一致。详见第 6.6 节。

### 8.4 集成点

```
Storylet 切换时:
    → director.set_current_goal(storylet.narrative_goal)

每回合处理时:
    → director.advance_turn()
    → speakers = director.decide_speakers(player_input, storylet_content, history)
    → 对每个 speaker:
        → 指令 = director.generate_instruction_for(speaker, ...)
        → 注入 CharacterAgent.generate_response() 的 director_instruction 参数
```

---

## 9. 角色配置 (`config/characters.py`)

### 9.1 共享秘密上下文

```python
SHARED_CONTEXT = {
    "marriage_secret": {
        "grace_affair_with_vince": True,          # Grace 与 Vince 发生过关系
        "trip_also_had_affair": True,             # Trip 也有婚外情
        "grace_doesnt_know_trip_affair": True,    # Grace 不知道 Trip 的婚外情
        "trip_cant_stand_grace_being_artist": True, # Trip 无法接受 Grace 做艺术家
        "class_difference": True,                 # 阶层差异
    }
}
```

### 9.2 角色档案（CHARACTER_PROFILES）

#### Trip（特拉维斯）

| 维度 | 内容 |
|------|------|
| identity | 30岁，普通家庭出身，金融行业，Grace 的丈夫 |
| personality | 表面热情好客、幽默健谈，实际防御性强，被动攻击，自卑 → 控制欲 |
| background | 出身普通家庭、追求物质成功、结婚约八年、也有婚外情 |
| secret_knowledge | 他也有婚外情（Grace 不知道）、一直无法接受 Grace 作为艺术家 |
| ng_words | "亲爱的"、"宝贝"、"语言模型"、"AI"、"助手"、"作为你的"、"让我们一起来"、"深呼吸" |

#### Grace（格蕾丝）

| 维度 | 内容 |
|------|------|
| identity | 30岁，富裕家庭出身，有才华的艺术家，Trip 的妻子 |
| personality | 表面友好优雅，内心积压不满，被娇生惯养，冷冰冰直击要害 |
| background | 富裕家庭、艺术天赋、结婚约八年、与 Vince 发生过关系 |
| secret_knowledge | 与 Vince 在 Trip 求婚前一晚发生了关系、被婚姻扼杀了艺术才华 |
| ng_words | "我好生气啊"、"气死我了"、"我要离婚"、"语言模型"、"AI"、"助手" |

### 9.3 IBSEN Monologue 模板

每个角色 2 条独白模板，用于内心独白生成（三步生成的 Step 0）：

| ID | 角色 | ref_secret | 类别 | 核心情绪 |
|----|------|-----------|------|---------|
| `mon_trip_affair` | Trip | 婚外情 | 核心秘密 | 愧疚、自我辩护 |
| `mon_trip_class_shame` | Trip | 贫困出身羞耻 | 深层创伤 | 自卑、不甘 |
| `mon_grace_vince` | Grace | 与 Vince 的关系 | 核心秘密 | 内疚、恐惧 |
| `mon_grace_smothered` | Grace | 艺术才华被扼杀 | 心理压抑 | 失落、压抑的愤怒 |

每条模板包含：`ref_secret`（关联的秘密知识）、`category`（分类标签）、`monologue`（第一人称独白文本）、`emotion_tags`（情绪标签）。

---

## 10. 已知问题与技术债

### ✅ 已修复（全部）

### 🟡 低优先级待改进

#### 10.10 LLM 评估器默认关闭
- `story_selector.py:20` 的 `use_llm_evaluator = False`
- 评估器代码已实现（`_llm_evaluate_candidates()`），直接改为 `True` 即可启用
- 建议在全部主线剧情调试通过后再开启

#### 10.11 Beat 系统未挂载叙事数据
- Beat 执行路径已完整实现
- 适合在关键节点（如母亲说漏嘴 `sl_mother_slips`）使用精确台词编排
- `PARALLEL/WAIT` BeatType 框架存在但代码路径不完整

#### 10.12 `WorldState.narrative_placeholders` 未实现
- ARCHITECTURE.md 9.4 节建议新增此字段（StoryVerse 跨 Storylet 叙事一致性）
- 当前用 flags 代替，后续可正式加入

#### 10.13 输出中角色名显示为英文
- `main.py` 中 print 使用 `"father"` / `"mother"` 而非 `"赵建国"` / `"林美华"`
- 不影响功能，影响游玩体验

---

## 11. 运行方式

```bash
cd prototype/facade_remake

# 命令行模式（CLI）
python main.py              # LLM 模式（需 OPENAI_API_KEY）
python main.py --debug       # 调试模式
python main.py --no-debug    # 关闭调试输出

# WebSocket 服务器模式（前后端联调）
cd prototype
pip install -r requirements.txt  # fastapi, uvicorn, python-dotenv, openai
python ws_server.py              # 启动在 ws://localhost:8000/ws/play
```

调试模式额外输出：
- `[DEBUG]` 输入解析结果
- `[DRAMA]` 本轮发言角色决策
- `[thought]` 角色内心独白
- `[behavior]` 角色行为选择
- `[llm_trigger]` 语义触发判断结果
- `💭 [xxx 内心]` 内心独白（带情感符号）
- Storylet 开始/结束/Landmark 阶段总结

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OPENAI_API_KEY` | OpenAI API key | 无（无 LLM 时 InputParser 合法性检查规则层仍工作，LLM 相关功能不可用） |
| `OPENAI_MODEL` | LLM 模型名称 | `gpt-4o-mini` |

可在 `prototype/.env.local` 或 `prototype/.env` 中配置。

---

## 12. 架构层级（四层叙事控制粒度）

```
┌────────────────────────────────────────────────────────┐
│  Layer 1: Landmark 层（剧情阶段级）                     │
│  · 4个阶段：lm_0→lm_1→lm_2→lm_3→结局                  │
│  · 控制允许哪些 Storylet 标签                            │
│  · 控制禁止 LLM 提及的信息                               │
├────────────────────────────────────────────────────────┤
│  Layer 2: Storylet 层（场景片段级，3-8轮对话）           │
│  · 15个具体事件 + 3个兜底 = 18个 Storylet               │
│  · 条件过滤 + llm_trigger 语义匹配 + Salience 评分        │
│  · allowed_behaviors 约束角色可执行的行为                 │
├────────────────────────────────────────────────────────┤
│  Layer 3: Character Agent 层（台词/动作级）              │
│  · 三步生成：内心独白 → 行为选择 → 台词/动作             │
│  · IBSEN 式 NG 重试 + 重复检测                           │
│  · 心口不一（thought ≠ speech）                          │
├────────────────────────────────────────────────────────┤
│  Layer 4: Input Parser 层（语义级）                      │
│  · 合法性检查：规则过滤 + LLM 语义判断（meta/暴力/语境）   │
│  · 语义条件匹配：Storylet llm_trigger + Landmark llm_semantic│
│  · analyze() 一次 LLM 调用完成合法性 + 匹配              │
│  · SemanticConditionStore 预留向量检索接口               │
└────────────────────────────────────────────────────────┘
```

---

## 13. 设计参考

| 资料 | 来源 | 核心贡献 |
|------|------|----------|
| Facade 原作论文 | Mateas & Stern | Beat/Storylet 架构、社交游戏理论 |
| 调研笔记.pdf | 项目内 | QBN/Salience/Waypoint、DRAMALLLAMA、Dramamancer、Triangle Framework |
| IBSEN 论文 | — | NG 重试、结构化对话历史、重复检测 |
| StoryVerse 论文 | Wang et al., 2024 | Action Schema（行为库）、占位符机制 |
| DRAMA LLAMA 框架 | — | 自然语言 Trigger、角色自决发言顺序 |
| Piloto 2025 | — | 间接控制哲学、角色记忆模块 |
| Wu 2025 | — | Hybrid 架构、Plot-based Reflection |
| NarrativeGenie 2024 | Kumaran et al. | Beat 依赖图、Adaptive Dialogue Manager |
| De Lima 2021 | — | Story Arc 张力曲线、自适应干预机制 |
