"""输出解析器 v2.0 — 解析 LLM 动作序列 → WorldState effects + AnimationCommand

输入格式: [actor][action_id][param][action_id][...][expression]
示例:     [trip][walk_to][kitchen][say][Hello][happy]

职责:
  1. 从方括号格式提取 actor / actions / expression
  2. 识别位置变化动作（walk_to/pick_up/put_down/give）→ 生成 WorldState effects
  3. 输出保留 AnimationCommand 接口供下游使用
"""
import re
from typing import List, Dict, Any, Optional, Set
from dataclasses import dataclass, field

from config.scenario_schema import ScenarioConfig


# ── 位置变化动作类型（这些会生成 WorldState move effects）──────────────
_POSITION_ACTIONS = {"walk_to", "pick_up", "put_down", "give"}


class InvalidActionError(Exception):
    """无效行为错误"""
    pass


class InvalidExpressionError(Exception):
    """无效表情错误"""
    pass


@dataclass
class ParsedAction:
    """解析后的动作（v2.0 含 WorldState effects）"""
    actor: str
    actions: List[Dict[str, Any]]
    expression: Optional[str] = None
    # v2.0: 位置变化产生的 WorldState effects
    world_state_effects: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class AnimationCommand:
    """动画指令（保留接口，供数字人/渲染系统消费）"""
    type: str  # "dialogue" | "gesture"
    actor: str
    action: Optional[str] = None
    target: Optional[str] = None
    dialogue: Optional[str] = None
    expression: Optional[str] = None


class OutputParser:
    """解析 LLM 输出为结构化数据 + WorldState effects"""

    def __init__(self, scenario_config: ScenarioConfig):
        cfg = scenario_config
        self.valid_actions = {a.id for a in cfg.action_library}
        self.valid_expressions = {e.id for e in cfg.expression_library}
        self.valid_props = {p.id for p in cfg.prop_library}
        self.valid_locations = {l.id for l in cfg.location_library}
        self.valid_characters = {c.id for c in cfg.characters}
        self.scenario_config = cfg

    # ── 解析入口 ─────────────────────────────────────────────────────

    def parse(self, raw_output: str, current_location: str = "") -> ParsedAction:
        """解析并验证 LLM 输出 → ParsedAction + WorldState effects

        Args:
            raw_output: [actor][action][param]... 格式的原始输出
            current_location: actor 当前位置（用于 put_down 推断物品落点）

        Returns:
            ParsedAction（含 actions, expression, world_state_effects）
        """
        parts = self._extract_bracketed(raw_output)
        if not parts:
            raise InvalidActionError("无法解析输出格式")

        actor = parts[0]
        actions: list[dict] = []
        expression: Optional[str] = None
        effects: list[dict] = []

        i = 1
        while i < len(parts):
            token = parts[i]

            if token in self.valid_actions:
                # 收集下一个 token 作为参数（如果存在且不是已知 ID）
                param = parts[i + 1] if i + 1 < len(parts) and not self._is_known_id(parts[i + 1]) else ""
                action_data = {"type": token}

                if token == "say" and param:
                    action_data["dialogue"] = param
                    i += 1
                elif token in ["walk_to", "look_at"] and param:
                    action_data["target"] = param
                    i += 1
                elif token in ["pick_up", "put_down", "give", "pour"] and param:
                    action_data["prop"] = param
                    i += 1

                actions.append(action_data)

                # ── v2.0: 推导 WorldState effects ──
                self._add_position_effects(token, param, actor, current_location, effects)

            elif token in self.valid_expressions:
                expression = token
            # 否则忽略未知 token

            i += 1

        return ParsedAction(
            actor=actor,
            actions=actions,
            expression=expression,
            world_state_effects=self._deduplicate_effects(effects),
        )

    # ── 验证 ─────────────────────────────────────────────────────────

    def validate(self, parsed: ParsedAction):
        """验证解析结果，不合法时抛出异常"""
        for action in parsed.actions:
            action_type = action.get("type", "")
            if action_type not in self.valid_actions:
                raise InvalidActionError(f"'{action_type}' 不在动作库中")

            prop = action.get("prop", "")
            if prop and prop not in self.valid_props and action_type in ("pick_up", "put_down", "give", "pour"):
                raise InvalidActionError(f"'{prop}' 不在物品库中")

            target = action.get("target", "")
            if target and target not in self.valid_locations and target not in self.valid_characters:
                if action_type in ("walk_to", "look_at"):
                    raise InvalidActionError(f"'{target}' 不是有效地点或角色")

        if parsed.expression and parsed.expression not in self.valid_expressions:
            raise InvalidExpressionError(f"'{parsed.expression}' 不在表情库中")

    # ── AnimationCommand 转换（保留接口）────────────────────────────

    def to_animation_commands(self, parsed: ParsedAction) -> List[AnimationCommand]:
        """转换为动画指令"""
        commands: list[AnimationCommand] = []
        for action in parsed.actions:
            if action.get("type") == "say":
                commands.append(AnimationCommand(
                    type="dialogue",
                    actor=parsed.actor,
                    dialogue=action.get("dialogue"),
                    expression=parsed.expression,
                ))
            else:
                commands.append(AnimationCommand(
                    type="gesture",
                    actor=parsed.actor,
                    action=action.get("type"),
                    target=action.get("target") or action.get("prop"),
                ))
        return commands

    # ── 内部工具 ─────────────────────────────────────────────────────

    def _extract_bracketed(self, raw: str) -> List[str]:
        return re.findall(r'\[(.*?)\]', raw)

    def _is_known_id(self, token: str) -> bool:
        return (token in self.valid_actions
                or token in self.valid_expressions
                or token in self.valid_props
                or token in self.valid_locations
                or token in self.valid_characters)

    def _add_position_effects(self, action_type: str, param: str,
                               actor: str, current_location: str,
                               effects: List[Dict]):
        """根据动作类型推导 WorldState 位置变化 effects"""
        if action_type not in _POSITION_ACTIONS or not param:
            return

        if action_type == "walk_to":
            effects.append({"key": actor, "op": "move", "value": param})

        elif action_type == "pick_up":
            effects.append({"key": param, "op": "move", "value": actor})

        elif action_type == "put_down":
            loc = current_location
            if loc:
                effects.append({"key": param, "op": "move", "value": loc})

        elif action_type == "give":
            target = param
            if target in self.valid_characters and target != actor:
                # 物品转移给其他角色
                for a in effects:
                    if a["key"] not in self.valid_characters and a["value"] == actor:
                        a["value"] = target
                        break

    @staticmethod
    def _deduplicate_effects(effects: List[Dict]) -> List[Dict]:
        """去重：同一 key 的 move effect 只保留最后一个"""
        seen: dict[str, int] = {}
        for i, e in enumerate(effects):
            seen[e["key"]] = i
        return [effects[i] for i in sorted(seen.values())]
