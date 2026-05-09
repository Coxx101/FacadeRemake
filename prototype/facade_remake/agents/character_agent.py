"""
角色 Agent 模块
基于 IBSEN 论文的演员系统：生成角色内心独白、台词、动作

核心架构：
- Beat 数据类：导演指令的结构化表示
- BeatContext：Beat 执行上下文
- generate_response：基于 Beat 指令生成角色响应
"""
import json
import re
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional

from config.scenario_schema import ScenarioConfig


@dataclass
class Beat:
    """导演 Beat 指令"""
    speaker: str                    # trip/grace/player_turn
    addressee: str                  # player/grace/trip/all
    intent: str                     # 叙事目的（第三人称描述）
    urgency: str = "medium"         # low/medium/high
    world_state_delta: Dict = field(default_factory=dict)  # tension 等变化
    state_change_hint: str = ""     # 气氛描述


@dataclass
class BeatContext:
    """Beat 执行上下文"""
    beat: Beat
    character: str                  # 当前角色名
    player_input: str = ""          # 玩家输入
    dialogue_history: List[str] = field(default_factory=list)
    world_state: Dict = field(default_factory=dict)
    character_profile: Dict = field(default_factory=dict)
    scenario_config: Optional[ScenarioConfig] = None


class CharacterAgent:
    """角色 Agent

    核心方法：
    - generate_response() - 一次 LLM 调用生成 thought/speech/action
    """

    def __init__(self, llm_client, character: str, character_profile: Dict = None,
                 scenario_config: Optional[ScenarioConfig] = None):
        self.llm_client = llm_client
        self.character = character
        self.debug_mode = False

        if character_profile:
            self.profile = character_profile
        else:
            self.profile = {}

        self._scenario_config = scenario_config

    def set_debug(self, enabled: bool):
        self.debug_mode = enabled

    def set_scenario_config(self, config: ScenarioConfig):
        """设置场景配置（包含元素库）"""
        self._scenario_config = config

    # ─────────────────────────────────────────────────────
    # 核心方法：生成角色回应（向后兼容版本）
    # ─────────────────────────────────────────────────────
    def generate_response(self, player_input: str, storylet_content: Dict[str, Any],
                         world_state: Dict[str, Any], conversation_history: List[str] = None,
                         director_instruction: str = "",
                         forbidden_topics: List[str] = None,
                         allowed_behaviors: List[str] = None,
                         banter_context: Dict[str, Any] = None,
                         beat_intent: str = "", addressee: str = "") -> Dict[str, str]:
        """生成角色回应 - 向后兼容版本

        Args:
            player_input: 玩家输入文本（角色自主推进时为空字符串）
            beat_intent: 当前 Beat 的叙事意图

        Returns:
            Dict with keys: "thought", "speech", "action"
        """
        beat = Beat(
            speaker=self.character,
            addressee=addressee or "player",
            intent=beat_intent or "根据上下文自然回应",
            urgency="medium",
            world_state_delta={},
            state_change_hint=""
        )

        context = BeatContext(
            beat=beat,
            character=self.character,
            player_input=player_input,
            dialogue_history=conversation_history or [],
            world_state=world_state,
            character_profile=self.profile,
            scenario_config=self._scenario_config
        )

        result = self._generate_beat_response(beat, context)

        result["speech"] = self._strip_name_prefix(result.get("dialogue", ""))

        if self.debug_mode:
            print(f"[Character] {self.character} 原始响应: {result.get('raw', '')[:200]}...")
            print(f"[Character] {self.character} 解析结果: thought='{result['thought'][:50]}...' speech='{result['speech'][:50]}...' action='{result['action']}'")

        return {
            "thought": result["thought"],
            "dialogue": result["dialogue"],
            "actions": result["action"],
        }

    # ─────────────────────────────────────────────────────
    # 新核心方法：基于 Beat 指令生成角色回应
    # ─────────────────────────────────────────────────────
    def _generate_beat_response(self, beat: Beat, context: BeatContext) -> Dict[str, Any]:
        """基于 Beat 指令生成角色响应

        Args:
            beat: 导演 Beat 指令
            context: Beat 执行上下文

        Returns:
            Dict with keys: "thought", "dialogue", "action", "raw"
        """
        prompt = self._build_beat_prompt(beat, context)

        raw = self._generate_with_retry(prompt, context.character_profile.get("ng_words", []))

        result = self._parse_beat_response(raw)

        result["action"] = self._validate_actions(result.get("action", ""))

        result["raw"] = raw

        return result

    def _build_beat_prompt(self, beat: Beat, context: BeatContext) -> str:
        """构建 Beat 驱动的 Prompt"""
        parts = []
        profile = context.character_profile

        parts.append(f"你是一场戏剧中的数字人角色：{context.character}。")

        identity = profile.get("identity", "")
        if identity:
            parts.append(f"\n【身份】{identity}")

        relationships = profile.get("relationships", [])
        if relationships:
            parts.append("\n【与其他角色的关系】")
            for rel in relationships:
                target = rel.get("target", "")
                desc = rel.get("description", "")
                parts.append(f"- {target}：{desc}")

        personality = profile.get("personality", "")
        if personality:
            parts.append(f"\n【性格】{personality}")

        background = profile.get("background", [])
        if background:
            parts.append("\n【背景】")
            for item in background:
                parts.append(f"- {item}")

        secret_knowledge = profile.get("secret_knowledge", [])
        if secret_knowledge:
            parts.append("\n【你内心的秘密】")
            for item in secret_knowledge:
                parts.append(f"- {item}")

        parts.append(f"\n【本拍意图】{beat.intent}")
        parts.append(f"\n【当前说话对象】{beat.addressee}")
        if beat.state_change_hint:
            parts.append(f"【气氛】{beat.state_change_hint}")

        parts.append("\n" + self._build_action_library_text())
        parts.append("\n" + self._build_expression_library_text())
        parts.append("\n" + self._build_location_library_text())
        parts.append("\n" + self._build_prop_library_text())

        # 完整对话历史上下文（保留最近15条）
        if context.dialogue_history:
            parts.append(f"\n【对话历史】(共 {len(context.dialogue_history)} 条)")
            for line in context.dialogue_history[-15:]:
                parts.append(f"- {line}")

        if context.player_input:
            parts.append(f"\n【玩家输入】{context.player_input}")

        forbidden_topics = profile.get("ng_words", [])
        if forbidden_topics:
            parts.append(f"\n【禁止话题】{'、'.join(forbidden_topics)}")

        parts.append("""
【输出格式 - 必须严格遵循】
只输出 JSON，不要有任何其他文字：
{
  "thought": "你此刻内心真实的想法（1-2句话）",
  "dialogue": "你说出的台词（如果没有台词则为空字符串）",
  "action": "动作序列，如 walk_to[living_room]look_at[player]say[]happy"
}

【动作序列规则】
- 动作格式：[动作ID][参数（可选）]
- 示例：walk_to[living_room]look_at[player]say[]happy
- say[] 表示说话，台词在 dialogue 字段
- 表情放在动作序列最后作为独立元素
- 表情不能紧跟在 say[] 后面，必须分开写
- 可用动作：见【可用动作】列表
- 可用表情：见【可用表情】列表
- 可用地点：见【可用地点】列表
- 可用物品：见【可用物品】列表""")

        return "\n".join(parts)

    def _build_action_library_text(self) -> str:
        """构建动作库文本"""
        if self._scenario_config and self._scenario_config.action_library:
            actions = [f"- {a.id}: {a.label}（{a.description}）" for a in self._scenario_config.action_library]
            return "【可用动作】\n" + "\n".join(actions)
        else:
            default_actions = [
                "walk_to[地点] - 走到某地",
                "pick_up[物品] - 拿起物品",
                "put_down[物品] - 放下物品",
                "give[物品][目标] - 递给某人",
                "gesture[] - 手势动作",
                "look_at[目标] - 看向某人/某物",
                "sit_down[] - 坐下",
                "stand_up[] - 站起来",
                "pour[物品] - 倒（饮料）",
                "sigh[] - 叹气",
                "laugh[] - 笑",
                "say[] - 说话（台词在 dialogue 字段）",
                "pause[] - 停顿",
            ]
            return "【可用动作】\n" + "\n".join(default_actions)

    def _build_expression_library_text(self) -> str:
        """构建表情库文本"""
        if self._scenario_config and self._scenario_config.expression_library:
            expressions = [f"- {e.id}: {e.label}" for e in self._scenario_config.expression_library]
            return "【可用表情】\n" + "\n".join(expressions)
        else:
            default_expressions = [
                "neutral - 中性",
                "happy - 开心",
                "sad - 难过",
                "angry - 生气",
                "thinking - 思考",
                "embarrassed - 尴尬",
                "smirk - 得意",
                "confused - 困惑",
            ]
            return "【可用表情】\n" + "\n".join(default_expressions)

    def _build_location_library_text(self) -> str:
        """构建地点库文本"""
        if self._scenario_config and self._scenario_config.location_library:
            locations = [f"- {l.id}: {l.label}" for l in self._scenario_config.location_library]
            return "【可用地点】\n" + "\n".join(locations)
        else:
            default_locations = [
                "living_room - 客厅",
                "kitchen - 厨房",
                "dining_room - 餐厅",
                "bedroom - 卧室",
                "balcony - 阳台",
            ]
            return "【可用地点】\n" + "\n".join(default_locations)

    def _build_prop_library_text(self) -> str:
        """构建物品库文本"""
        if self._scenario_config and self._scenario_config.prop_library:
            props = [f"- {p.id}: {p.label}" for p in self._scenario_config.prop_library]
            return "【可用物品】\n" + "\n".join(props)
        else:
            default_props = [
                "wine_glass - 酒杯",
                "bottle - 酒瓶",
                "plate - 盘子",
                "napkin - 餐巾",
            ]
            return "【可用物品】\n" + "\n".join(default_props)

    def _validate_actions(self, actions: str) -> str:
        """验证并修正动作序列"""
        if not actions:
            return ""

        valid_action_ids = set()
        valid_expr_ids = set()

        if self._scenario_config:
            if self._scenario_config.action_library:
                valid_action_ids = {a.id for a in self._scenario_config.action_library}
            if self._scenario_config.expression_library:
                valid_expr_ids = {e.id for e in self._scenario_config.expression_library}
        else:
            valid_action_ids = {"walk_to", "pick_up", "put_down", "give", "gesture",
                               "look_at", "sit_down", "stand_up", "pour", "sigh",
                               "laugh", "say", "pause"}
            valid_expr_ids = {"neutral", "happy", "sad", "angry", "thinking",
                             "embarrassed", "smirk", "confused"}

        pattern = r'([a-z_]+)\[([^\]]*)\]'
        matches = re.findall(pattern, actions)

        validated_parts = []
        for action_id, param in matches:
            if action_id in valid_action_ids or action_id in valid_expr_ids:
                validated_parts.append(f"{action_id}[{param}]")

        # 保留结尾的表情（不在方括号内的内容，如 say[]happy 中的 happy）
        last_bracket_pos = actions.rfind(']')
        if last_bracket_pos >= 0 and last_bracket_pos < len(actions) - 1:
            suffix = actions[last_bracket_pos + 1:].strip().lower()
            if suffix and suffix in valid_expr_ids:
                validated_parts.append(suffix)

        return "".join(validated_parts)

    def _generate_with_retry(self, prompt: str, ng_words: List[str],
                            max_retry: int = 3) -> str:
        """生成并处理 NG words"""
        temperature = 0.75

        messages = [{"role": "system", "content": prompt}]
        result = self.llm_client.chat_completion(messages, temperature=temperature)

        retry = 0
        while self._contains_ng_words(result, ng_words) and retry < max_retry:
            retry += 1
            if self.debug_mode:
                print(f"[Character] {self.character} 检测到 NG words，重试 {retry}/{max_retry}...")
            result = self.llm_client.chat_completion(messages, temperature=temperature)

        return result.strip()

    def _parse_beat_response(self, raw: str) -> Dict[str, str]:
        """解析 Beat 响应"""
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            cleaned = "\n".join(lines[1:-1]) if len(lines) > 2 else cleaned

        try:
            data = json.loads(cleaned)
            thought = str(data.get("thought", "")).strip()
            dialogue = str(data.get("dialogue", "")).strip()
            action = str(data.get("action", "")).strip()
            return {"thought": thought, "dialogue": dialogue, "action": action}
        except json.JSONDecodeError:
            json_match = re.search(r'\{.*\}', cleaned, re.DOTALL)
            if json_match:
                try:
                    data = json.loads(json_match.group(0))
                    thought = str(data.get("thought", "")).strip()
                    dialogue = str(data.get("dialogue", "")).strip()
                    action = str(data.get("action", "")).strip()
                    return {"thought": thought, "dialogue": dialogue, "action": action}
                except:
                    pass
            return {"thought": "", "dialogue": self._strip_name_prefix(cleaned), "action": ""}

    def _contains_ng_words(self, text: str, ng_words: List[str]) -> bool:
        """检查 NG words"""
        for ng in ng_words:
            if re.search(ng, text):
                return True
        return False

    def _strip_name_prefix(self, text: str) -> str:
        """清理角色名前缀"""
        prefixes = [
            "trip:", "trip：", "grace:", "grace：",
            "Trip:", "Trip：", "Grace:", "Grace：",
            "特拉维斯:", "特拉维斯：", "格蕾丝:", "格蕾丝：",
        ]
        cleaned = text.strip()
        for prefix in prefixes:
            if cleaned.lower().startswith(prefix.lower()):
                cleaned = cleaned[len(prefix):].strip()
                break
        return cleaned


def create_character(llm_client=None, character: str = "trip",
                    character_profile: Dict = None, debug_mode: bool = False,
                    scenario_config: Optional[ScenarioConfig] = None) -> CharacterAgent:
    """创建 Character Agent 的便捷函数"""
    agent = CharacterAgent(llm_client, character, character_profile, scenario_config)
    agent.set_debug(debug_mode)
    return agent