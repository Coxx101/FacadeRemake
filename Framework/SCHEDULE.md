# FacadeRemake 开发日程规划

> 目标：**4月10日** 完成 Python 端基本实现 + 论文第一、二章初稿
> 规划时间：2026-03-26 | 最后更新：2026-04-07

---

## 当前状态快照（更新于 2026-04-07）

### ✅ 代码已完成
- `WorldState` / `StoryletManager` / `LandmarkManager` / `StorySelector`
- `InputParser` + `CharacterAgent`（LLM调用，三步生成架构）
- `main.py` 主循环、Storylet切换、Landmark推进
- 结局检测逻辑（Act3 触发，4个结局）
- `conditional_effects` 条件效果执行
- **三步生成架构**：`_generate_inner_thought()` → `_select_behavior()` → 台词生成
- **角色行为库**：`data/character_behaviors.py`，15个行为（父亲/母亲各10个）
- **DRAMA LLAMA 发言决策**：`_decide_speakers()` 每轮 LLM 自决发言角色
- **`llm_trigger` 语义匹配**：`storylet.py._check_llm_trigger()` 已实现
- **player_mediated 检测**：`main.py._check_player_mediation()` 已实现
- **forbidden_reveals 防火墙**：已注入 CharacterAgent 系统 prompt

### ⚠️ 代码待完成（Python端现有缺口）
| 优先级 | 问题 | 说明 |
|--------|------|------|
| 🟡 中 | LLM 评估器未启用 | `story_selector.py` `use_llm_evaluator = False`，Top-K 戏剧性判断未激活 |
| 🟡 中 | fallback_storylet 兜底逻辑需验证 | `or_turn_limit` 已定义，但实际触发路径需测试 |
| 🟢 低 | Landmark 分支未引入（保持线性） | 当前 4 个线性节点，无 Deadly/Friendly 分支 |

### 📝 论文待完成
- 第一章：绪论（1.1–1.4 全部待写）
- 第二章：相关理论与技术基础（2.1–2.4 全部待写）
- 第三章起：4月10日后继续

---

## 阶段一：3/26 – 3/31（打通主线 + 论文第一章）

### 3/26–3/27 | 🔧 内容层补全
- [x] 补充完整 Storylet（共 15 个，覆盖 Act1/2/3）
- [x] 设计 4 个 Landmark 线性主干 + 4 个结局
- [x] 实现三步生成架构（内心独白 + 行为选择 + 台词生成）

### 3/28–3/29 | 🔧 Python 功能完善
- [x] 实现 `llm_trigger` 字段语义匹配（`_check_llm_trigger()`）
- [x] 实现 player_mediated 检测（`_check_player_mediation()`）
- [x] 实现 DRAMA LLAMA 风格发言决策（`_decide_speakers()`）
- [x] 实现角色行为库（`character_behaviors.py`）
- [ ] 启用 LLM 评估器（`use_llm_evaluator = True`，需调优 prompt）

### 3/30–3/31 | 📝 设计文档整理
- [x] 撰写叙事控制粒度设计文档（`NARRATIVE_CONTROL_GRANULARITY.md`）
- [x] 深度阅读 5 篇论文并写笔记（GENEVA/Piloto/Wu/NarrativeGenie/De Lima）
- [ ] 论文第一章初稿（实际未完成，顺延至4月）

---

## 阶段二：4/1 – 4/6（系统完整 + 论文第二章）

### 4/1–4/2 | 🔧 叙事内容设计
- [x] 完整 World State 变量表设计（21个 flag + 4个数值变量）
- [x] 4 种结局分支触发条件细化（已在代码中实现）
- [ ] 完整测试一局游玩路径（Act1→Act2→Act3→结局）

### 4/3–4/4 | 📝 论文第二章前半
- [ ] 2.1 互动叙事核心理论（本质矛盾、Agency理论、叙事控制策略、戏剧三角、节奏控制）
- [ ] 2.2 互动小说叙事模型（传统分支结构、QBN、Salience、Waypoint、融合应用）

### 4/5–4/6 | 📝 论文第二章后半
- [ ] 2.3 大语言模型技术（原理、对话生成、角色扮演、幻觉控制）
- [ ] 2.4 多智能体系统（基本概念、协作机制、黑板系统、分布式决策）

---

## 阶段三：4/7 – 4/10（收尾对齐）

### 4/7（今天）| 📝 文档同步
- [x] 更新 `TECHNICAL_DESIGN.md` 至最新代码进度
- [x] 更新 `ARCHITECTURE.md`（v0.1→v0.3）
- [x] 更新 `STORYLET_DATA_STRUCTURE.md`（v0.1→v0.3）
- [x] 更新 `NARRATIVE_CONTROL_GRANULARITY.md`（v0.1→v0.3）
- [x] 更新 `NARRATIVE_REFERENCES.md`（v0.1→v0.3）

### 4/8 | 🔧 Python 端收尾测试
- [ ] 跑完整测试局（从开场到结局触发）
- [ ] 调试 Landmark 推进节奏（避免推进过快/卡死）
- [ ] 检查 `_decide_speakers()` + 三步生成的 LLM 调用链是否稳定
- [ ] 验证 `fallback_storylet` 兜底触发路径

### 4/9 | 📝 一二章修订与论文写作
- [ ] 根据代码实现细节，补充论文第三章技术描述
- [ ] 开始论文第一章初稿撰写
- [ ] 检查引文格式与参考文献对应关系

### 4/10 | ✅ 阶段验收

**代码侧：**
- [ ] Python 原型可完整游玩（含结局触发）
- [ ] 三步生成架构在真实对话中运行稳定
- [ ] Landmark 4 个阶段均可正常推进

**论文侧：**
- [ ] 第一章初稿完成（约 3000–4000 字）
- [ ] 第二章初稿完成（约 4000–5000 字）

---

## 4/10 之后（参考）

> 本阶段不需要计划，但可作为方向参考

- 第三章系统设计与实现（含架构图、时序图、代码展示）
- 第四章系统测试与评估
- Unity 对接原型（方案一：WebSocket桥接）
- 论文三四五章撰写与全文修订

---

## 📌 优先级原则

> 遇到时间冲突时，参考以下原则：

1. **完整一局可游玩 > LLM 评估器 > Landmark 分支树**
   → 首要目标是"能跑完一局"，评估器和分支是锦上添花

2. **第一章 > 第二章**
   → 第一章要讲清"为什么做"，难度更高；第二章有调研笔记打底相对好展开

3. **代码和论文不要同一天硬切换**
   → 上午代码下午论文效率会低，按整日或整天块来安排

