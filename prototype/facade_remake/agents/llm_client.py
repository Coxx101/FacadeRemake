"""
LLM 客户端模块
封装 LLM 调用
"""
import os
from typing import Optional, Dict, Any, List, Union, Tuple
import json
import re
from pathlib import Path

# 加载 .env 文件（从项目根目录查找）
try:
    from dotenv import load_dotenv
    # 查找项目根目录（包含 .env.local 的目录）
    current_file = Path(__file__).resolve()
    project_root = current_file.parent.parent.parent  # facade_remake/agents/ -> facade_remake/ -> prototype/
    
    # 尝试加载 .env.local 或 .env
    env_local = project_root / ".env.local"
    env_file = project_root / ".env"
    
    if env_local.exists():
        load_dotenv(env_local)
    elif env_file.exists():
        load_dotenv(env_file)
    else:
        load_dotenv()  # 默认行为
except ImportError:
    pass


class LLMClient:
    """LLM 客户端"""
    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-3.5-turbo"):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.model = model
        self.debug = False  # 设为 True 时打印所有 LLM 请求/响应
        # on_debug: 可选回调，签名为 (event_type, payload_dict)
        # 用于将调试信息推送到前端等外部消费者
        self.on_debug: Optional[callable] = None

        if not self.api_key:
            raise RuntimeError(
                "未提供 OPENAI_API_KEY。请在 .env.local 或 .env 文件中设置 OPENAI_API_KEY 环境变量，"
                "或在构造 LLMClient 时传入 api_key 参数。"
            )

        import openai
        self.client = openai.OpenAI(api_key=self.api_key)

    def _emit_debug(self, event_type: str, payload: Dict):
        """同时输出到 print 和 on_debug 回调"""
        if self.debug:
            print(payload.get("_print", ""))
        if self.on_debug:
            # 清理内部字段
            clean = {k: v for k, v in payload.items() if not k.startswith("_")}
            self.on_debug(event_type, clean)

    def chat_completion(self, messages: List[Dict[str, str]],
                       temperature: float = 0.7,
                       max_tokens: Optional[int] = None) -> str:
        """调用聊天补全 API"""
        # 截断后的 messages 用于日志显示
        log_messages = []
        for msg in messages:
            content = msg.get("content", "")
            preview = content[:800] + f"... (truncated, total {len(content)} chars)" if len(content) > 800 else content
            log_messages.append({"role": msg.get("role", "?"), "content": preview})

        self._emit_debug("llm_request", {
            "_print": f"\n{'='*60}\n[LLM Request] model={self.model}, temp={temperature}, max_tokens={max_tokens}\n"
                      + "\n".join(f"  [{m['role'].upper()}] {m['content']}" for m in log_messages)
                      + "\n" + "-" * 60,
            "model": self.model,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "messages": log_messages,
        })

        kwargs = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature
        }
        if max_tokens is not None:
            kwargs["max_tokens"] = max_tokens
        response = self.client.chat.completions.create(**kwargs)
        content = response.choices[0].message.content

        self._emit_debug("llm_response", {
            "_print": f"  [LLM Response] {content}\n  {'-'*60}",
            "content": content,
        })

        return content

    def call_llm(self, prompt: str, max_tokens: Optional[int] = None,
                 temperature: float = 0.3) -> str:
        """单 prompt 调用封装（用于 Storylet 选择、Landmark 语义判断等内部评估）
        
        与 chat_completion 的区别：接受单条字符串 prompt，自动包装为 messages 格式。
        默认 temperature=0.3（确定性场景，如 YES/NO 判断）。
        """
        messages = [{"role": "user", "content": prompt}]
        return self.chat_completion(messages, temperature=temperature, max_tokens=max_tokens)
    




class CharacterAgent:
    """角色 Agent - 改进版

    行为库不再硬编码 import，而是通过 character_profile 中的
    behaviors（角色可用行为 ID 列表）和 behavior_meta（行为元数据字典）传入。
    """
    def __init__(self, llm_client: LLMClient, character: str,
                 character_profile: Dict = None):
        self.llm_client = llm_client
        self.character = character

        # 加载详细的角色配置
        if character_profile:
            self.profile = character_profile
        else:
            self.profile = {}

        # 行为库：从 profile 读取（由前端下发），无则禁用行为选择步骤
        self._behavior_ids: List[str] = self.profile.get("behaviors", [])
        self._behavior_meta: Dict[str, Dict] = self.profile.get("behavior_meta", {})
        self._behaviors_loaded = len(self._behavior_ids) > 0

    # ─────────────────────────────────────────────────────
    # Step 0：内心独白（Inner Thought）生成 - Monologue 版本
    # ─────────────────────────────────────────────────────
    def _generate_inner_thought(self, player_input: str,
                                storylet_content: Dict[str, Any],
                                world_state: Dict[str, Any],
                                conversation_history: List[str] = None) -> Tuple[str, Optional[Dict]]:
        """
        生成角色此刻的内心独白（IBSEN Monologue 机制）。

        设计原理：
        1. 优先使用预定义的 Monologue 知识库（情感化、第一人称）
        2. 基于当前情境（player_input + world_state）选择最相关的 monologue
        3. 如果没有匹配的，使用 LLM 生成（fallback）
        4. 使用中等 temperature（0.75）保留情感张力

        Monologue 的核心价值：让角色"心口不一"成为可能
        - 内心独白：真实的恐惧、愤怒、愧疚
        - 对外言行：掩饰、逃避、转移话题

        返回：(内心独白文本, 当前使用的 Monologue 条目)
        """
        profile = self.profile
        identity = profile.get("identity", "")
        monologue_knowledge = profile.get("monologue_knowledge", [])
        secret_knowledge = profile.get("secret_knowledge", [])
        director_note = storylet_content.get("director_note", "")
        narrative_goal = storylet_content.get("narrative_goal", "")

        # 获取当前情感状态（从 world_state 中读取）
        emotional_state = world_state.get("emotional_state", {}) if isinstance(world_state, dict) else {}
        current_emotion = emotional_state.get(self.character, "neutral")

        recent = ""
        if conversation_history:
            recent_lines = conversation_history[-4:]
            recent = "\n".join(recent_lines)

        # ── 策略 1：使用预定义 Monologue 知识库 ────────────────
        if monologue_knowledge:
            selected_monologue = self._select_relevant_monologue(
                player_input,
                monologue_knowledge,
                current_emotion,
                conversation_history
            )

            if selected_monologue:
                # 构建基于 Monologue 的 prompt
                monologue_text = selected_monologue["monologue"]
                emotion_tags = ", ".join(selected_monologue.get("emotion_tags", []))

                prompt = f"""你是戏剧角色 {self.character}。

【身份背景】
{identity}

【你内心深处的声音】
{monologue_text}

【本幕叙事目标】{narrative_goal}
【导演说明】{director_note}

【当前情绪标签】{emotion_tags}

最近的对话：
{recent}

刚才你的大学老友（玩家）说："{player_input}"

现在，请基于你"内心深处的声音"，用第一人称写出你此刻**真实的内心想法**（1-2句话）。
要求：
- 这是内心独白，不是说出口的话
- 可以和你即将说的话相矛盾（你可以心里想一件事，嘴上说另一件事）
- 反映你当前最真实的情绪、顾虑或打算
- 不要加任何标签或格式，直接输出内心独白文字
- 如果当前情境与你的内心声音相关，可以延伸和呼应

内心独白："""

                try:
                    response = self.llm_client.call_llm(prompt, max_tokens=80, temperature=0.75)
                    thought = response.strip()
                    # 清理可能的引号包裹
                    if thought.startswith('"') and thought.endswith('"'):
                        thought = thought[1:-1]
                    if thought.startswith('"') and thought.endswith('"'):
                        thought = thought[1:-1]
                    return thought, selected_monologue
                except Exception as e:
                    print(f"[thought] 内心独白生成失败（{e}），跳过")
                    return "", None

        # ── 策略 2：Fallback - 使用简单的 secret_knowledge ─────
        secret_text = "\n".join([f"- {item}" for item in secret_knowledge]) if secret_knowledge else ""
        secret_section = f"【你内心知道的秘密/隐情】\n{secret_text}" if secret_text else ""

        prompt = f"""你是戏剧角色 {self.character}。

【身份】{identity}
{secret_section}

【本幕叙事目标】{narrative_goal}
【导演说明】{director_note}

最近的对话：
{recent}

刚才你的大学老友（玩家）说："{player_input}"

现在，请用第一人称写出你此刻**真实的内心想法**（1-2句话）。
要求：
- 这是内心独白，不是说出口的话
- 可以和你即将说的话相矛盾（你可以心里想一件事，嘴上说另一件事）
- 反映你当前最真实的情绪、顾虑或打算
- 不要加任何标签或格式，直接输出内心独白文字

内心独白："""

        try:
            response = self.llm_client.call_llm(prompt, max_tokens=80, temperature=0.75)
            thought = response.strip()
            if thought.startswith('"') and thought.endswith('"'):
                thought = thought[1:-1]
            if thought.startswith('"') and thought.endswith('"'):
                thought = thought[1:-1]
            return thought, None
        except Exception as e:
            print(f"[thought] 内心独白生成失败（{e}），跳过")
            return "", None
    
    def _select_relevant_monologue(self, player_input: str,
                                   monologue_knowledge: List[Dict],
                                   current_emotion: str,
                                   conversation_history: List[str] = None) -> Optional[Dict]:
        """
        基于当前情境选择最相关的 Monologue。

        选择策略：
        1. 分析 player_input 中的关键词
        2. 检查 world_state 中的情绪状态
        3. 扫描 conversation_history 中的情感变化
        4. 综合评分，选择最匹配的 Monologue

        Args:
            player_input: 玩家输入
            monologue_knowledge: Monologue 知识库
            current_emotion: 当前情绪状态
            conversation_history: 对话历史

        Returns:
            选中的 Monologue 条目，如果没有匹配的返回 None
        """
        # 关键词到 Monologue 类别的映射
        keyword_to_category = {
            "钱": ["核心秘密", "现实压力"],
            "工资": ["现实压力"],
            "工作": ["现实压力"],
            "金融": ["现实压力"],
            "投资": ["现实压力"],
            "结婚": ["心理博弈", "临界状态"],
            "离婚": ["心理博弈", "临界状态"],
            "吵架": ["心理博弈"],
            "生气": ["心理博弈"],
            "瞒": ["核心秘密", "认知盲区"],
            "骗": ["核心秘密"],
            "知道": ["认知盲区"],
            "出轨": ["核心秘密", "心理博弈"],
            "外遇": ["核心秘密", "心理博弈"],
            "情人": ["核心秘密"],
            " affair": ["核心秘密"],
            "艺术": ["心理压抑"],
            "画画": ["心理压抑"],
            "画": ["心理压抑"],
            "装修": ["心理压抑", "核心秘密"],
            "公寓": ["心理压抑"],
            "窗帘": ["心理压抑"],
            "创作": ["心理压抑"],
            "Vince": ["核心秘密"],
            "vince": ["核心秘密"],
            "信任": ["核心秘密"],
            "坦白": ["核心秘密", "心理博弈"],
            "秘密": ["核心秘密"],
            "愧疚": ["核心秘密"],
            "原谅": ["心理博弈", "临界状态"],
            "抱歉": ["心理博弈"],
        }
        
        # 情绪状态到类别的映射
        emotion_to_category = {
            "anxious": ["核心秘密"],
            "guilty": ["核心秘密", "心理博弈"],
            "defensive": ["核心秘密", "认知盲区"],
            "angry": ["心理博弈", "临界状态"],
            "sad": ["心理博弈", "临界状态"],
            "neutral": ["核心秘密", "心理压抑"],
            "hopeful": ["心理压抑"],
            "desperate": ["核心秘密", "临界状态"],
        }
        
        # 分析 player_input 中的关键词
        input_lower = player_input.lower() if player_input else ""
        matched_categories = set()
        
        for keyword, categories in keyword_to_category.items():
            if keyword in input_lower:
                matched_categories.update(categories)
        
        # 分析当前情绪
        if current_emotion in emotion_to_category:
            matched_categories.update(emotion_to_category[current_emotion])
        
        # 如果没有匹配，尝试用 LLM 来判断哪个 monologue 最相关
        if not matched_categories and monologue_knowledge:
            return self._llm_select_monologue(player_input, monologue_knowledge, conversation_history)
        
        # 从知识库中选择匹配的 Monologue
        for monologue in monologue_knowledge:
            if monologue.get("category") in matched_categories:
                return monologue
        
        # 如果仍然没有匹配，返回第一个（核心秘密）
        if monologue_knowledge:
            return monologue_knowledge[0]
        
        return None
    
    def _llm_select_monologue(self, player_input: str,
                              monologue_knowledge: List[Dict],
                              conversation_history: List[str] = None) -> Optional[Dict]:
        """
        使用 LLM 选择最相关的 Monologue（高级模式）。
        
        当关键词匹配失败时，调用 LLM 分析当前情境，
        选择最能反映角色内心状态的 Monologue。
        """
        recent = ""
        if conversation_history:
            recent_lines = conversation_history[-3:]
            recent = "\n".join(recent_lines)
        
        # 构建选择 prompt
        options_text = "\n".join([
            f"{i+1}. [{m['id']}] {m['category']}: {m['monologue'][:50]}..."
            for i, m in enumerate(monologue_knowledge)
        ])
        
        prompt = f"""作为角色 {self.character}，分析以下情境：

当前情境：
- 玩家说："{player_input}"
- 最近对话：{recent}

可选的内心独白选项：
{options_text}

请选择最符合角色当前心理状态的选项编号（只输出数字，如 "1"）。
考虑：
1. 角色此刻最可能在想什么？
2. 哪个内心独白与当前情境最相关？
3. 不要选择与角色身份不符的选项。

你的选择（只输出数字）："""

        try:
            response = self.llm_client.call_llm(prompt, max_tokens=10, temperature=0.3)
            # 解析数字
            import re
            match = re.search(r'\d+', response)
            if match:
                index = int(match.group()) - 1
                if 0 <= index < len(monologue_knowledge):
                    print(f"[monologue] LLM 选择: {monologue_knowledge[index]['id']}")
                    return monologue_knowledge[index]
        except Exception as e:
            print(f"[monologue] LLM 选择失败: {e}")
        
        # Fallback：返回第一个
        return monologue_knowledge[0] if monologue_knowledge else None

    # ─────────────────────────────────────────────────────
    # Step A：行为选择（StoryVerse Action Schema 风格）
    # ─────────────────────────────────────────────────────
    def _select_behavior(self, player_input: str, storylet_content: Dict[str, Any],
                         world_state: Dict[str, Any],
                         conversation_history: List[str] = None,
                         allowed_behaviors: List[str] = None) -> str:
        """
        两步生成的第一步：让 LLM 从行为库中选择一个最合适的行为 ID。

        这一步使用低 temperature（0.1）确保选择的确定性，
        prompt 简短，只要求返回一个行为 ID。

        Args:
            allowed_behaviors: Storylet 约束的可用行为白名单。None 表示全部可用。

        Returns:
            行为 ID 字符串（如 "deflect"、"admit" 等）
        """
        if not self._behaviors_loaded:
            return "surface_normal"

        # 根据 allowed_behaviors 白名单过滤
        available = self._behavior_ids
        if allowed_behaviors:
            available = [b for b in available if b in allowed_behaviors]

        # 构建行为列表文本
        lines = []
        for i, bid in enumerate(available, 1):
            meta = self._behavior_meta.get(bid, {})
            label = meta.get("label", bid)
            desc = meta.get("description", "")
            lines.append(f"{i}. {bid}（{label}）：{desc}")
        behavior_list = "\n".join(lines)
        profile = self.profile
        narrative_goal = storylet_content.get("narrative_goal", "")
        director_note = storylet_content.get("director_note", "")
        personality = profile.get("personality", "")

        # 最近 3 条对话历史（上下文）
        recent = ""
        if conversation_history:
            recent_lines = conversation_history[-3:]
            recent = "\n".join(recent_lines)

        prompt = f"""你是戏剧角色 {self.character}。

角色性格：{personality}
叙事目标：{narrative_goal}
导演指导：{director_note}
玩家（你的大学老友）刚刚说："{player_input}"
最近对话：
{recent}

请从以下行为列表中选择一个最适合当前情境的行为，只输出行为的英文 ID，不要有其他内容：

{behavior_list}

你的选择（只输出 ID）："""

        try:
            response = self.llm_client.call_llm(prompt, max_tokens=20, temperature=0.1)
            # 解析行为 ID
            response_lower = response.lower().strip()
            behavior_id = "surface_normal" if "surface_normal" in available else (available[0] if available else "surface_normal")
            if response_lower in available:
                behavior_id = response_lower
            else:
                for bid in available:
                    if bid in response_lower:
                        behavior_id = bid
                        break
            meta = self._behavior_meta.get(behavior_id, {})
            print(f"[behavior] {self.character} 选择行为：{behavior_id}（{meta.get('label', '')}）")
            return behavior_id
        except Exception as e:
            print(f"[behavior] 行为选择失败（{e}），使用兜底行为")
            return "surface_normal" if "surface_normal" in available else (available[0] if available else "surface_normal")

    def generate_response(self, player_input: str, storylet_content: Dict[str, Any],
                         world_state: Dict[str, Any], conversation_history: List[str] = None,
                         director_instruction: str = "",
                         forbidden_topics: List[str] = None,
                         allowed_behaviors: List[str] = None,
                         banter_context: Dict[str, Any] = None) -> Dict[str, str]:
        """生成角色回应 - 三步生成：内心独白 → 行为选择 → 台词/动作生成

        设计参考：
        - DRAMA LLAMA：不预设发言角色，由上下文自然决定
        - StoryVerse 4.4：Action Schema 显式行为库
        - IBSEN：结构化历史 + NG重试 + 重复检测
        - 本项目扩展：Monologue 第一人称记忆 + 内心独白层（thought），可与言行不一致（心口不一）

        Args:
            player_input: 玩家输入文本（banter 模式下为 None）
            storylet_content: 当前 Storylet 内容
            world_state: 世界状态
            conversation_history: 对话历史
            director_instruction: 导演指导文本
            forbidden_topics: 禁止话题列表
            allowed_behaviors: 允许的行为列表
            banter_context: 角色间对话上下文（非 None 时表示 banter 模式）
                {
                    "trigger_character": str,  # 触发本轮对话的角色（初始说话者）
                    "target_character": str,    # 当前需要接话的角色
                    "banter_round": int,        # 第几轮 banter
                }

        Returns:
            Dict with keys:
                "thought"       - 角色内心独白（第一人称真实想法，不对外显示）
                "speech"        - 角色说出口的话（可能与 thought 矛盾）
                "action"        - 伴随的肢体动作/神情描述（可为空字符串）
                "emotion_tags"  - 当前情绪标签（来自 Monologue 知识库）
        """

        # ── 获取角色配置 ────────────────────────────────
        profile = self.profile
        identity = profile.get("identity", "")
        personality = profile.get("personality", "")
        background = profile.get("background", [])
        secret_knowledge = profile.get("secret_knowledge", [])
        ng_words = profile.get("ng_words", [])
        monologue_knowledge = profile.get("monologue_knowledge", [])
        background_text = "\n".join([f"- {item}" for item in background])
        secret_text = "\n".join([f"- {item}" for item in secret_knowledge]) if secret_knowledge else ""

        director_note = storylet_content.get("director_note", "")
        narrative_goal = storylet_content.get("narrative_goal", "")
        tone = storylet_content.get("tone", "neutral")

        temperature = 0.6

        # ── Step 0：内心独白（Monologue 版本）───────────────
        inner_thought = ""
        current_monologue = None  # 保存当前使用的 Monologue 条目
        # banter 模式下用 trigger_character 的最后一句话作为触发
        monologue_trigger = player_input
        if banter_context and not monologue_trigger:
            # 从对话历史中找对方的最后一句话作为内心独白触发
            trigger_char = banter_context.get("trigger_character", "")
            for line in reversed(conversation_history or []):
                if line.startswith(f"{trigger_char}:"):
                    monologue_trigger = line.split(":", 1)[1].strip()
                    break
        if monologue_trigger:  # 有触发内容时才生成内心独白
            inner_thought, current_monologue = self._generate_inner_thought(
                monologue_trigger, storylet_content, world_state, conversation_history
            )
            if inner_thought:
                emotion_tags = current_monologue.get("emotion_tags", []) if current_monologue else []
                tags_str = ", ".join(emotion_tags) if emotion_tags else "未知"
                print(f"[thought] {self.character} 心里想: {inner_thought} （情绪标签: {tags_str}）")

        # ── Step A：行为选择 ─────────────────────────────
        selected_behavior = "surface_normal"
        behavior_instruction = ""

        if self._behaviors_loaded and (player_input or banter_context):
            selected_behavior = self._select_behavior(
                player_input, storylet_content, world_state,
                conversation_history, allowed_behaviors
            )
            meta = self._behavior_meta.get(selected_behavior, {})
            label = meta.get("label", selected_behavior)
            behavior_desc = meta.get("description", "")
            tone_hint = meta.get("tone_hint", tone)

            behavior_instruction = (
                f"【当前行为模式】{selected_behavior}（{label}）\n"
                f"执行方式：{behavior_desc}\n"
                f"情绪基调覆盖：{tone_hint}"
            )
            tone = tone_hint

        # ── Step B：构建 system 消息（IBSEN 风格）─────────
        forbidden_text = ""
        if forbidden_topics:
            topics_str = "、".join(forbidden_topics)
            forbidden_text = f"\n【绝对禁止】在当前场景中，你绝对不能主动提及或暗示以下话题：{topics_str}。如果被追问，请用转移话题、沉默或模糊回答来回避。"

        # 内心独白注入：知道真实想法，但不一定说出来
        thought_context = ""
        if inner_thought:
            thought_context = f"\n【你此刻内心真实想法】{inner_thought}\n（注意：你不会直接说出内心想法，你的言行可以和内心相矛盾）"

        # 提前构建可能含换行的字段（避免 f-string 嵌套反斜杠问题）
        secret_section = f"【你知道的/你不知道的】\n{secret_text}" if secret_text else ""
        extra_instruction = f"【额外指令】{director_instruction}" if director_instruction else ""

        # 叙事目标指令：从静态描述改为行为引导
        if narrative_goal:
            goal_instruction = f"""【当前场景与叙事目标】
{narrative_goal}

你的每一句台词和每一个动作都必须服务于这个叙事目标。思考：
- 你在这个场景中要制造/维持/打破什么？
- 你的言行如何让这个目标更近一步？
- 如果目标是制造紧张感，不要轻易化解矛盾；如果目标是掩盖秘密，不要主动透露。"""
        else:
            goal_instruction = ""

        # banter 模式下的特殊指令
        if banter_context:
            trigger_char = banter_context.get("trigger_character", "对方")
            banter_round = banter_context.get("banter_round", 1)
            char_display = {"trip": "Trip", "grace": "Grace"}
            trigger_display = char_display.get(trigger_char, trigger_char)

            key_instruction = (
                f"1. 你正在和{trigger_display}（你的配偶）对话，对话历史的最后一行是ta刚刚说的话，你的回复必须直接回应ta。"
                f"玩家也在场，但这一轮是你们两人之间的对话，不要把话头转向玩家。"
            )
            if banter_round > 1:
                key_instruction += f"\n2. 你们已经聊了{banter_round}轮，如果话题自然结束就简短收尾。"
            else:
                key_instruction += "\n2. 不要重复你之前说过的话，不要回答历史中更早的问题。"
        else:
            key_instruction = (
                "1. 对话历史的最后一行是玩家（你的大学老友）刚刚说的话，你的回复必须直接回应这一行。\n"
                "2. 不要重复你之前说过的话，不要回答历史中更早的问题。"
            )

        system_content = f"""你是一场戏剧中的角色：{self.character}。和你在一起的是你的配偶以及你们共同的大学老友（玩家）。

【身份】{identity}

【性格】{personality}

【背景】
{background_text}
{secret_section}

{goal_instruction}
{director_note and "【导演指导】" + director_note}
【情绪基调】{tone}
{behavior_instruction}
{extra_instruction}{forbidden_text}{thought_context}

【关键指令】
{key_instruction}
3. 只输出 JSON，不要有任何其他文字。
4. 只能扮演 {self.character}，不能扮演其他角色。
5. 语气要自然——像真实的人一样对话，不要过于正式或戏剧化。

JSON 格式：
{{"speech": "你说的话", "action": "*动作描述*"}}"""

        # ── 构建对话历史（IBSEN 风格）──────────────────────
        # 关键修复：玩家输入作为待回复行（而非指令），让 LLM 明确知道在回应什么
        structured_history = self._build_dialogue_history_for_actor(conversation_history, player_input)

        # ── 组装 messages ─────────────────────────────────
        messages = [{"role": "system", "content": system_content}]

        for turn in structured_history:
            role = turn["role"]
            content = turn["content"]
            if role == self.character:
                messages.append({"role": "assistant", "content": content})
            elif role == "旁白":
                messages.append({"role": "user", "content": f"（{content}）"})
            elif role == "__INPUT__":
                # IBSEN 风格：玩家输入作为 user 消息末尾的行（待回复行）
                messages.append({"role": "user", "content": content})
            else:
                messages.append({"role": "user", "content": f"{role}: {content}"})

        # ── 调试输出 ──────────────────────────────────────
        print(f"\n{'='*80}")
        print(f"[DEBUG] {self.character} 的 messages（行为：{selected_behavior}）")
        print(f"  [storylet_content keys] {list(storylet_content.keys())}")
        if narrative_goal:
            print(f"  [narrative_goal] {narrative_goal[:80]}{'...' if len(narrative_goal) > 80 else ''}")
        else:
            print(f"  [narrative_goal] (空)")
        if director_note:
            print(f"  [director_note] {director_note[:80]}{'...' if len(director_note) > 80 else ''}")
        else:
            print(f"  [director_note] (空)")
        for i, msg in enumerate(messages):
            content_preview = msg['content'][:120]
            print(f"  [{i}] {msg['role'].upper()}: {content_preview}{'...' if len(msg['content']) > 120 else ''}")
        print(f"{'='*80}\n")

        # ── 生成 + IBSEN 式 NG 重试 + 自验证 ───────────────
        raw_result = self._generate_with_ng_retry(messages, ng_words, temperature)

        # ── IBSEN 自验证步骤 1：检查是否角色一致 ─────────────
        raw_result = self._verify_and_fix_response(
            raw_result, messages, ng_words, temperature,
            player_input  # 传入当前问题用于验证
        )

        # ── 解析 JSON 结果 ────────────────────────────────
        speech, action = self._parse_speech_action(raw_result)

        # ── IBSEN 式重复检测（对 speech 部分做检测）────────
        history_contents = [t["content"] for t in structured_history if t["role"] != "__INPUT__"]
        if speech and self._is_too_similar(speech, history_contents):
            print(f"[DEBUG] {self.character} 回应与历史过于相似，重新生成...")
            short_messages = [messages[0]] + messages[-2:]
            raw_result = self._generate_with_ng_retry(short_messages, ng_words, temperature)
            raw_result = self._verify_and_fix_response(
                raw_result, messages, ng_words, temperature, player_input
            )
            speech, action = self._parse_speech_action(raw_result)

        return {
            "thought": inner_thought,
            "speech": speech,
            "action": action,
            "emotion_tags": current_monologue.get("emotion_tags", []) if current_monologue else [],
        }




    def _parse_speech_action(self, raw: str) -> tuple:
        """从 LLM 输出中解析 speech 和 action 字段。
        
        容错处理：
        - 标准 JSON → 直接解析
        - 非 JSON 或解析失败 → 把全部内容作为 speech，action 为空
        """
        cleaned = raw.strip()
        # 去掉可能的 markdown 代码块
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            cleaned = "\n".join(lines[1:-1]) if len(lines) > 2 else cleaned
        
        try:
            data = json.loads(cleaned)
            speech = self._strip_name_prefix(str(data.get("speech", "")))
            action = str(data.get("action", ""))
            return speech, action
        except (json.JSONDecodeError, Exception):
            # 容错：把整段文本作为 speech
            return self._strip_name_prefix(cleaned), ""

    def _generate_with_ng_retry(self, messages: List[Dict], ng_words: List[str],
                                 temperature: float, max_retry: int = 3) -> str:
        """IBSEN 风格：检测到 NG words 则重新生成，而非简单替换"""
        result = self.llm_client.chat_completion(messages, temperature=temperature)
        print(f"[DEBUG] {self.character} 原始响应: {result}")

        retry = 0
        while self._contains_ng_words(result, ng_words) and retry < max_retry:
            retry += 1
            print(f"[DEBUG] 检测到 NG words，第 {retry} 次重试...")
            # IBSEN：重试时追加一条 system 提示
            retry_messages = messages + [{
                "role": "system",
                "content": "注意：你正在扮演一个戏剧角色，请保持角色身份，不要暴露自己是AI，不要使用不自然的称呼。"
            }]
            result = self.llm_client.chat_completion(retry_messages, temperature=temperature)
            print(f"[DEBUG] {self.character} 重试响应: {result}")

        # 清理开头可能的角色名前缀（"mother: " 等）
        result = self._strip_name_prefix(result)
        return result

    def _build_dialogue_history_for_actor(self, history: List[str], player_input: str = None) -> List[Dict[str, str]]:
        """
        IBSEN 风格：构建对话历史。

        关键区别于旧版 _build_structured_history：
        1. 玩家输入被标记为 __INPUT__，放在历史末尾作为待回复行
        2. 让 LLM 清楚知道自己在回应哪句话（而不是重复之前的回答）
        3. 历史限制在最近 6 条，避免上下文过长导致混淆

        IBSEN 参考（prompter.py:build_dialogue_history）：
        - 历史末尾追加 "{name}: " 形式的待回复行
        - 模型被引导续写这个空行
        """
        if not history:
            return []

        structured = []
        for line in history[-6:]:
            if ": " in line:
                role, content = line.split(": ", 1)
                structured.append({"role": role.strip(), "content": content.strip()})
            else:
                structured.append({"role": "旁白", "content": line})

        # 玩家输入作为待回复行（IBSEN 核心机制）
        if player_input and player_input.strip():
            structured.append({"role": "__INPUT__", "content": f"玩家: {player_input}"})

        return structured

    def _build_structured_history(self, history: List[str]) -> List[Dict[str, str]]:
        """将字符串历史列表转为结构化字典列表，取最近 6 条"""
        if not history:
            return []
        structured = []
        for line in history[-6:]:
            if ": " in line:
                role, content = line.split(": ", 1)
                structured.append({"role": role.strip(), "content": content.strip()})
            else:
                structured.append({"role": "旁白", "content": line})
        return structured

    def _contains_ng_words(self, text: str, ng_words: List[str]) -> bool:
        """检查文本是否包含 NG words（支持正则）"""
        for ng in ng_words:
            if re.search(ng, text):
                return True
        return False

    def _is_too_similar(self, result: str, history_contents: List[str],
                        threshold: float = 0.5) -> bool:
        """IBSEN 风格：检测回应是否与历史内容过于相似（编辑距离）"""
        if not history_contents:
            return False
        for content in history_contents:
            if len(result) == 0 or len(content) == 0:
                continue
            # 简单的字符重叠比例
            shorter = min(len(result), len(content))
            longer = max(len(result), len(content))
            common = sum(c in content for c in result)
            similarity = common / longer if longer > 0 else 0
            if similarity > threshold:
                return True
        return False

    def _verify_and_fix_response(self, result: str, messages: List[Dict],
                                   ng_words: List[str], temperature: float,
                                   player_input: str) -> str:
        """
        IBSEN 风格：自验证步骤（prompter.py:242-254）。

        问题现象：LLM 有时会角色混乱，输出 meta 文本或重复之前的回答。

        验证逻辑：
        1. 检查是否包含了 ng_words
        2. 检查输出是否在回应当前问题（而非历史问题）
        3. 如果不合法，要求模型修正

        Args:
            result: 原始 LLM 输出
            messages: 原始消息列表（用于构建修正 prompt）
            ng_words: NG 词列表
            temperature: 生成温度
            player_input: 玩家的当前问题（用于验证相关性）

        Returns:
            修正后的合法响应
        """
        # ── Step 1：NG 重试 ───────────────────────────────
        if self._contains_ng_words(result, ng_words):
            print(f"[VERIFY] {self.character} 包含 NG words，重新生成...")
            retry_messages = messages + [{
                "role": "system",
                "content": "注意：你正在扮演一个戏剧角色，请保持角色身份，不要暴露自己是AI。"
            }]
            result = self.llm_client.chat_completion(retry_messages, temperature=temperature)
            print(f"[VERIFY] 重试结果: {result[:100]}...")

        # ── Step 2：检查是否回应了当前问题 ───────────────
        # 如果玩家问的是晚饭，但回应的是"最近忙吗"，说明混淆了
        result_lower = result.lower()
        player_lower = player_input.lower()

        # 检测关键词冲突
        dinner_keywords = ["晚饭", "晚餐", "饭", "吃", "吃什么"]
        busy_keywords = ["忙", "工作", "最近", "还好"]

        player_mentions_dinner = any(k in player_lower for k in dinner_keywords)
        player_mentions_busy = any(k in player_lower for k in busy_keywords)

        result_mentions_dinner = any(k in result_lower for k in dinner_keywords)
        result_mentions_busy = any(k in result_lower for k in busy_keywords)

        # 如果玩家问晚饭但回应不相关，重新生成
        if player_mentions_dinner and not result_mentions_dinner and not result_mentions_busy:
            print(f"[VERIFY] {self.character} 似乎没有回应'晚饭'问题，重新生成...")
            # 追加明确的修正提示
            fix_messages = messages + [{
                "role": "system",
                "content": f"重要提醒：玩家刚才问的是「{player_input}」，请确保你的回应是在回答这个问题，而不是重复之前的对话。"
            }]
            result = self.llm_client.chat_completion(fix_messages, temperature=0.3)
            print(f"[VERIFY] 修正结果: {result[:100]}...")

        # ── Step 3：检查 JSON 格式有效性 ─────────────────
        cleaned = result.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            cleaned = "\n".join(lines[1:-1]) if len(lines) > 2 else cleaned

        try:
            data = json.loads(cleaned)
            # JSON 格式有效，继续
            pass
        except json.JSONDecodeError:
            print(f"[VERIFY] {self.character} 输出不是有效 JSON，重新生成...")
            fix_messages = messages + [{
                "role": "system",
                "content": "重要：请只输出 JSON 格式的回复，包含 speech 和 action 两个字段，不要有任何其他文字。格式示例：{\"speech\": \"你好。\", \"action\": \"*微笑*\"}"
            }]
            result = self.llm_client.chat_completion(fix_messages, temperature=0.3)
            print(f"[VERIFY] JSON修正结果: {result[:100]}...")

        result = self._strip_name_prefix(result)
        return result

    def _strip_name_prefix(self, text: str) -> str:
        """清理 LLM 可能在回应前加的角色名前缀"""
        prefixes = [
            "trip:", "trip：", "grace:", "grace：",
            "Trip:", "Trip：", "Grace:", "Grace：",
            "特拉维斯:", "特拉维斯：", "格蕾丝:", "格蕾丝：",
            "travis:", "travis：", "Travis:", "Travis：",
        ]
        cleaned = text.strip()
        for prefix in prefixes:
            if cleaned.lower().startswith(prefix.lower()):
                cleaned = cleaned[len(prefix):].strip()
                break
        return cleaned
    

