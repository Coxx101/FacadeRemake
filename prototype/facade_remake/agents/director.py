"""
Director Agent 模块 - 基于 IBSEN 论文的导演-演员系统

IBSEN 论文核心机制：
- Director（导演）：管理叙事目标、生成剧情指导、控制叙事节奏
- Actor（演员）：接收导演指导，结合角色记忆生成响应

FacadeRemake 的 Director 设计：
1. GoalTracker：追踪叙事目标进度，每 N 回合评估完成度
2. InstructionGenerator：基于当前 Storylet + 对话历史 + 世界状态生成动态指导
3. DirectorAgent：协调 GoalTracker 和 InstructionGenerator，为每个角色生成针对性指导
"""
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
import json


class GoalStatus(Enum):
    """叙事目标状态"""
    IN_PROGRESS = "in_progress"      # 进行中
    NEARLY_COMPLETE = "nearly_complete"  # 快完成
    COMPLETE = "complete"            # 已完成
    FAILED = "failed"               # 失败（需要干预）


@dataclass
class NarrativeGoal:
    """叙事目标数据结构"""
    id: str
    description: str               # 目标描述
    target_turns: int = 5          # 预期完成回合数
    current_turns: int = 0         # 当前已过回合数
    status: GoalStatus = GoalStatus.IN_PROGRESS
    interventions: int = 0         # 干预次数（Director 需要介入的次数）
    checkpoints: List[str] = field(default_factory=list)  # 目标检查点
    failed_attempts: int = 0        # 失败的尝试次数

    def advance_turn(self):
        """推进一回合"""
        self.current_turns += 1
        # 自动更新状态
        if self.current_turns >= self.target_turns:
            self.status = GoalStatus.NEARLY_COMPLETE

    def mark_complete(self):
        """标记为目标完成"""
        self.status = GoalStatus.COMPLETE

    def mark_intervention(self):
        """记录一次干预"""
        self.interventions += 1
        if self.interventions >= 3:
            self.status = GoalStatus.FAILED


@dataclass
class DirectorInstruction:
    """导演指导数据结构"""
    primary_goal: str               # 当前主要目标
    tone_guidance: str              # 情绪基调指导
    narrative_beat: str             # 本轮叙事节奏（推动/维持/高潮）
    character_specific: Dict[str, str] = field(default_factory=dict)  # 针对角色的指导
    forbidden_topics: List[str] = field(default_factory=list)  # 禁止话题
    optional_motivation: str = ""    # 可选的动机提示（给角色的内心提示）
    pacing_note: str = ""           # 节奏提示（加快/放慢/等待）


class GoalTracker:
    """
    叙事目标追踪器

    负责：
    1. 追踪当前 Storylet 的叙事目标进度
    2. 评估目标是否接近完成
    3. 检测目标是否需要 Director 干预
    """

    def __init__(self):
        self.current_goal: Optional[NarrativeGoal] = None
        self.goal_history: List[NarrativeGoal] = []
        self.default_target_turns = 5  # 默认目标回合数

    def set_goal(self, narrative_goal: str, target_turns: Optional[int] = None) -> NarrativeGoal:
        """
        设置新的叙事目标
        
        Args:
            narrative_goal: 叙事目标描述
            target_turns: 预期完成回合数（None 使用默认值）
        
        Returns:
            新创建的 NarrativeGoal
        """
        goal = NarrativeGoal(
            id=f"goal_{len(self.goal_history)}",
            description=narrative_goal,
            target_turns=target_turns or self.default_target_turns
        )
        self.current_goal = goal
        return goal

    def advance_turn(self):
        """推进回合计数器"""
        if self.current_goal:
            self.current_goal.advance_turn()

    def check_completion(self, world_state: Dict, 
                        dialogue_history: List[str],
                        llm_client) -> Tuple[GoalStatus, str]:
        """
        检查叙事目标完成状态

        Args:
            world_state: 当前世界状态
            dialogue_history: 对话历史
            llm_client: LLM 客户端

        Returns:
            (GoalStatus, reason) 元组
        """
        if not self.current_goal:
            return GoalStatus.COMPLETE, "无活跃目标"

        # 回合数检查
        if self.current_goal.current_turns >= self.current_goal.target_turns:
            if self.current_goal.status == GoalStatus.NEARLY_COMPLETE:
                # 需要 LLM 判断是否真的完成
                if llm_client:
                    return self._llm_check_completion(world_state, dialogue_history)
                return GoalStatus.NEARLY_COMPLETE, "目标回合数已到"

        # 检查关键检查点
        for checkpoint in self.current_goal.checkpoints:
            if not self._check_checkpoint(checkpoint, dialogue_history):
                return GoalStatus.IN_PROGRESS, f"检查点未完成: {checkpoint}"

        return self.current_goal.status, ""

    def _llm_check_completion(self, world_state: Dict,
                              dialogue_history: List[str]) -> Tuple[GoalStatus, str]:
        """使用 LLM 判断目标是否完成"""
        prompt = f"""你是一个叙事目标评估器。

当前叙事目标：{self.current_goal.description}
目标回合数：{self.current_goal.target_turns}
已过回合数：{self.current_goal.current_turns}

最近对话：
{chr(10).join(dialogue_history[-5:]) if dialogue_history else '(无)'}

请评估：这个叙事目标是否已经基本完成？
- "YES"：目标已完成或接近完成，角色已经做出了预期的反应
- "NO"：目标尚未完成，还需要更多回合

只回答 YES 或 NO："""

        try:
            response = llm_client.call_llm(prompt, max_tokens=10, temperature=0.0)
            response = response.strip().upper()
            if "YES" in response:
                self.current_goal.mark_complete()
                return GoalStatus.COMPLETE, "LLM 判定完成"
            else:
                return GoalStatus.IN_PROGRESS, "LLM 判定未完成"
        except Exception as e:
            return GoalStatus.IN_PROGRESS, f"LLM 检查失败: {e}"

    def _check_checkpoint(self, checkpoint: str, dialogue_history: List[str]) -> bool:
        """检查单个检查点"""
        history_text = " ".join(dialogue_history)
        # 简单的关键词检查（未来可升级为 LLM 判断）
        checkpoint_lower = checkpoint.lower()
        return any(keyword in history_text.lower() for keyword in checkpoint.split())

    def get_progress_report(self) -> str:
        """获取目标进度报告"""
        if not self.current_goal:
            return "无活跃目标"
        g = self.current_goal
        progress = min(100, int(g.current_turns / g.target_turns * 100))
        return f"目标进度: {progress}% ({g.current_turns}/{g.target_turns} 回合) | 状态: {g.status.value}"


class InstructionGenerator:
    """
    导演指导生成器

    负责：
    1. 根据当前情境生成针对性的角色指导
    2. 提供情绪基调、叙事节奏等元信息
    3. 确保角色行为服务于叙事目标
    """

    def __init__(self, llm_client=None):
        self.llm_client = llm_client

    def generate_instruction(self,
                            character: str,
                            storylet_content: Dict[str, Any],
                            world_state: Dict[str, Any],
                            dialogue_history: List[str],
                            current_goal: Optional[NarrativeGoal] = None) -> DirectorInstruction:
        """
        为指定角色生成导演指导

        Args:
            character: 角色名（trip/grace）
            storylet_content: 当前 Storylet 内容
            world_state: 世界状态
            dialogue_history: 对话历史
            current_goal: 当前叙事目标（可选）

        Returns:
            DirectorInstruction 对象
        """
        # 提取基本信息
        narrative_goal = storylet_content.get("narrative_goal", "")
        director_note = storylet_content.get("director_note", "")
        tone = storylet_content.get("tone", "neutral")
        allowed_behaviors = storylet_content.get("allowed_behaviors")

        # 获取当前 Landmark 的禁止话题
        forbidden = self._get_forbidden_topics(storylet_content)

        # 获取角色特定指导
        char_note = ""
        if isinstance(allowed_behaviors, dict):
            char_note = allowed_behaviors.get(character, "")

        # 生成叙事节奏指导
        pacing = self._generate_pacing_note(storylet_content, world_state, dialogue_history)

        # 生成情绪基调
        tone_guidance = self._generate_tone_guidance(tone, world_state, character)

        # 生成角色特定动机
        motivation = self._generate_motivation(character, storylet_content, world_state)

        return DirectorInstruction(
            primary_goal=narrative_goal,
            tone_guidance=tone_guidance,
            narrative_beat=pacing,
            character_specific={character: char_note} if char_note else {},
            forbidden_topics=forbidden,
            optional_motivation=motivation,
            pacing_note=pacing
        )

    def _get_forbidden_topics(self, storylet_content: Dict) -> List[str]:
        """获取禁止话题列表"""
        # 从 storylet content 中提取
        return storylet_content.get("forbidden_topics", [])

    def _generate_pacing_note(self, storylet_content: Dict,
                              world_state: Dict,
                              dialogue_history: List[str]) -> str:
        """
        生成叙事节奏指导

        根据当前状态判断：
        - push：推动剧情，制造张力
        - maintain：维持现状，保持张力
        - release：释放张力（目标快完成时）
        """
        # 检测张力水平
        tension = world_state.get("marriage_tension", 0)
        turns_in_storylet = len([h for h in dialogue_history if "玩家" in h])

        # 检测叙事阶段
        narrative_goal = storylet_content.get("narrative_goal", "")

        if "揭露" in narrative_goal or "摊牌" in narrative_goal:
            # 揭露/摊牌阶段：推动
            if tension >= 3:
                return "push"  # 高张力，推动到高潮
            else:
                return "maintain"  # 张力不够，维持积累
        elif "维持" in narrative_goal or "掩盖" in narrative_goal:
            # 维持/掩盖阶段
            return "maintain"
        elif "道歉" in narrative_goal or "原谅" in narrative_goal:
            # 修复阶段：释放
            return "release"
        elif turns_in_storylet >= 4:
            # 超过预期回合数，加快节奏
            return "accelerate"
        else:
            return "maintain"

    def _generate_tone_guidance(self, base_tone: str,
                               world_state: Dict,
                               character: str) -> str:
        """
        生成情绪基调指导

        结合基础基调 + 世界状态 + 角色特定情绪
        """
        tension = world_state.get("marriage_tension", 0)
        emotional_state = world_state.get("emotional_state", {})

        # 基础基调
        tone_mapping = {
            "热情但略显刻意的友好": "表面热情但暗藏紧张",
            "表面轻松，细节处有刺": "社交寒暄暗藏攻击性",
            "一杯酒里的地雷": "装修话题触发紧张",
            "一个男人防线松动时的自言自语": "防线松动，自言自语",
            "一个人终于决定说出那个秘密之前的一秒": "即将坦白前的犹豫",
            "一句把所有伪装都撕碎的话": "伪装撕碎，真相暴露",
            "八年积压在一句话里": "八年秘密积压爆发",
            "暴风雨之后最安静的一分钟": "暴风雨后的短暂平静",
            "所有的体面都剥落了，只剩下最真实的问题": "体面剥落，直面真相",
            "表面社交，暗流涌动": "表面社交，暗流涌动",
        }

        guidance = tone_mapping.get(base_tone, base_tone)

        # 叠加角色情绪
        char_emotion = emotional_state.get(character, "")
        if char_emotion:
            guidance += f" | 角色情绪：{char_emotion}"

        return guidance

    def _generate_motivation(self, character: str,
                            storylet_content: Dict,
                            world_state: Dict) -> str:
        """
        生成角色动机提示（给角色的内心提示）

        帮助角色理解"为什么要这样做"
        """
        narrative_goal = storylet_content.get("narrative_goal", "")
        director_note = storylet_content.get("director_note", "")

        # 基于叙事目标生成动机
        if "掩盖" in narrative_goal or "隐藏" in narrative_goal:
            if character == "trip":
                return "你现在最担心的是老友发现你和 Grace 之间的问题。要表现得若无其事。"
            else:
                return "你已经知道了关于 Trip 的一些事，但你要等他自己说。观察他的反应。"
        elif "维持" in narrative_goal:
            if character == "trip":
                return "尽量把话题岔开，聊一些轻松的事——装修、旅行、大学回忆。"
            else:
                return "你在等待一个契机。但现在不是时候。聊些别的。"
        elif "揭露" in narrative_goal or "摊牌" in narrative_goal:
            return "秘密已经浮出水面。你需要做出选择——面对还是逃避。"
        elif "道歉" in narrative_goal or "原谅" in narrative_goal:
            if character == "trip":
                return "这是你放下自尊的时刻。不要再逃避了。"
            else:
                return "你有权选择原谅或不原谅。但先听他把话说完。"
        elif "逼问" in narrative_goal or "追问" in narrative_goal:
            if character == "trip":
                return "防线正在松动。你快要说出来了，但还在犹豫。"
            else:
                return "你在旁边听着，内心复杂。"
        else:
            return ""

    def generate_llm_instruction(self,
                               character: str,
                               storylet_content: Dict[str, Any],
                               world_state: Dict[str, Any],
                               dialogue_history: List[str],
                               current_goal: Optional[NarrativeGoal] = None) -> str:
        """
        使用 LLM 生成更精细的导演指导

        这是 generate_instruction 的高级版本，提供更详细和动态的指导
        """
        if not self.llm_client:
            # 没有 LLM 客户端时返回简单指导
            instruction = self.generate_instruction(
                character, storylet_content, world_state, dialogue_history, current_goal
            )
            return self._instruction_to_text(instruction)

        # 构建上下文
        narrative_goal = storylet_content.get("narrative_goal", "")
        director_note = storylet_content.get("director_note", "")
        tone = storylet_content.get("tone", "neutral")

        # 获取角色配置
        char_configs = {
            "trip": {
                "role": "Trip（特拉维斯），30岁，金融行业，Grace 的丈夫，正在隐瞒自己的婚外情和对 Grace 艺术追求的压抑",
                "secret": "他也有婚外情，且一直无法接受 Grace 作为艺术家的身份",
                "emotion": "防御性强、自卑、外表热情但内心焦虑"
            },
            "grace": {
                "role": "Grace（格蕾丝），30岁，富裕家庭出身，有才华的艺术家，Trip 的妻子，背着与 Vince 的秘密",
                "secret": "她在 Trip 求婚前一晚与大学同学 Vince 发生了关系",
                "emotion": "失落、压抑、表面优雅但内心积压了大量不满"
            }
        }
        char_config = char_configs.get(character, {})

        recent_history = "\n".join(dialogue_history[-4:]) if dialogue_history else "(无)"

        prompt = f"""你是一个叙事导演，正在为一场戏剧生成导演指导。

【当前角色】
{char_config.get('role', '')}

【角色秘密】
{char_config.get('secret', '')}

【角色当前情绪】
{char_config.get('emotion', '')}

【叙事目标】
{narrative_goal}

【场景说明】
{director_note}

【情绪基调】
{tone}

【最近对话】
{recent_history}

请为这个角色生成导演指导，包含以下方面：
1. 本轮主要目标（1-2句话）
2. 情绪基调指导（具体的情绪词汇）
3. 叙事节奏（推动/维持/释放）
4. 对话策略建议（如何回应玩家输入）
5. 禁止行为（什么话不能说，什么动作不能做）

请用中文输出，格式简洁明了，像导演在给演员说戏一样。"""

        try:
            instruction_text = self.llm_client.call_llm(
                prompt, 
                max_tokens=200, 
                temperature=0.5
            )
            return instruction_text.strip()
        except Exception as e:
            # LLM 调用失败，返回简单版本
            instruction = self.generate_instruction(
                character, storylet_content, world_state, dialogue_history, current_goal
            )
            return self._instruction_to_text(instruction)

    def _instruction_to_text(self, instruction: DirectorInstruction) -> str:
        """将 DirectorInstruction 转换为文本格式"""
        lines = []

        if instruction.primary_goal:
            lines.append(f"【叙事目标】{instruction.primary_goal}")

        if instruction.tone_guidance:
            lines.append(f"【情绪基调】{instruction.tone_guidance}")

        if instruction.narrative_beat:
            beat_map = {
                "push": "推动剧情，制造张力",
                "maintain": "维持现状，保持张力",
                "release": "释放张力",
                "accelerate": "加快节奏"
            }
            lines.append(f"【叙事节奏】{beat_map.get(instruction.narrative_beat, instruction.narrative_beat)}")

        if instruction.forbidden_topics:
            lines.append(f"【禁止话题】{'、'.join(instruction.forbidden_topics)}")

        if instruction.optional_motivation:
            lines.append(f"【角色动机】{instruction.optional_motivation}")

        return "\n".join(lines)


class DirectorAgent:
    """
    导演 Agent（FacadeRemake 版）

    整合 GoalTracker 和 InstructionGenerator，为角色生成动态导演指导。

    与 IBSEN 的区别：
    - IBSEN：Director 生成完整的剧情脚本（outline），Actor 执行
    - FacadeRemake：Director 生成指导性指令（instruction），LLM Actor 自由发挥

    设计哲学：
    - 间接控制：Director 提供方向，不直接控制台词
    - 角色自主：Actor 有一定自由度，但服务于叙事目标
    - 动态调整：根据对话进展调整指导
    """

    def __init__(self, llm_client=None):
        self.llm_client = llm_client
        self.goal_tracker = GoalTracker()
        self.instruction_generator = InstructionGenerator(llm_client)
        self.debug_mode = False

        # 记录
        self.instruction_history: List[Dict] = []

    def set_debug(self, enabled: bool):
        """设置调试模式"""
        self.debug_mode = enabled

    def set_current_goal(self, narrative_goal: str, target_turns: Optional[int] = None):
        """
        设置当前叙事目标

        Args:
            narrative_goal: 叙事目标描述（通常来自 Storylet.narrative_goal）
            target_turns: 预期完成回合数
        """
        goal = self.goal_tracker.set_goal(narrative_goal, target_turns)
        if self.debug_mode:
            print(f"[Director] 设置新目标: {narrative_goal[:50]}... (目标回合: {target_turns or '默认5'})")
        return goal

    def advance_turn(self):
        """推进回合计数器"""
        self.goal_tracker.advance_turn()

    def generate_instruction_for(self,
                                character: str,
                                storylet_content: Dict[str, Any],
                                world_state: Dict[str, Any],
                                dialogue_history: List[str],
                                use_llm: bool = True) -> str:
        """
        为指定角色生成导演指导

        这是主入口方法，供 main.py 调用

        Args:
            character: 角色名
            storylet_content: 当前 Storylet 内容
            world_state: 世界状态
            dialogue_history: 对话历史
            use_llm: 是否使用 LLM 生成精细指导

        Returns:
            导演指导文本
        """
        # 获取当前目标
        current_goal = self.goal_tracker.current_goal

        # 生成指导
        if use_llm and self.llm_client:
            instruction_text = self.instruction_generator.generate_llm_instruction(
                character,
                storylet_content,
                world_state,
                dialogue_history,
                current_goal
            )
        else:
            instruction = self.instruction_generator.generate_instruction(
                character,
                storylet_content,
                world_state,
                dialogue_history,
                current_goal
            )
            instruction_text = self.instruction_generator._instruction_to_text(instruction)

        # 记录
        self.instruction_history.append({
            "turn": len(self.instruction_history),
            "character": character,
            "instruction": instruction_text,
            "goal": current_goal.description if current_goal else None
        })

        if self.debug_mode:
            print(f"[Director] 为 {character} 生成指导:")
            print(f"  {instruction_text[:100]}...")

        return instruction_text

    def check_and_update_goal(self,
                             world_state: Dict[str, Any],
                             dialogue_history: List[str]) -> Tuple[bool, str]:
        """
        检查叙事目标状态，必要时更新

        Args:
            world_state: 世界状态
            dialogue_history: 对话历史

        Returns:
            (是否需要干预, 原因)
        """
        status, reason = self.goal_tracker.check_completion(
            world_state,
            dialogue_history,
            self.llm_client
        )

        if self.debug_mode:
            print(f"[Director] 目标检查: {status.value} - {reason}")

        if status == GoalStatus.FAILED:
            # 目标失败，需要干预
            self.goal_tracker.current_goal.mark_intervention()
            return True, f"目标接近失败: {reason}"

        if status == GoalStatus.NEARLY_COMPLETE:
            # 目标快完成
            return False, "目标快完成"

        return False, reason

    def decide_speakers(self,
                       player_input: str,
                       storylet_content: Dict[str, Any],
                       dialogue_history: List[str],
                       characters: Optional[List[str]] = None) -> List[str]:
        """
        Director 决定本轮哪些角色回应及顺序。

        用 LLM 做决策（而非硬编码规则），让 Director 基于叙事语境做判断。
        唯一硬规则：玩家点名时，被点名者必须回应。

        Args:
            player_input: 玩家输入文本
            storylet_content: 当前 Storylet 内容
            dialogue_history: 对话历史
            characters: 在场角色列表（默认 trip, grace）

        Returns:
            角色名列表，例如 ["trip"] 或 ["grace", "trip"]
        """
        if characters is None:
            characters = ["trip", "grace"]

        narrative_goal = storylet_content.get("narrative_goal", "")
        director_note = storylet_content.get("director_note", "")
        tone = storylet_content.get("tone", "neutral")

        recent_text = "\n".join(dialogue_history[-6:]) if dialogue_history else "(无)"

        system_msg = """你是一个戏剧导演，负责决定每轮对话中哪个角色开口。

你的职责：
- 根据叙事情境判断谁应该说话，使对话自然且有戏剧张力
- 被点名的人必须回应——这是铁律，没有任何例外
- 另一个人是否追加回应，取决于话题是否与ta直接相关、ta在场是否会自然插话
- 大多数时候只有 1 个人回应；2 个人都回应需要有叙事理由

绝对禁止的行为：
- 玩家对 A 说话时，让 B 替 A 回答
- 玩家直接叫了某人的名字，却让另一个人开口

只输出角色名（英文小写），用逗号分隔。例如：trip 或 grace 或 grace,trip"""

        user_msg = f"""当前叙事目标：{narrative_goal}
场景说明：{director_note}
情绪基调：{tone}
在场角色：{', '.join(characters)}

最近对话：
{recent_text}

玩家刚才说："{player_input}"

谁应该回应？"""

        try:
            messages = [
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ]
            raw = self.llm_client.chat_completion(messages, temperature=0.2, max_tokens=20)
            raw = raw.strip().lower()
            speakers = []
            for name in raw.split(","):
                name = name.strip()
                if name in characters:
                    speakers.append(name)
            if speakers:
                if self.debug_mode:
                    print(f"[Director] 发言决策：{speakers}")
                return speakers
        except Exception as e:
            if self.debug_mode:
                print(f"[Director] 发言决策失败（{e}），使用兜底")

        # 兜底：仅检测点名，不用 character_focus
        player_lower = player_input.lower()
        mentioned = []
        if any(kw in player_lower for kw in ["trip", "特拉维斯"]):
            mentioned.append("trip")
        if any(kw in player_input for kw in ["grace", "格蕾丝"]):
            mentioned.append("grace")
        if mentioned:
            return mentioned
        # 最终兜底：两人都回应
        return characters

    def should_banter_continue(self,
                               last_speech: str,
                               last_character: str,
                               dialogue_history: List[str],
                               world_state: Dict[str, Any],
                               banter_round: int) -> Dict[str, Any]:
        """
        判断角色间对话是否应该继续（由 Director 动态决策）。

        在角色对话循环中，每句台词生成后调用此方法。
        Director 综合判断：对方是否需要接话、还能继续几轮。

        Args:
            last_speech: 上一句台词内容
            last_character: 说话的角色（trip/grace）
            dialogue_history: 完整对话历史
            world_state: 世界状态
            banter_round: 当前是第几轮角色间对话（从 1 开始）

        Returns:
            {
                "should": bool,      # 是否需要对方接话
                "responder": str,    # 谁来接话（trip/grace）
                "reason": str,       # 决策理由
            }
        """
        # 对方角色
        other = "grace" if last_character == "trip" else "trip"
        char_display = {"trip": "Trip", "grace": "Grace"}

        # 从 world_state 提取张力
        tension = world_state.get("marriage_tension", 0) if isinstance(world_state, dict) else 0

        # 安全上限：即使 Director 想继续，超过 5 轮也强制停
        hard_limit = 5
        if banter_round >= hard_limit:
            return {"should": False, "responder": other, "reason": f"已达硬性上限({hard_limit}轮)"}

        recent_text = "\n".join(dialogue_history[-8:]) if dialogue_history else "(无)"

        # 当前叙事目标
        goal_desc = ""
        if self.goal_tracker.current_goal:
            goal_desc = self.goal_tracker.current_goal.description

        system_msg = """你是一个戏剧导演，正在监看角色间的对话。

刚刚一个角色说了一句话，你需要判断：**另一个角色是否需要接话？**

判断依据：
1. 台词是否提及、暗示或针对另一个角色？（如"她""你"、提到对方的事）
2. 台词是否带有情绪（讽刺、指责、质疑、示好）可能引发对方反应？
3. 台词是否抛出了问题、邀请或需要对方确认？
4. 如果话题已经自然结束，或者再接话会显得刻意 → 不接

另外，你需要判断"还能再聊几轮"：
- 如果两人正在争吵/对峙、张力很高 → 可以多聊几轮
- 如果只是闲聊补充 → 应该尽快把话头还给玩家
- 已经连续聊了好几轮 → 该停了

输出格式（JSON）：
{"should": true/false, "responder": "角色名", "reason": "一句话理由"}

只输出 JSON，不要有其他内容。"""

        user_msg = f"""【关系张力】{tension}/10
【当前叙事目标】{goal_desc or '无'}
【角色间对话轮次】第 {banter_round} 轮

最近对话：
{recent_text}

{char_display[last_character]} 刚才说："{last_speech}"

{char_display[other]} 是否需要接话？"""

        try:
            messages = [
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ]
            raw = self.llm_client.chat_completion(messages, temperature=0.2, max_tokens=80)
            raw = raw.strip()

            # 提取 JSON
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
                raw = raw.rsplit("```", 1)[0] if "```" in raw else raw

            result = json.loads(raw)
            should = bool(result.get("should", False))
            responder = result.get("responder", other)
            # 校正 responder
            if responder not in ("trip", "grace"):
                responder = other
            reason = result.get("reason", "")

            if self.debug_mode:
                print(f"[Director] 接话判断 round={banter_round}: should={should}, responder={responder}, reason={reason}")

            return {"should": should, "responder": responder, "reason": reason}

        except Exception as e:
            if self.debug_mode:
                print(f"[Director] 接话判断失败（{e}），默认停止")
            return {"should": False, "responder": other, "reason": f"判断失败: {e}"}

    def get_progress_report(self) -> str:
        """获取进度报告"""
        return self.goal_tracker.get_progress_report()

    def reset(self):
        """重置 Director 状态"""
        self.goal_tracker = GoalTracker()
        self.instruction_history = []


# 便捷函数
def create_director(llm_client=None, debug_mode=False) -> DirectorAgent:
    """
    创建 Director Agent 的便捷函数

    Args:
        llm_client: LLM 客户端
        debug_mode: 是否启用调试模式

    Returns:
        配置好的 DirectorAgent 实例
    """
    director = DirectorAgent(llm_client)
    director.set_debug(debug_mode)
    return director
