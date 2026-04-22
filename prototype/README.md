# FacadeRemake 原型

基于 LLM + Storylet 架构的互动叙事系统原型。

## 架构概述

```
玩家输入 → Input Parser(LLM) → World State 更新
                                    ↓
Story Selector ← Landmark 约束 ← 当前状态
        ↓
Storylet 选择 → 角色 Agent(LLM) 生成回应
        ↓
执行 Effects → 更新 World State → 下一轮
```

## 目录结构

```
facade_remake/
├── core/               # 核心模块
│   ├── world_state.py  # 世界状态管理
│   ├── storylet.py     # Storylet 数据结构
│   ├── landmark.py     # Landmark 系统
│   └── story_selector.py # Storylet 选择逻辑
├── agents/             # LLM Agent
│   └── llm_client.py   # LLM 客户端、输入解析、角色生成
├── data/               # 数据
│   └── default_storylets.py # 示例 Storylets 和 Landmarks
└── main.py             # 主程序
```

## 运行方式

### 1. 安装依赖

```bash
cd prototype
pip install -r requirements.txt
```

### 2. 配置 API Key（可选）

```bash
export OPENAI_API_KEY="your-api-key"
```

如果没有 API key，系统会进入 mock 模式，使用预设响应。

### 3. 运行

```bash
cd facade_remake
python main.py
```

## 游戏说明

- 你扮演一个刚回家的子女，面对父母微妙的婚姻危机
- 输入自然语言与父母对话
- 输入 `status` 查看当前状态
- 输入 `quit` 退出

## 当前实现

- [x] World State 管理
- [x] Storylet 数据结构
- [x] Landmark 系统
- [x] Story Selector（Salience 评分）
- [x] Input Parser（LLM）
- [x] 角色 Agent（LLM）
- [x] 主循环和 CLI 界面
- [x] 7个示例 Storylets
- [x] 4个示例 Landmarks

## 待完善

- [ ] LLM 评估器（Top-K 选择）
- [ ] Storylet 实时生成
- [ ] 更丰富的条件判断
- [ ] 保存/加载游戏状态
- [ ] 更多 Storylets 和 Landmarks
