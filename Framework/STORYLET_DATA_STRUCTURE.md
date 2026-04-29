# Storylet 数据结构详解 v0.3

> 基于 FacadeRemake 架构框架，详细拆解 Storylet 的每个字段设计。
> 最后更新：2026-04-23 | 状态：与原型代码同步

---

## 一、整体字段一览

```
┌─────────────────────────────────────────────────────────────────┐
│                         Storylet                                │
│                                                                 │
│  标识类   id, title, phase_tags                                  │
│  意图类   narrative_goal                                         │
│  前置类   conditions, llm_trigger                               │
│  内容类   content                                               │
│  后置类   effects                                               │
│  调度类   repeatability, salience, sticky, cooldown             │
│  演出类   on_interrupt                                         │
│  结束类   completion_trigger, force_wrap_up                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、逐字段详解

### 🏷️ 标识类

```json
"id": "sl_grace_hinting_at_secret",
"title": "Grace 的欲言又止",
"phase_tags": ["act1", "tension_building"],
"is_landmark": false
```

**`id`**：全局唯一标识符，命名规范建议 `sl_[角色/场景]_[事件描述]`，方便调试和日志追踪。

**`phase_tags`**：决定这个 Storylet **属于哪个叙事阶段**。它不是触发条件，而是一种软分类标签，用于：
- Landmark 系统快速筛选候选集（"只从 act2 里选"）
- 叙事设计师管理和检索

> **注意**：`phase_tags` ≠ 触发条件。一个 Storylet 有 `act1` 标签，但只要 conditions 满足，act2 时一样可以触发——标签只是语义分组，真正限制触发时机的是 `conditions`。

**`is_landmark`**：标记该 Storylet 是否是主线锚点节点（Landmark）。Landmark 节点通常有更高的 `priority_override`，确保主线推进。

---

### 🎯 意图类

```json
"narrative_goal": "玩家感知到 Grace 想说什么但被 Trip 打断"
```

**`narrative_goal`**：这个字段不给 LLM 用，是给**叙事设计师自己看**的文档字段，用一句话描述"这个单元执行完之后玩家应该得到什么体验/信息"。

这对应设计哲学里那条原则：**每个 Storylet 给玩家一个明确的叙事目标感**。它也可以被注入进 Director Note，作为 LLM 生成内容时的隐性目标约束。

---

### ✅ 前置类（Preconditions）

这是 Storylet 能否进入候选池的**硬性门槛**，分两种：

#### `conditions`：基于世界状态的规则判断

```json
"conditions": [
  { "type": "quality_check", "key": "story_phase",  "op": ">=", "value": 1 },
  { "type": "quality_check", "key": "grace_trust",  "op": ">=", "value": 3 },
  { "type": "flag_check",    "key": "secret_hinted","op": "==", "value": false }
]
```

三种典型的 condition 类型：

| type | 用途 | 例子 |
|------|------|------|
| `quality_check` | 检查数值型变量 | `trip_anger >= 5` |
| `flag_check` | 检查布尔/枚举标记 | `secret_hinted == false` |
| `relation_check` | 检查关系变量 | `player_trust_grace >= 4` |

---

#### `llm_trigger`：语义匹配触发

这是 DRAMALLLAMA 论文里的思路——**用自然语言描述触发语境**，交给 LLM 来判断"当前玩家输入是否匹配"。

```json
"llm_trigger": "玩家是否在尝试与 Grace 单独交流，或者话题涉及了婚姻关系？"
```

它的意义在于：规则 conditions 负责"是否到了这个阶段"，`llm_trigger` 负责"玩家当前的话题/意图是否与这个 Storylet 相关"。

二者是 **AND 关系**：

```
进入候选池的条件 = conditions 全部通过 AND llm_trigger 在 matched_semantic_ids 中
```

> `llm_trigger` 是可选字段。对于不需要语义匹配的 Storylet（比如 Landmark 强制触发的），可以留空。

**实现方式**（2026-04-23 重构）：
- `llm_trigger` 的匹配由 `InputParser.analyze()` 统一完成，不再单独调用 LLM
- 有 `llm_trigger` 的 Storylet 必须出现在 `matched_semantic_ids` 中才可进入候选池
- 旧设计中每个 `llm_trigger` Storylet 单独调一次 LLM，现在合并为 1 次

---

### 📝 内容类

```json
"content": {
  "type": "llm_prompt",
  "director_note": "Grace 想透露一些关于婚姻问题的信息，但 Trip 会打断。这一幕应该制造悬念和压迫感。",
  "tone": "tense, slightly desperate",
  "character_focus": "Grace",
  "allowed_behaviors": ["cold_truth", "subtle_hint", "go_quiet"]
}
```

**`type`**：目前主要是 `llm_prompt`，但可以扩展：
- `scripted`：完全硬编码的台词（用于非常关键的 Landmark 节点）
- `template`：有变量槽的台词模板，填入世界状态变量
- `llm_prompt`：给 LLM 导演指令，角色自由生成

**`director_note`**：注入给角色 Agent 的"导演指令"，是内容生成的核心约束。它告诉 LLM：
- 这一幕的**戏剧目的**是什么
- 角色**应该做什么**（但不是说什么）
- 什么信息**不能泄露**

**`tone`**：情绪基调，辅助 LLM 调整用词风格。

**`character_focus`**：⚠️ **已废弃**（保留作 fallback）。现在每轮由 `_decide_speakers()` 让 LLM 动态决定哪个角色发言，无需预设。当 LLM 决策失败时，才 fallback 到此字段。

**`allowed_behaviors`**：约束本 Storylet 中角色可使用的行为白名单（来自 `data/character_behaviors.py`）。
- `null` / 不设置 = 全部行为可用
- `["cold_truth", "go_quiet"]` = 只允许这两种行为
- `{"father": [...], "mother": [...]}` = 按角色分别约束（如 `sl_son_asked_tuition`）

**`forbidden_reveals`**：已移至 Landmark 层（`narrative_constraints.forbidden_reveals`），Storylet 不再重复设置。

---

### ⚡ 后置类（Effects）

```json
"effects": [
  { "key": "secret_hinted",          "op": "=",  "value": true },
  { "key": "grace_trust",            "op": "+",  "value": 1   },
  { "key": "relationship_crisis_level","op": "+", "value": 0.5 }
]
```

Storylet 执行完成后对世界状态的**修改指令**，直接操作 World State 的 qualities 和 flags。

支持的 `op` 类型：

| op | 含义 |
|----|------|
| `=` | 赋值（适合 flag 类） |
| `+` | 增加 |
| `-` | 减少 |
| `*` | 乘以（少用，适合衰减） |
| `max/min` | 上下限钳制 |

#### 条件性 Effects

根据 LLM 生成内容的结果分支：

```json
"conditional_effects": [
  {
    "trigger": "玩家在这一幕追问了 Grace",
    "effects": [{ "key": "grace_trust", "op": "+", "value": 2 }]
  }
]
```

---

### 🔄 调度类

```json
"repeatability": "never",

"salience": {
  "base": 8,
  "modifiers": [
    { "key": "grace_intimacy", "threshold": 4, "bonus": 3 },
    { "key": "trip_anger",     "threshold": 5, "penalty": -2 }
  ]
}
```

#### `repeatability`

| 值 | 含义 |
|----|------|
| `"never"` | 只能触发一次（适合揭露类剧情） |
| `"unlimited"` | 可以无限重复（适合闲聊类） |
| `"cooldown"` | 冷却 N 轮后可再触发 |

---

#### `salience`

Storylet 被选中的"优先级评分"，来自 Emily Short 的 QBN 理论。

计算逻辑：

```
最终得分 = base + Σ(条件满足的 bonus) - Σ(条件满足的 penalty)
```

`modifiers` 里的条件不是 bool 值，而是**世界状态变量是否"活跃"**（超过某个阈值算活跃）。

可选扩展字段：

```json
"cooldown": 5,          // 上次触发后冷却多少轮才能再被选中
"sticky": true,         // 一旦开始执行，中途不被打断，直到执行完毕
"priority_override": 99 // Landmark 节点可以用这个字段强制插队
```

---

### 🎬 演出类

```json
"on_interrupt": "pause"
```

**`on_interrupt`**：玩家突然说了个完全无关的话题时怎么处理：
- `"pause"`：暂停当前 Storylet，保存状态，稍后恢复
- `"abort"`：取消当前 Storylet，执行 Effects 后退出
- `"continue"`：忽略打断，强制继续当前 Storylet

---

### ✅ 结束类（新增）

这是关于"Storylet 什么时候算执行完"的设计。

Storylet 的"执行"不是指"生成了一段对话"，而是指**叙事目标是否达成**。

#### `completion_trigger`：结束触发器

```json
"completion_trigger": {
  "type": "llm_check",
  "prompt": "Grace 是否已经向玩家透露了'婚姻有问题'这个信息？",
  "max_turns": 8
}
```

**三种结束判断方式**：

| type | 说明 | 适用场景 |
|------|------|----------|
| `"turn_limit"` | 达到预设回合数即结束 | 简单场景，无需语义判断 |
| `"player_signal"` | 玩家输入明确结束信号（如"换个话题"） | 玩家主导的对话 |
| `"llm_check"` | 每轮用 LLM 判断叙事目标是否达成 | 需要精细控制的场景 |

**LLM Check 的工作流程**：

```
每轮对话后 → 注入 completion_trigger.prompt → LLM 判断 true/false
              ↓
         true: 立即结束 Storylet，执行 Effects
         false: 继续执行，直到 max_turns 强制结束
```

> `llm_trigger` 用于判断"能否开始"，`completion_trigger` 用于判断"何时结束"。两者都是语义判断，但作用时机不同。

---

#### `force_wrap_up`：强制收尾（兜底）

如果超过 `max_turns` 还没自然结束，强制收尾：

```json
"force_wrap_up": {
  "trigger_turn": 10,
  "director_note": "Grace 突然转移话题，结束这次交流"
}
```

这确保 Storylet 不会无限执行，同时给叙事设计师一个"优雅收尾"的控制手段。

---

## 三·五、角色叙事行为库（`character_behaviors.py`）— 新增章节

> 设计参考：StoryVerse 4.4 Action Schema

将角色的"可执行行为模式"显式定义为有限集合，LLM 先从库中选择一个行为，再据此生成具体台词。

### 核心价值

1. **约束 LLM 自由发挥**，使角色行为符合叙事设计意图
2. **行为选择本身成为可观测中间层**（调试/论文论据）
3. Storylet 可通过 `allowed_behaviors` 字段约束当前场景可用的行为

### 行为一览

| 行为 ID | 归属 | 中文标签 | Salience Boost |
|---------|------|---------|---------------|
| `deflect` | 共用 | 转移话题 | 0 |
| `go_quiet` | 共用 | 沉默 | 1 |
| `make_excuse` | 共用 | 找借口 | 0 |
| `ask_player` | 共用 | 求助/询问 | 2 |
| `surface_normal` | 共用 | 维持表面正常 | 0 |
| `subtle_hint` | 共用 | 话里有话 | 2 |
| `admit` | 父亲 | 承认真相 | 5 |
| `get_angry` | 父亲 | 情绪爆发 | 3 |
| `apologize` | 父亲 | 道歉 | 5 |
| `shut_down` | 父亲 | 彻底关闭 | 1 |
| `cold_truth` | 母亲 | 冷静说出真相 | 5 |
| `care_through_action` | 母亲 | 用行动表达关心 | 1 |
| `controlled_sarcasm` | 母亲 | 克制的讽刺 | 2 |
| `withdraw` | 母亲 | 情感撤退 | 1 |
| `break_down` | 母亲 | 情绪崩溃 | 4 |

### 行为选择三步流程

```
Step 0: _generate_inner_thought()  ← 内心独白（temperature=0.75）
Step A: _select_behavior()         ← 行为选择（temperature=0.1）
Step B: generate_response()        ← 台词/动作生成（temperature=0.6）
         ↑ 内心独白作为上下文注入，角色可心口不一
```

---

```json
{
  "id": "sl_grace_hinting_at_secret",
  "title": "Grace 的欲言又止",
  "phase_tags": ["act1", "tension_building"],
  "narrative_goal": "玩家感知到 Grace 想说什么但被 Trip 打断",
  "is_landmark": false,

  "conditions": [
    { "type": "quality_check", "key": "story_phase",   "op": ">=", "value": 1 },
    { "type": "quality_check", "key": "grace_trust",   "op": ">=", "value": 3 },
    { "type": "flag_check",    "key": "secret_hinted", "op": "==", "value": false }
  ],
  "llm_trigger": "玩家是否在尝试与 Grace 单独交流，或话题涉及婚姻？",

  "content": {
    "type": "llm_prompt",
    "director_note": "Grace 想透露婚姻问题，但 Trip 会打断。营造悬念和压迫感。",
    "tone": "tense, slightly desperate",
    "character_focus": "Grace",
    "forbidden_reveals": ["trip_affair", "grace_decision"]
  },


  "effects": [
    { "key": "secret_hinted",             "op": "=", "value": true  },
    { "key": "grace_trust",               "op": "+", "value": 1     },
    { "key": "relationship_crisis_level", "op": "+", "value": 0.5   }
  ],
  "conditional_effects": [
    {
      "trigger": "玩家追问了 Grace",
      "effects": [{ "key": "grace_intimacy", "op": "+", "value": 1 }]
    }
  ],

  "repeatability": "never",
  "cooldown": null,
  "sticky": false,
  "priority_override": null,

  "salience": {
    "base": 8,
    "modifiers": [
      { "key": "grace_intimacy", "threshold": 4, "bonus": 3 },
      { "key": "trip_anger",     "threshold": 5, "penalty": -2 }
    ]
  },

  "on_interrupt": "pause",

  "completion_trigger": {
    "type": "llm_check",
    "prompt": "Grace 是否已经向玩家透露了'婚姻有问题'这个信息？",
    "max_turns": 8
  },

  "force_wrap_up": {
    "trigger_turn": 10,
    "director_note": "Grace 突然转移话题，结束这次交流"
  }
}
```

---

## 四、一句话总结各字段职责

```
conditions          → 我能被触发吗？（规则门槛）
llm_trigger         → 这个时机对吗？（语义匹配，由 InputParser.analyze() 统一判断）
salience            → 我有多想被触发？（竞争优先级）
content             → 我被触发后干什么？（导演指令）
effects             → 我执行完后改变了什么？（世界状态更新）
repeatability       → 我能被重复触发吗？（生命周期管理）
forbidden_reveals   → 我执行时不能说什么？（信息防火墙）
completion_trigger  → 我什么时候算执行完？（语义匹配，结束判断）
force_wrap_up       → 超时了怎么收尾？（兜底机制）
```

---

## 五、设计要点补充

### 关于 `llm_trigger` vs `completion_trigger`

两者都用 LLM 做语义判断，但设计目的不同：

| | `llm_trigger` | `completion_trigger` |
|--|---------------|----------------------|
| **作用时机** | Storylet 开始前 | Storylet 执行中，每轮检查 |
| **判断对象** | 玩家输入 + 世界状态 | 当前对话历史 + 叙事目标 |
| **设计目的** | 选不选这个 Storylet | 什么时候结束这个 Storylet |
| **性能开销** | 由 InputParser.analyze() 统一调用（与其他 llm_trigger 合并为 1 次 LLM 调用） | 每轮对话后调用（可优化） |

**优化建议**：`completion_trigger` 的 LLM 检查可以用轻量级模型（如 GPT-3.5），或者只在关键 Storylet 上启用。

---

*文档版本：v0.2 | 日期：2026-04-23 | 状态：与原型代码同步*
