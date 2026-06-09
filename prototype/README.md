# FacadeRemake 原型

基于"叙事骨架+LLM Agent"双层架构的互动戏剧叙事系统后端，灵感来自 Facade(2005)与 IBSEN 导演-演员分离模型。

## 核心架构

系统采用五层叙事控制结构，自上而下保证主线可控、局部自主：

```
场景配置 (Scenario Config)
    │
    ▼
Landmark DAG  —— 叙事阶段级有向无环图，约束全局走向
    │
    ▼
Storylet 层   —— 场景片段（3-8轮），提供叙事目标与效果趋势大纲
    │
    ▼
Director BeatPlan —— 规划3-5步节拍序列，驱动角色自主推进
    │
    ▼
Character Agent —— 单次LLM调用输出 {thought, speech, action}，注入叙事意图
    │
    ▼
Input Parser  —— 玩家输入守门人（合法性检查 + 语义条件匹配）
```

核心循环：**BeatPlan角色说话 → player_turn → 玩家输入 → 新BeatPlan → …**。玩家输入即为BeatPlan终止信号，不做回应生成，仅做合法性验证与状态推进。

## 目录结构

```
prototype/
├── ws_server.py                 # FastAPI WebSocket 服务入口
├── requirements.txt
└── facade_remake/
    ├── main.py                  # 命令行入口
    ├── core/
    │   ├── world_state.py       # 世界状态容器（qualities, flags, relationships）
    │   ├── storylet.py          # Storylet 数据结构与管理器
    │   ├── landmark.py          # Landmark DAG 结构与转换逻辑
    │   ├── di_container.py      # 依赖注入容器（强制场景配置化）
    │   ├── input_parser.py      # InputParser 三层门控结构
    │   ├── state_manager.py     # 状态变更管理器
    │   ├── location_manager.py  # 角色位置追踪
    │   ├── narrative_orchestrator.py  # 叙事编排
    │   ├── game_log_writer.py   # 游戏日志输出
    │   └── logging.py           # 日志配置
    ├── agents/
    │   ├── llm_client.py        # LLM 客户端（OpenAI/DeepSeek 多 Provider）
    │   ├── character_agent.py   # 角色Agent（单次调用输出 thought/speech/action）
    │   ├── director.py          # DirectorAgent（BeatPlan生成 + GoalTracker）
    │   ├── input_parser.py      # InputParser LLM 代理
    │   └── story_selector.py    # 三层选择器（标签→条件→Salience）
    ├── config/
    │   ├── scenario_schema.py   # 场景配置 Schema 定义
    │   └── characters.py        # 角色相关工具
    ├── data/
    │   └── builtin_scenarios/
    │       └── dinner_party.py  # 演示场景：晚宴聚会（Trip & Grace）
    └── engine/
        ├── game_engine.py       # 游戏引擎核心
        ├── event_loop.py        # 异步事件循环
        ├── output.py            # 输出格式化
        └── output_parser.py     # 输出解析器
```

## 运行方式

### 命令行模式

```bash
cd prototype
pip install -r requirements.txt

# 使用 DeepSeek（默认）
cd facade_remake
python main.py --provider deepseek

# 使用 OpenAI
python main.py --provider openai

# 关闭调试输出
python main.py --no-debug
```

### WebSocket 服务模式（配合前端）

```bash
cd prototype
pip install -r requirements.txt
python ws_server.py
```

服务默认监听 `ws://localhost:8765`，前端连接后通过消息协议完成场景初始化与回合交互。

## 场景配置

系统完全配置化，无硬编码叙事内容。场景定义在 `data/builtin_scenarios/` 下，包含四个元素库（action / expression / prop / location）、角色配置（identity / personality / secret_knowledge / monologue_templates）、Storylet 集合与 Landmark DAG。

当前内置场景 `dinner_party` 复刻 Facade 原版剧情：玩家扮演 Trip 与 Grace 的大学老友，受邀做客时卷入两人濒临破裂的婚姻危机。双方各怀对方不知情的秘密，构成核心戏剧张力。

## LLM Provider 配置

支持 OpenAI 兼容 API，通过环境变量或命令行参数切换 Provider：

```bash
# 环境变量方式
export LLM_PROVIDER=deepseek
export LLM_API_KEY=sk-xxx
export LLM_BASE_URL=https://api.deepseek.com/v1
export LLM_MODEL=deepseek-chat

# 命令行方式
python main.py --provider openai
```

Provider 预设定义在 `agents/llm_client.py` 的 `PROVIDER_PRESETS` 字典中。

## 关键设计决策

**BeatPlan-only 架构**：所有角色对话统一由 Director 生成的 BeatPlan 驱动，Storylet 不再直接控制角色发言顺序。每次 BeatPlan 循环包含1次 Director 生成 + N次 CharacterAgent 调用（N=节拍数），省去每轮的 Director 指导 LLM 调用。

**单次 LLM 调用角色响应**：CharacterAgent 一次调用输出 `{thought, speech, action}`，延迟从原来的 6-12 秒降低到 2-4 秒。`beat_intent` 参数注入叙事意图，角色在 speech/action 层必须遵循意图氛围，thought 层允许内部矛盾。

**状态变化混合模型**：Storylet effects 提供趋势大纲（作者定义方向+范围），beat 级即时计算由规则引擎+玩家行为驱动。玩家可减缓趋势，不能完全逆转。

**异步双轨道事件循环**：player_input_loop 与 narrative_push_loop 以 asyncio.gather 并行运行，player_turn 有45秒超时，超时后角色催促。

## 当前实现状态

- [x] 五层叙事控制完整链路
- [x] Landmark DAG 跳转（条件/回合限制/兜底）
- [x] Storylet 三层选择机制
- [x] Director BeatPlan 生成与后处理校验
- [x] CharacterAgent 单次调用 + beat_intent
- [x] InputParser 三层门控（规则→LLM语义→条件匹配）
- [x] 多 Provider LLM 支持（OpenAI / DeepSeek）
- [x] 场景完全配置化（DI 容器强制注入）
- [x] WebSocket 服务（前后端通信）
- [x] 异步事件循环（双轨道并行）
- [x] 位置追踪与基于位置的 Storylet 转换

## 待实现

- [ ] LLM 评估器（Storylet 选择的 Top-K LLM 评分，当前默认关闭）
- [ ] Narrative Placeholder（跨 Storylet 叙事关键事件记录）
- [ ] Plot-based Reflection（每5轮角色内心动机更新）
- [ ] 保存/加载游戏状态
- [ ] 更多内置场景
