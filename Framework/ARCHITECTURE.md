# FacadeRemake — 剧情自适应系统 架构框架 v0.3

> 基于现代 LLM + Agent 技术复刻 Facade 核心体验的设计框架。
> 最后更新：2026-04-23
> **当前状态**：核心原型已实现并可运行（`prototype/facade_remake/`），本文档记录已实现架构与待扩展方向。

---

## 一、设计哲学

### 1.1 核心矛盾与破解思路

互动叙事存在一个根本张力（Doug Sharp，1989，你笔记中的经典文献）：

> **故事要连贯 ↔ 游戏要自由**

传统解法要么牺牲自由（线性分支树），要么牺牲连贯（纯涌现模拟）。

本系统的破解思路：**三层分离**

```
叙事骨架层（Landmark + Storylet）  ← 叙事设计师掌控
       ↕ 边界协议
内容生成层（LLM 角色 Agent）       ← 模型负责细节
       ↕ 玩家输入
玩家感知层（自由自然语言输入）      ← 玩家体验沉浸
```

对应你笔记中 Emily Short 的那句话：**用 QBN 管状态，用 Salience 选反应，用 Waypoint 控节奏。**

---

## 二、系统总体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        FacadeRemake 系统                        │
│                                                                 │
│  玩家自然语言输入                                                │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────┐                                        │
│  │   输入解析模块        │  ← 合法性检查 + 语义条件匹配           │
│  │  (Input Parser)     │    validate_input() + analyze()         │
│  │  + SemanticCondition │    统一一次 LLM 调用                    │
│  │    Store             │    硬/软拒绝 → 忽略/角色困惑反应        │
│  └──────────┬──────────┘                                        │
│             │ matched_semantic_ids 驱动 Storylet 选择            │
│             │ + Landmark 推进                                    │
│             ▼                                                   │
│  ┌─────────────────────┐    ┌────────────────────────┐          │
│  │   世界状态模型        │◄──►│  角色行为库              │          │
│  │  (World State)      │    │  character_behaviors    │          │
│  │  · qualities        │    │  · 15种行为（父/母各10）  │          │
│  │  · flags            │    │  · StoryVerse ActionSchema         │
│  │  · 关系数值          │    └────────────────────────┘          │
│  └──────────┬──────────┘                                        │
│             │ 触发查询                                           │
│             ▼                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  故事选择器 (Story Selector)             │    │
│  │                                                         │    │
│  │  候选池 = 条件满足 + llm_trigger 语义匹配               │    │
│  │                                                         │    │
│  │  选择策略（已实现）：                                    │    │
│  │   · Landmark 约束 ← 标签过滤，保证主线推进              │    │
│  │   · Salience 评分 ← base + modifiers                   │    │
│  │   · LLM 评估器   ← Top-3 候选（默认关闭）               │    │
│  └──────────┬──────────────────────────────────────────────┘    │
│             │ 选出目标 Storylet                                  │
│             ▼                                                   │
│  ┌─────────────────────┐                                        │
│  │   Storylet 执行器   │  ← DRAMA LLAMA 发言决策                │
│  │  (Executor)         │    三步生成：内心独白→行为选择→台词/动作  │
│  └──────────┬──────────┘                                        │
│             │ 执行 Effects → 更新世界状态（首次进入时执行一次）   │
│             ▼                                                   │
│        [下一轮交互]                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 三、核心模块详解

### 3.1 输入解析模块（Input Parser）

**职责**：玩家输入的守门人，不做结构化意图分类（CharacterAgent/Director 自行理解原文）。

**两大方法**：
- `validate_input()`：规则层（正则过滤 meta/暴力/超长）+ LLM 语义合法性判断
- `analyze()`：合并合法性检查与语义条件匹配（Storylet `llm_trigger` + Landmark `llm_semantic`），**一次 LLM 调用**

**分发逻辑**：
```
hard reject → 忽略输入（不生成角色响应）
soft reject → 角色困惑反应（注入 Director 指令）
valid       → 正常流程（matched_semantic_ids 驱动下游选择）
```

**剪枝策略**：只收集当前 Landmark 范围内的语义条件（Storylet `llm_trigger` + 出边 `llm_semantic`），通常 2~15 条。

**SemanticConditionStore**：条件索引接口，当前全量列表实现，`search()` 可替换为向量检索，上层代码无需改动。

**设计要点**：
- 不再做结构化意图分类（intent/target/topic_tags），因为无下游消费者
- 旧设计中每个 `llm_trigger` Storylet 单独调 LLM，现在合并为 1 次
- 参考 DRAMALLLAMA 的自然语言 precondition 判断方式

---

### 3.2 世界状态模型（World State）

这是系统的"记忆"，也是 Storylet 条件判断的依据。

**状态分类**（参考 Emily Short + Kreminski 论文）：

| 类型 | 示例变量 | 说明 |
|------|---------|------|
| **Metrics（进度类）** | `story_phase`（1-5）, `landmark_reached` | 剧情阶段，确保主线推进 |
| **关系数值** | `trip_trust`, `grace_intimacy`, `marriage_tension` | 角色对玩家/彼此的感受 |
| **情绪状态** | `trip_anger`, `grace_anxiety`, `grace_withdrawn` | 角色当前情绪 |
| **揭露标记** | `secret_hinted`, `affair_revealed`, `confronted_trip` | 关键信息是否已揭露 |
| **Currencies（资源类）** | `player_credibility`, `conversation_turns` | 玩家"信用"、对话轮数等 |
| **Menaces（威胁类）** | `relationship_crisis_level` | 整体叙事张力 |

**更新规则**：
- 每次 Storylet 执行后，通过 Effects 更新
- 玩家输入解析后也会直接影响部分变量（如情绪）
- LLM 角色 Agent 的行为也可以触发变量变化

---

### 3.3 Storylet 数据结构

这是系统的**最小可玩叙事单元**，对玩家体验而言就是一个"叙事目标"。

```json
{
  "id": "sl_grace_hinting_at_secret",
  "title": "Grace 的欲言又止",
  "phase_tags": ["act1", "tension_building"],
  "narrative_goal": "玩家感知到 Grace 想说什么但被 Trip 打断",

  "conditions": [
    { "type": "quality_check", "key": "story_phase", "op": ">=", "value": 1 },
    { "type": "quality_check", "key": "grace_trust", "op": ">=", "value": 3 },
    { "type": "flag_check", "key": "secret_hinted", "op": "==", "value": false }
  ],

  "llm_trigger": "玩家是否在尝试与 Grace 单独交流，或者话题涉及了婚姻关系？",

  "content": {
    "type": "llm_prompt",
    "director_note": "Grace 想透露一些关于婚姻问题的信息，但 Trip 会打断。这一幕应该制造悬念和压迫感。",
    "tone": "tense, slightly desperate",
    "character_focus": "Grace"
  },

  "choices_hint": [
    "追问 Grace",
    "质疑 Trip 的打断",
    "假装没注意到"
  ],

  "effects": [
    { "key": "secret_hinted", "op": "=", "value": true },
    { "key": "grace_trust", "op": "+", "value": 1 },
    { "key": "relationship_crisis_level", "op": "+", "value": 0.5 }
  ],

  "repeatability": "never",

  "salience": {
    "base": 8,
    "modifiers": [
      { "key": "grace_intimacy", "bonus": 3 },
      { "key": "trip_anger", "penalty": -2 }
    ]
  }
}
```

---

### 3.4 故事选择器（Story Selector）

**这是系统的核心调度逻辑**，决定"现在该发生什么"。

#### 选择流程（三层过滤）：

```
Step 1: 条件过滤
  → 遍历所有 Storylets，筛出 Conditions 满足的候选集

Step 2: Landmark 约束
  → 若当前有"必须推进"的 Landmark，优先级提升相关 Storylets
  → 防止剧情永远停留在某个阶段

Step 3: Salience 评分 + LLM 评估
  → 计算每个候选的 Salience 得分
  → 可选：用 LLM 对 Top-K 候选做最终"戏剧合理性"判断
  → 选出最高分的 Storylet 执行
```

#### LLM 评估器（可选但推荐）Prompt 示意：
```
当前世界状态: [trip_anger=7, grace_withdrawn=true, secret_hinted=true...]
当前对话上下文: [最近3轮玩家输入与角色回应]
候选 Storylets: [A: 大爆发冲突, B: Grace 独白, C: Trip 转移话题]

请从戏剧节奏和叙事合理性角度，判断此刻哪个 Storylet 最适合触发？
输出格式: { "choice": "A", "reason": "..." }
```

---

### 3.5 角色 Agent（Character Agents）✅ 已实现

每个 NPC（父亲赵建国 / 母亲林美华）是一个独立的 LLM Agent，实现了**三步生成架构**：

**Step 0 — 内心独白（`_generate_inner_thought()`）**
- 角色先"想"再"说"，内心独白不等于说出口的话（心口不一）
- 温度 0.75，保留情感张力
- 注入后续步骤作为上下文约束

**Step A — 行为选择（`_select_behavior()`）**
- 从 `data/character_behaviors.py` 中选择一个叙事行为 ID
- 参考 StoryVerse Action Schema：15 种行为，父亲10种/母亲10种
- Storylet 可通过 `allowed_behaviors` 字段约束当前可用行为
- 温度 0.1，确定性选择

**Step B — 台词/动作生成（主体）**
- **系统 Prompt 包含**：角色身份+性格+背景 + 秘密知识 + 叙事目标 + 导演指令 + 情绪基调 + 行为模式指令 + 内心独白上下文 + 禁止话题
- 近期对话记忆（最近 6 条，IBSEN 风格结构化历史）
- **输出格式**：`{"speech": "...", "action": "*肢体动作*"}`
- IBSEN 式 NG words 检测（重试最多 3 次）+ 重复检测

**DRAMA LLAMA 发言决策（`_decide_speakers()`）**：
- 每轮由 LLM 决定哪个（些）角色回应及顺序
- 而非预设 `character_focus` 固定一个角色
- 决策失败时 fallback 到旧 `character_focus` 字段（向后兼容）

---

### 3.6 Landmark 系统（主线锚点）

这是叙事设计师**提前设计的故事骨干**，保证无论玩家如何互动，剧情都能到达关键节点。

#### Landmark 的本质

Landmark 是**叙事控制层**，不是可执行的叙事单元：

```
┌─────────────────────────────────────────────────────────────┐
│                    叙事架构分层（简化版）                      │
├─────────────────────────────────────────────────────────────┤
│  固定层：Landmarks（预先设计，决定结局分支）                   │
│  · 粗粒度剧情节点                                             │
│  · 控制当前可用的 Storylet 标签                               │
│  · 运行时只读，不生成                                         │
├─────────────────────────────────────────────────────────────┤
│  动态层：Storylets（预设计 + 可选实时生成）                    │
│  · 具体的叙事单元                                             │
│  · 预设计：每个 Landmark 配 5-15 个 Storylets                 │
│  · 实时生成：处理边缘情况                                     │
└─────────────────────────────────────────────────────────────┘
```

> **一句话**：Landmark 是"导演喊卡"的机制——它不说戏怎么演（那是 Storylet 的事），但它决定"现在演到哪一幕"和"这一幕可以演什么类型的戏"。

**关键设计**：Landmark 层保持简单固定，动态性全部下沉到 Storylet 层。

#### Landmark 数据结构

```json
{
  "id": "lm_2_secret_revealed",
  "title": "秘密揭露",
  "description": "父母婚姻危机的核心秘密被部分揭露",
  "phase_tag": "act2",
  "order": 2,
  
  "entry_conditions": {
    "world_state": [
      { "key": "marriage_tension", "op": ">=", "value": 6 }
    ],
    "or_player_input": [
      "直接询问父母关系",
      "提及看到/听到了什么"
    ]
  },
  
  "narrative_constraints": {
    "allowed_storylet_tags": ["secret_related", "confrontation", "emotional"],
    "forbidden_reveals": [],
    "required_mood": "tense",
    "max_sticky_storylets": 3
  },
  
  "progression_rules": {
    "advance_when": {
      "world_state": { "secret_exposed": true },
      "or_turn_limit": 15,
      "or_player_input": ["明确表态", "情绪爆发", "离开现场"]
    },
    "next_landmark": "lm_3_taking_sides",
    "fallback_after_turns": 20
  },
  
  "fallback_storylet": "sl_force_secret_reveal",
  
  "world_state_effects_on_enter": [
    { "key": "current_landmark", "op": "=", "value": 2 },
    { "key": "story_phase", "op": "=", "value": "act2" }
  ]
}
```

#### 关键字段解释

| 字段 | 作用 |
|------|------|
| `entry_conditions` | 什么时候从上一个 Landmark 进入这个 |
| `narrative_constraints` | **核心**：限制当前阶段只能选哪些 Storylet |
| `progression_rules` | 什么时候推进到下一个 Landmark |
| `fallback_storylet` | 如果玩家一直不触发关键条件，强制推进 |
| `world_state_effects_on_enter` | 进入时自动更新的世界状态 |

#### Landmark 与 Storylet 的关系

```
Landmark 0: 表面平静
    │
    │ 约束：只允许 "dinner_chat", "small_talk", "subtle_tension" 类 Storylet
    │
    ▼ 玩家输入触发 entry_conditions
Landmark 1: 第一次裂缝
    │
    │ 约束：允许 "deflection", "evasion", "minor_conflict" 类 Storylet
    │       禁止直接揭露秘密
    │
    ▼ 达到 progression_rules
Landmark 2: 秘密揭露
    │
    │ 约束：允许 "confrontation", "emotional_breakdown", "partial_truth" 类 Storylet
    │
    ▼ ...
```

#### Facade 的 Landmark 示例设计

```
Landmark 0: 初始状态 — 玩家被邀请来拜访
      ↓
Landmark 1: 第一层紧张 — 察觉到 Trip & Grace 之间有问题
      ↓
Landmark 2: 矛盾显现 — Trip 或 Grace 的情绪爆发一次
      ↓
Landmark 3: 秘密揭露 — 婚姻危机根源被点名（可由玩家引导或自然爆发）
      ↓
Landmark 4: 危机顶点 — 三方关系摊牌
      ↓
Landmark 5a: 结局 — 玩家被赶出去
Landmark 5b: 结局 — 某种程度的和解
Landmark 5c: 结局 — Grace 做出决定
```

**Landmark 推进条件**：
- 基于世界状态的量化条件（如 `relationship_crisis_level >= 4`）
- 或由玩家的某类关键输入触发（如直接问出某个话题）
- Landmark 之间允许大量 Storylets 自由填充

---

## 四、数据流全链路图

```
玩家输入 "你们之间到底发生了什么"
         │
         ▼
    [Input Parser] ── analyze()
    → valid: true
    → matched_semantic_ids: ["sl_first_crack", "lm1→lm2"]
         │
         ▼ matched_semantic_ids 驱动选择
    [Story Selector]
    候选集: [sl_grace_evasion, sl_trip_deflects, sl_first_crack]
    Salience 评分后 → 选中: sl_first_crack (Grace 第一次裂缝)
         │
         ▼
    [Executor]
    注入 Director Note: "Grace 短暂透露了一点真实情绪，但立刻收回"
    注入角色状态: grace_anxiety=6, trip_anger=5
         │
         ▼
    [LLM Grace Agent] → 生成 Grace 的回应
    [LLM Trip Agent]  → 生成 Trip 的打断/转移
         │
         ▼
    执行 Effects: secret_hinted=true, relationship_crisis_level += 0.3
         │
         ▼
    [Landmark 推进检查]
    matched_semantic_ids 含 "lm1→lm2" → 满足 llm_semantic 条件 → 推进
         │
         ▼
    输出给玩家（文字/语音/动画）
```

---

## 五、关键设计取舍讨论

### 5.1 Storylet 的粒度

**问题**：一个 Storylet 应该多大？

**建议**：
- 最小：一次有意义的情感交换（约 3-8 轮对话）
- 最大：一个小场景（约 10-20 轮对话）
- 每个 Storylet **给玩家一个明确的叙事目标感**（"我想知道 Grace 刚才说的是什么意思"）

### 5.2 LLM 评估器的开销

**问题**：每次选择 Storylet 都用 LLM 评估会不会太慢？

**建议**：
- 默认用规则 Salience 评分（极快）
- 仅当候选集 Top-3 分数接近时，才调用 LLM 评估器
- 或：每隔 N 轮才重新评估一次

### 5.3 LLM 幻觉与剧情漂移

**问题**：LLM 可能生成超出 Director Note 范围的内容。

**建议**（参考 Triangle Framework 论文的 landmark adherence 机制）：
- Executor 层加入输出校验（检查关键标记词是否被提前揭露）
- 设置"信息防火墙"：当前 Landmark 以外的信息不允许出现在 prompt 上下文中
- 必要时用轻量 LLM 做内容审查（二次过滤）

### 5.4 玩家能动感 vs. 剧情控制

**Jon Ingold 的核心原则**（你笔记中）：
> "Agency is the range we give the player, not the range the player wants."

本系统的做法：
- 玩家可以用任何自然语言，但 Input Parser 会把它映射到有限的"叙事动作集"
- 玩家感觉自由，系统实际上在一个可控的状态空间内运行
- 配合"选择幻觉"研究结论：只要玩家的行为被"正面反馈和承认"，代理感就很强

---

## 六、技术栈（已确定）

| 模块 | 已实现方案 | 备注 |
|------|-----------|------|
| 世界状态存储 | Python dataclass（WorldState） | qualities/flags/relationships |
| Storylet 数据 | Python dict 列表 | `data/default_storylets.py` |
| LLM 调用 | OpenAI API（兼容格式） | 无 API key 时 mock 模式 |
| 角色 Agent | 自定义三步生成 prompt 链 | 内心独白→行为选择→台词/动作 |
| 行为库 | `data/character_behaviors.py` | 15种行为，StoryVerse 设计 |
| 前端演出 | 文字终端 CLI | `python main.py` |
| 叙事编辑工具 | 暂无可视化工具 | 后续可扩展 |

---

## 七、开发阶段进度

```
✅ 阶段 0（纯文字 CLI）：
  - 18 个 Storylets（15具体 + 3兜底）
  - 规则 World State（Python dataclass）
  - 规则 Salience 选择
  - 验证：基本流程已跑通

✅ 阶段 1（引入 LLM）：
  - Input Parser 用 LLM
  - 角色 Agent 三步生成（内心独白→行为选择→台词/动作）
  - DRAMA LLAMA 发言角色自决
  - 行为库（15种行为，StoryVerse Action Schema）
  - 验证：对话有 Facade 的心口不一感

✅ 阶段 2（引入 Landmark）：
  - 完整三幕结构的 Landmarks（4个阶段 + 4个结局）
  - 18 个 Storylets，llm_trigger 语义触发已实现
  - 主线推进已实现（回合兜底 + 条件推进）

⏳ 阶段 3（评估与调优）：
  - LLM 评估器代码已实现，默认关闭（use_llm_evaluator=False）
  - 待调试主线剧情后开启，测试玩家自主感

⏳ 阶段 4（演出层）：
  - Unity 对接方案已设计（见 ARCHITECTURE.md 9.x）
  - 当前以终端 CLI 为主
```

---

## 八、关键设计决策记录

以下是框架中的关键设计选择，已决定的标注 ✅：

1. **故事设定** ✅：赵建国/林美华家庭情感互动（非原版 Trip/Grace），父亲瞒家人借款30万
2. **Storylet 触发方式** ✅：Salience 自动触发 + `llm_trigger` 语义辅助（无强制玩家选项）
3. **LLM 评估器** ✅：代码已实现，原型阶段关闭，后续开启
4. **多玩家/单玩家** ✅：单玩家（儿子视角）
5. **重玩性设计** ✅：Storylet repeatability 策略（never/unlimited/cooldown）+ 多结局设计
6. **叙事设计工具链** ⏳：当前无可视化工具，数据以 Python dict 编写

---

---

## 九、架构通用性设计备忘（2026-03-28）

> 来源：与 StoryVerse 论文对照讨论后的结论

### 9.1 设计目标

本系统架构目标为**通用叙事引擎内核（Generic Narrative Engine）**，当前以家庭情感互动（FacadeRemake）作为验证案例，但设计上不依赖特定场景，具备扩展至多角色、多地点叙事场景的潜力。

### 9.2 待实施的通用化改造点

#### 改造 1：目录结构分离引擎层与场景数据层（低成本，高信号价值）
```
prototype/
  engine/            ← 通用引擎层（不含任何场景特定内容）
    core/            ← WorldState, Storylet, Landmark, StorySelector
    agents/          ← LLMClient, CharacterAgent, InputParser
  scenarios/
    facade_remake/   ← 当前家庭情感场景的所有数据
      config/        ← characters.py（角色配置）
      data/          ← default_storylets.py, default_landmarks.py
    # 未来可新增：
    # open_world_demo/
    # mystery_game/
```
目录结构本身就在论文中证明架构的通用性，无需额外说明。

#### 改造 2：角色由硬编码改为可注册（中等成本）
```python
# 当前：characters.py 中写死两个角色
# 目标：CHARACTER_REGISTRY 字典，可注册任意数量角色
CHARACTER_REGISTRY = {
    "zhao_jianguo": CharacterConfig(...),
    "lin_meihua": CharacterConfig(...),
    # 开放世界版可以有 N 个角色
}
```

#### 改造 3：Storylet tags 支持场景/地点过滤（低成本）
```python
# 在 tags 中加入 location 维度
tags=["living_room", "tension", "money"]
# StorySelector 先过滤 location，再评 Salience
# 同一套引擎即可处理多地点场景
```

#### 改造 4：WorldState 增加叙事占位符记录字段（极低成本，来自 StoryVerse）
```python
class WorldState:
    def __init__(self):
        self.flags = {}
        self.qualities = {}
        self.relationships = {}
        self.narrative_placeholders = {}  # 新增：跨Storylet叙事一致性

    def set_placeholder(self, key: str, value: str):
        """记录叙事关键内容，如 'first_outburst_character' = '父亲'"""
        self.narrative_placeholders[key] = value
```

### 9.3 论文写作中的定位表述建议

> "本系统实现了一个**通用叙事引擎内核**（Generic Narrative Engine），以家庭互动场景作为验证案例。引擎的核心组件（WorldState、Storylet、Landmark、StorySelector）在设计上不依赖特定场景，具备扩展至多角色、多地点叙事场景的潜力，与 StoryVerse（Wang et al., 2024）等开放世界叙事系统在架构层面同构，差异主要在场景配置而非引擎核心。"

### 9.4 与 StoryVerse 的架构对应关系

| StoryVerse 组件 | FacadeRemake 对应 | 差异说明 |
|----------------|-----------------|---------|
| Abstract Acts | Landmark（主线锚点） | Landmark 当前不含占位符机制，可扩展 |
| Narrative Plan（具体行动序列） | Storylet | FacadeRemake 粒度更细（对话场景级） |
| Act Director | StorySelector | 均负责"当前该执行什么叙事单元" |
| Character Simulator | CharacterAgent | 均为 LLM 驱动，接口类似 |
| Game Environment | WorldState | 均为状态容器，驱动整体流程 |
| Story Domain | scenarios/facade_remake/ | 场景配置数据层 |

---

*文档版本：v0.1 → v0.3 | 最新更新：2026-04-07 | 状态：持续维护中*
