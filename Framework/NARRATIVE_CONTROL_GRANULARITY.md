# 叙事控制粒度设计文档

> **目标**：明确 FacadeRemake 系统中叙事控制的层级划分，参考 DRAMALLLAMA、Dramamancer、IBSEN、StoryVerse 等论文的设计决策，确定适合本项目的控制粒度。

---

## 一、参考论文的叙事控制粒度对比

### 1.1 横向对比表

| 论文 | 控制粒度层级 | 核心控制机制 | 作者控制程度 | 角色自主性 |
|------|-------------|-------------|-------------|-----------|
| **DRAMA LLAMA** | 场景转场点（Trigger） | 自然语言 Trigger + Actions 序列 | 中 | 高 |
| **Dramamancer** | 场景(Scene) + 事件(Event) | Event precondition + Effect | 中-高 | 高 |
| **IBSEN** | 目标级(Objective) | Plot Objectives + Director Instruction | 高 | 中 |
| **StoryVerse** | 幕级(Abstract Act) | Narrative Goal + Placeholder | 中 | 中-高 |
| **AGENTS' ROOM** | 故事段落级 | Planning Agents + Scratchpad | 高 | 中 |
| **MULTI-AGENT CHAR** | 场景级(Scene) | Director Agent + Fabula-Syuzhet | 中 | 中 |

### 1.2 各论文详细分析

#### 1.2.1 DRAMA LLAMA —— "极简 Trigger 控制"

```
控制粒度：粗（仅关键转场点）

架构：
┌─────────────────────────────────────┐
│  Trigger 1: "Has Sepideh noticed..." │ ← 自然语言条件
│     ↓                                │
│  Actions: ["Sepideh raises voice",   │ ← 舞台指令序列
│           "Sepideh suggests...",     │
│           "Sepideh grabs..."]        │
│     ↓                                │
│  LLM Agent 自由生成具体台词            │ ← 高自主性
└─────────────────────────────────────┘
```

**控制特点**：
- 作者只控制**何时触发**（Condition）和**触发后做什么**（Actions）
- Actions 是**消耗式**的——每次触发消耗下一条
- 角色在 Actions 的约束下**完全自由**生成内容
- **无显式世界状态**，状态隐含在故事文本中

**优点**：
- 作者负担极低（3-4 个 Trigger 就能驱动一场戏）
- 角色表现自然、涌现性强

**缺点**：
- 触发时机不稳定（LLM 判断有随机性）
- 难以保证跨场景一致性
- 无法精确控制"谁说了什么"

---

#### 1.2.2 Dramamancer —— "Scene + Event 双层控制"

```
控制粒度：中（场景级 + 事件级）

架构：
┌─────────────────────────────────────────┐
│  Scene（场景）                          │ ← 粗粒度：固定 cast、setting
│  ├── cast: [Jungwon, Pyungsoo]          │
│  ├── setting: "客厅，晚上"              │
│  └── background: "两人刚吵完架"         │
│                                         │
│  ├── Event 1: "Jungwon 表达不满"        │ ← 细粒度：Storylet
│  │     precondition: "Jungwon is upset" │
│  │     content: "Jungwon 抱怨工作"      │
│  │     effect: → Event 2                │
│  │                                       │
│  ├── Event 2: "Pyungsoo 试图安抚"       │
│  │     precondition: "Event 1 完成"     │
│  │     content: "Pyungsoo 道歉并解释"    │
│  │     effect: → Scene 2                 │
│  │                                       │
│  └── Time-based Event: 5轮后自动触发    │ ← 防停滞机制
│       content: "气氛变得更紧张"          │
└─────────────────────────────────────────┘
```

**控制特点**：
- **Scene 层**：固定场景设定（谁在场、在哪里、背景）
- **Event 层**：Storylet 控制具体叙事单元
- 支持 **Action-based**（行为触发）和 **Time-based**（时间触发）两种 Event
- 自然语言 precondition，由 LLM 判断

**与 DRAMA LLAMA 的关键差异**：
- 显式引入 **Scene** 层级，提供更强的上下文约束
- **Time-based Event** 防止故事停滞
- Effect 可以跳转到其他 Scene，形成跨场景结构

---

#### 1.2.3 IBSEN —— "目标级精细控制"

```
控制粒度：细（目标级 + 指令级）

架构：
┌─────────────────────────────────────────────┐
│  Plot Objectives（剧情目标列表）              │ ← 最细粒度控制
│  ├── Objective 1: "Hedda 表现出对 Lovborg    │
│  │               的复杂情感"                  │
│  ├── Objective 2: "Brack 法官暗示他知道秘密" │
│  └── Objective 3: "Hedda 获得手枪"          │
│                      ↓                      │
│  ┌─────────────────────────────────────┐    │
│  │  Director Agent（导演）              │    │
│  │  1. 写 Storyline Outline             │    │
│  │  2. 生成 Dialogue Script（发言顺序） │    │
│  │  3. 向 Actor 发出 Instruction        │    │ ← 关键词级指令
│  │     （非直接台词！）                  │    │
│  │  4. 检查 Objective 是否完成           │    │
│  └─────────────────────────────────────┘    │
│                      ↓                      │
│  ┌─────────────────────────────────────┐    │
│  │  Actor Agents（演员）                │    │
│  │  - Profile（角色设定）               │    │
│  │  - Memory DB（向量检索）             │    │
│  │  - Character DB（关系印象）          │    │
│  │  - Monologue（第一人称独白）         │    │ ← 内化记忆
│  │  → 生成实际台词                      │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

**控制特点**：
- **Director-Agent 分离**：导演负责"控制"，演员负责"表达"
- **Instruction 是关键词**，不是直接台词（避免演员复制）
- 每轮对话后，Director **自动检查** Objective 是否完成
- 如果 9 轮内未完成，**强制完成**并推进

**关键创新**：
- **Monologue（第一人称独白）**：让角色"内化"记忆，而非机械检索
- **Objective Checking**：LLM 判断剧情目标完成度（F1=0.77）

**控制粒度最细**，但成本也最高（每轮多次 LLM 调用）

---

#### 1.2.4 StoryVerse —— "幕级 + 占位符控制"

```
控制粒度：中（幕级 + 占位符解析）

架构：
┌─────────────────────────────────────────────────────┐
│  Abstract Act（抽象幕）                              │
│  ├── Narrative Goal: "角色 X 遭遇生命危险事故"       │ ← 高层次目标
│  ├── Prerequisites:                                  │
│  │    - 世界状态: "John 被所有人喜爱"               │
│  │    - 玩家行动: "使用了有毒食物"                   │
│  │    - 其他 Act 完成: "Act 1 已完成"               │
│  ├── Placeholders:                                   │
│  │    - X = "陷入生命危险的那个角色"（Promise）     │ ← 占位符
│  └── Grouping: [Act 1, Act 2, Act 3]（故事线）       │
│                                                      │
│  Placeholder Resolution:                             │
│  执行后 → LLM 识别 X 对应的具体角色 → 存储           │
│  后续 Act 引用 X → 自动替换为具体角色                │ ← 跨幕一致性
│                                                      │
│  Iterative Planning（迭代规划-审查）:                │
│  Plan Generator → Plan Reviewer（三维反馈）          │
│       ↑________________________↓                     │
│  1. 整体一致性评估                                   │
│  2. 游戏环境执行反馈                                 │
│  3. 角色动机验证                                     │
└─────────────────────────────────────────────────────┘
```

**控制特点**：
- **Abstract Act**：用**抽象目标**替代具体行为（"某角色陷入危险"而非"蚂蚁掉进水里"）
- **Placeholder（占位符）**：延迟绑定具体角色/事件，保证跨幕一致性
- **迭代规划-审查**：生成后多维度评估，确保合理性

**关键创新**：
- **占位符机制**：解决"第一幕的角色在第四幕还是同一个"的问题
- **Fabula-Syuzhet 思维**：区分"故事时间"和"叙事时间"

---

#### 1.2.5 AGENTS' ROOM —— "专业化分工控制"

```
控制粒度：粗（故事段落级）

架构：
┌─────────────────────────────────────────────────────┐
│  Planning Agents（规划层）      Writing Agents（生成层）│
│  ├── [CONFLICT] Agent           ├── [EXPOSITION]      │
│  ├── [CHARACTER] Agent          ├── [RISING ACTION]   │
│  ├── [SETTING] Agent            ├── [CLIMAX]          │
│  └── [PLOT] Agent               ├── [FALLING ACTION]  │
│                                 └── [RESOLUTION]      │
│              │                          │             │
│              └────── Scratchpad ────────┘             │ ← 共享记事本
│                          │                            │
│                    Orchestrator（调度器）              │
└─────────────────────────────────────────────────────┘

控制流程：
1. Planning Agents 构建故事骨骼（不直接写文本）
2. 写入 Scratchpad（共享上下文）
3. Orchestrator 决定调用哪个 Writing Agent
4. Writing Agent 按叙事弧写出最终文本
```

**控制特点**：
- **专业化分工**：不同 Agent 负责不同功能
- **Scratchpad 共享**：解决 Agent 间信息传递
- **Planning 与 Writing 分离**：先规划再生成

**适用场景**：
- 长篇故事生成（非实时互动）
- 需要高质量、结构完整的故事

---

## 二、FacadeRemake 叙事控制粒度设计

### 2.1 设计原则

基于以上分析，FacadeRemake 采用**四层控制粒度**：

```
┌─────────────────────────────────────────────────────────────┐
│  层级 1: Landmark（主线锚点）                                │
│  ─────────────────────────────────────────────────────────  │
│  粒度：粗（剧情阶段级）                                      │
│  控制：保证剧情不偏离主线，防止"放羊"                        │
│  机制：entry_conditions → narrative_constraints → progression_rules│
│                                                             │
│  层级 2: Storylet（叙事单元）                                │
│  ─────────────────────────────────────────────────────────  │
│  粒度：中（场景片段级，3-8轮对话）                           │
│  控制：提供具体叙事目标，约束角色行为范围                    │
│  机制：conditions + director_note + salience                 │
│                                                             │
│  层级 3: Character Agent（角色生成）                         │
│  ─────────────────────────────────────────────────────────  │
│  粒度：细（台词/动作级）                                     │
│  控制：在约束下自由生成具体内容，实现"心口不一"              │
│  机制：inner_thought → behavior_selection → speech/action    │
│                                                             │
│  层级 4: Input Parser（输入解析）                            │
│  ─────────────────────────────────────────────────────────  │
│  粒度：语义级                                                │
│  控制：输入合法性检查 + 语义条件匹配                         │
│  机制：validate_input()（规则+LLM）+ analyze()（合法性+匹配）│
│  · 不做结构化意图分类（CharacterAgent/Director 自行理解）    │
│  · SemanticConditionStore 预留向量检索接口                  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 各层级详细设计

#### 2.2.1 Landmark 层 —— "导演喊卡"

**类比**：IBSEN 的 Plot Objectives + StoryVerse 的 Abstract Acts

```python
{
  "id": "lm_2_secret_revealed",
  "narrative_goal": "父母婚姻危机的核心秘密被部分揭露",
  
  # 进入条件（精确控制）
  "entry_conditions": {
    "world_state": [{"key": "marriage_tension", "op": ">=", "value": 6}],
    "or_player_input": ["直接询问父母关系", "提及看到/听到了什么"],
    "or_llm_check": "当前对话是否已经达到情绪爆发点？"  # 自然语言评估
  },
  
  # 叙事约束（范围控制）
  "narrative_constraints": {
    "allowed_storylet_tags": ["secret_related", "confrontation", "emotional"],
    "forbidden_reveals": ["完整的债务金额"],  # 信息防火墙
    "required_mood": "tense",
    "max_sticky_storylets": 3  # 防止无限停留
  },
  
  # 推进规则（强制推进）
  "progression_rules": {
    "advance_when": {
      "world_state": {"secret_exposed": True},
      "or_turn_limit": 15,
      "or_llm_check": "秘密是否已经被充分揭露？"  # 借鉴 IBSEN Objective Checking
    },
    "fallback_after_turns": 20,  # 借鉴 Dramamancer Time-based
    "fallback_storylet": "sl_force_secret_reveal"
  },
  
  # 占位符（借鉴 StoryVerse）
  "placeholders": {
    "first_outburst_character": "首先情绪失控的那个角色"
  }
}
```

**控制粒度总结**：
- **粗粒度**：只控制"现在演到哪一幕"
- **不控制**：具体怎么演（下沉到 Storylet）
- **关键机制**：fallback 强制推进 + 占位符跨幕一致性

---

#### 2.2.2 Storylet 层 —— "给玩家叙事目标"

**类比**：DRAMA LLAMA 的 Trigger + Dramamancer 的 Event

```python
{
  "id": "sl_father_slips",
  "title": "父亲说漏嘴",
  "narrative_goal": "父亲在情绪激动时不小心透露了债务线索",
  
  # 触发条件（三层过滤）
  "conditions": [
    {"type": "quality_check", "key": "story_phase", "op": ">=", "value": 2},
    {"type": "flag_check", "key": "phone_incident", "op": "==", "value": True}
  ],
  "llm_trigger": "玩家是否在追问父亲关于电话/钱的事情？",  # 自然语言条件
  
  # 导演指令（控制角色生成范围）
  "director_note": {
    "scene_setup": "父亲试图转移话题，但在玩家追问下情绪失控",
    "emotional_arc": "防御 → 烦躁 → 说漏嘴 → 立刻后悔",
    "key_moment": "父亲无意中提到'老王'或'那笔钱'",
    "tone": "紧张、压抑、即将爆发"
  },
  
  # 显著性评分（借鉴 Salience-Based）
  "salience": {
    "base": 8,
    "modifiers": [
      {"key": "father_deflection_count", "bonus": 2},  # 父亲越躲，这个越显著
      {"key": "player_persistence", "bonus": 3}        # 玩家越追问，越可能触发
    ]
  },
  
  # 效果（更新世界状态）
  "effects": [
    {"key": "mother_slipped", "op": "=", "value": True},
    {"key": "marriage_tension", "op": "+", "value": 2},
    {"key": "narrative_placeholders.first_clue", "op": "=", "value": "父亲提到了老王"}
  ],
  
  "repeatability": "never"
}
```

**控制粒度总结**：
- **中粒度**：给玩家一个"叙事目标感"（"父亲好像隐瞒了什么"）
- **控制范围**：导演指令约束角色生成的情感基调和关键节点
- **不控制**：具体台词（由 LLM 生成）

---

#### 2.2.3 Character Agent 层 —— "心口不一的生成"

**类比**：IBSEN 的 Actor Agent + 内心独白机制

```python
# 三步生成流程（已在 agents/llm_client.py 实现）

class CharacterAgent:
    def generate_response(self, player_input, world_state, storylet_context):
        # Step 0: 内心独白（真实想法，temperature=0.75）
        inner_thought = self._generate_inner_thought(
            player_input=player_input,
            world_state=world_state,
            storylet_context=storylet_context
        )
        # 输出示例：
        # "该死，差点就说漏嘴了...老王那三十万要是让美华知道...
        # 不行，我得赶紧转移话题，假装是工作的事。"
        
        # Step A: 行为选择（从 character_behaviors.py 行为库中选择 1 个）
        behavior = self._select_behavior(
            inner_thought=inner_thought,
            player_input=player_input,
            storylet_context=storylet_context
        )
        # 输出示例：{"id": "deflect", "description": "转移话题，避开敏感问题"}
        
        # Step B: 台词+动作生成（内心独白注入 system prompt，可以心口不一）
        response = self._generate_speech_and_action(
            inner_thought=inner_thought,
            behavior=behavior,
            player_input=player_input,
            storylet_context=storylet_context
        )
        # 输出示例：
        # speech: "哎呀，工作上的事，说了你们也不懂..."
        # action: "父亲摆摆手，眼神却飘向窗外，手指无意识地敲着桌面。"
        
        return {
            "thought": inner_thought,    # 内心（调试模式显示 💭）
            "speech": response["speech"],# 说出口的话
            "action": response["action"] # 肢体/表情动作
        }
```

**角色行为库**（`data/character_behaviors.py`，已实现）：

```python
# 15 个行为类别，基于 StoryVerse Action Schema 设计
FATHER_BEHAVIORS = [
    "deflect",      # 转移话题（核心回避行为）
    "lie_small",    # 小谎言（不影响大局的掩盖）
    "show_guilt",   # 流露愧疚（内心挣扎显现）
    "get_angry",    # 发火（被追问时的防御）
    "be_tender",    # 示弱温柔（试图缓和气氛）
    "explain_partial",  # 部分解释（说一半留一半）
    "apologize",    # 道歉（Act3 关键行为）
    "deflect_work", # 用工作搪塞（父亲特有）
    "justify_decision", # 为自己的决定辩护
    "stay_silent",  # 沉默（不回应）
]
MOTHER_BEHAVIORS = [
    "imply",        # 暗示（不直说但话里有话）
    "care_excessive",   # 过度关心（情绪转移）
    "show_exhaustion",  # 表露疲惫
    "confront_direct",  # 正面质问
    "support_player",   # 向儿子寻求认同
    "cry_suppressed",   # 压抑哭泣
    "withdraw",     # 退出对话（去厨房/低头）
    "hint_at_leaving",  # 暗示要离开
    "forgive_tentative",# 试探性原谅（Act3）
    "stay_silent",  # 沉默
]
```

**控制粒度总结**：
- **细粒度**：控制到"说什么"和"做什么"
- **核心机制**：内心独白注入，实现"心口不一"
- **约束来源**：Storylet 的 director_note + forbidden_topics
- **发言决策**：采用 DRAMA LLAMA 风格，由 `_decide_speakers()` 每轮 LLM 自决发言角色（单角色 / 双角色），fallback 到 Storylet 的 `character_focus` 字段

---

#### 2.2.4 Input Parser 层 —— "玩家输入守门人"

**类比**：DRAMA LLAMA 的自然语言理解

InputParser 是玩家输入进入系统的统一入口，承担两大职责。**不再做结构化意图分类**（intent/target/topic_tags），因为 CharacterAgent 和 Director 会自行理解玩家原文。

```python
# 职责 1：输入合法性检查（validate_input()）
# 两层过滤：规则层（正则）→ LLM 语义判断
{
  "valid": True/False,
  "severity": "soft" | "hard",   # soft: 角色困惑反应; hard: 忽略输入
  "reason": str | None,
  "response_mode": "confused" | "deflect" | "ignore" | None,
}

# 职责 2：语义条件匹配（analyze()）
# 合法性检查 + Storylet llm_trigger + Landmark llm_semantic 合并为一次 LLM 调用
{
  "valid": True/False,
  "severity": "soft" | "hard",
  "reason": str | None,
  "response_mode": str | None,
  "matched_conditions": ["sl_push_trip", "lm2→lm3a"],  # 命中的条件 id
}

# 分发策略：
# hard reject → 忽略输入（不生成角色响应）
# soft reject → 角色困惑反应（注入 Director 指令）
# valid       → 正常流程（matched_conditions 驱动下游选择）
```

**剪枝策略**：只收集当前 Landmark 范围内的语义条件（Storylet `llm_trigger` + 出边 `llm_semantic`），通常 2~15 条，无需向量检索。

**SemanticConditionStore**：条件索引接口。当前全量列表实现，`search()` 可替换为向量检索（cosine similarity top-k），上层 InputParser 无需改动。

**控制粒度总结**：
- **语义级**：检查输入合法性 + 匹配语义条件
- **不做结构化意图分类**：无下游消费者，CharacterAgent/Director 自行理解原文
- **合并为一次 LLM 调用**：旧设计中每个 llm_trigger 单独调 LLM，现在 analyze() 统一完成

---

### 2.3 控制粒度的动态调整

不同场景需要不同的控制粒度：

| 场景类型 | 推荐控制粒度 | 说明 |
|---------|-------------|------|
| **关键剧情节点**（秘密揭露） | 细（IBSEN 风格） | Director 指令更具体，检查更频繁 |
| **过渡场景**（日常对话） | 粗（DRAMA LLAMA 风格） | 给予角色更高自主性 |
| **情绪高潮** | 细 + 审查 | 迭代生成-审查机制 |
| **探索性对话** | 粗 | 让玩家自由探索，系统仅做 Salience 选择 |

---

## 三、与参考论文的对比总结

### 3.1 FacadeRemake 的独特设计

```
┌────────────────────────────────────────────────────────────────┐
│  借鉴来源              │  FacadeRemake 实现                     │
├────────────────────────────────────────────────────────────────┤
│  DRAMA LLAMA          │  Storylet + 自然语言 llm_trigger（InputParser 统一匹配）│
│  Dramamancer          │  Time-based fallback 机制              │
│  IBSEN                │  Director-Actor 分离 + Objective Check │
│  StoryVerse           │  Placeholder 占位符机制                │
│  Emily Short QBN      │  World State + Salience 评分           │
│  Triangle Framework   │  Landmark 作为叙事地标                 │
└────────────────────────────────────────────────────────────────┘
```

### 3.2 控制粒度决策矩阵

| 设计决策 | 选择 | 理由 |
|---------|------|------|
| **Landmark 推进判断** | 规则 + LLM 混合 | 规则保证确定性，LLM 提供灵活性 |
| **Storylet 选择** | Salience + 可选 LLM 评估 | 性能与质量平衡 |
| **角色生成控制** | Director Note（自然语言） | 比 IBSEN 的 keywords 更灵活，比直接台词更自由 |
| **内心独白** | 显式生成 | 实现"心口不一"的核心机制 |
| **跨场景一致性** | Placeholder 占位符 | 借鉴 StoryVerse，解决"第一幕的角色第四幕还是同一个" |
| **防停滞机制** | fallback_after_turns | 借鉴 Dramamancer Time-based Event |

### 3.3 与 Facade 原版的对比

| 维度 | Facade 原版 | FacadeRemake |
|------|------------|--------------|
| **叙事控制** | ABL 行为语言 + 手写规则 | LLM + Storylet 混合 |
| **角色生成** | 手写对话树 + 模板 | LLM 自由生成 + Director 约束 |
| **玩家输入** | 关键词匹配 | 合法性检查 + 语义条件匹配（InputParser） |
| **控制粒度** | 固定（Beat 级） | 可调节（粗→细） |
| **可扩展性** | 低（需手写内容） | 高（Storylet 可动态添加） |

---

## 四、待确认的设计问题

1. **LLM 评估器触发阈值**：✅ 已知：`story_selector.py` 中 `use_llm_evaluator = False`，默认关闭。何时启用？Top-3 Salience 分数差距小于多少时触发？尚未确定。

2. **Objective Checking 频率**：Landmark 进入/推进条件已用规则判断（`phone_incident`/`mother_slipped` 等 flag），暂未实现 LLM 语义判断版本。每隔 N 轮检查的机制还未做。

3. **Placeholder 作用域**：`narrative_placeholders` 在 `WorldState` 中已有字段，但跨 Landmark 的占位符清理逻辑尚未实现。

4. **Director Note 粒度**：✅ 目前 `director_note` 为 dict 格式，包含 `scene_setup`、`key_beats`、`tone` 等字段，已在生产中使用。可根据运行效果继续调整。

5. **内心独白可见性**：✅ 已实现调试模式（`💭 [xxx 内心]`）。是否给玩家某种"感知内心"机制暂未设计。

---

## 五、下一步行动建议

> 状态说明：✅ 已完成 | 🚧 进行中 | 📋 待做

1. ✅ **实现三步生成架构**：`_generate_inner_thought()` → `_select_behavior()` → 台词生成，已在 `llm_client.py` 中完整实现
2. ✅ **实现 `llm_trigger` 语义匹配**：已从 `storylet.py._check_llm_trigger()` 迁移到 `InputParser.analyze()`，与 Landmark `llm_semantic` 合并为一次 LLM 调用
3. ✅ **实现 player_mediated 检测**：`main.py._check_player_mediation()` 检测 20 个调解关键词
4. ✅ **实现角色行为库**：`data/character_behaviors.py` 已含 15 个行为，父亲/母亲各 10 个
5. ✅ **实现 DRAMA LLAMA 发言决策**：`_decide_speakers()` 每轮由 LLM 自决发言角色
6. 📋 **完善 fallback 机制**：Landmark 的 `or_turn_limit` 已定义，但 `fallback_storylet` 兜底触发逻辑需验证
7. 📋 **调优 Salience 权重**：需根据实际运行数据调整各 modifier 的权重
8. 📋 **LLM 评估器启用**：打开 `use_llm_evaluator = True` 并设计合适的 prompt 模板

---

> 最后更新：2026-04-23
