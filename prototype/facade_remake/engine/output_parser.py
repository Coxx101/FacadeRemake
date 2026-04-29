"""输出解析器 - 解析并验证 Agent 输出，转换为动画指令"""
import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field

from config.scenario_schema import ScenarioConfig


class InvalidActionError(Exception):
    """无效行为错误"""
    pass


class InvalidExpressionError(Exception):
    """无效表情错误"""
    pass


@dataclass
class ParsedAction:
    """解析后的动作"""
    actor: str
    actions: List[Dict[str, Any]]
    expression: Optional[str] = None


@dataclass
class AnimationCommand:
    """动画指令"""
    type: str  # "dialogue" | "gesture"
    actor: str
    action: Optional[str] = None
    target: Optional[str] = None
    dialogue: Optional[str] = None
    expression: Optional[str] = None


class OutputParser:
    """解析并验证 Agent 输出"""
    
    def __init__(self, scenario_config: ScenarioConfig):
        self.valid_actions = {a.id for a in scenario_config.action_library}
        self.valid_expressions = {e.id for e in scenario_config.expression_library}
        self.valid_props = {p.id for p in scenario_config.prop_library}
        self.valid_locations = {l.id for l in scenario_config.location_library}
        self.scenario_config = scenario_config
    
    def _extract_bracketed(self, raw_output: str) -> List[str]:
        """提取方括号中的内容"""
        pattern = r'\[(.*?)\]'
        return re.findall(pattern, raw_output)
    
    def parse(self, raw_output: str) -> ParsedAction:
        """解析并验证输出"""
        parts = self._extract_bracketed(raw_output)
        
        if not parts:
            raise InvalidActionError("无法解析输出格式")
        
        actor = parts[0]
        actions = []
        expression = None
        
        i = 1
        while i < len(parts):
            action_id = parts[i]
            
            if action_id in self.valid_actions:
                action_data = {"type": action_id}
                
                if action_id == "say" and i + 1 < len(parts):
                    action_data["dialogue"] = parts[i + 1]
                    i += 1
                elif action_id in ["walk_to", "look_at"] and i + 1 < len(parts):
                    action_data["target"] = parts[i + 1]
                    i += 1
                elif action_id in ["pick_up", "put_down", "give", "pour"] and i + 1 < len(parts):
                    action_data["prop"] = parts[i + 1]
                    i += 1
                
                actions.append(action_data)
            elif action_id in self.valid_expressions:
                expression = action_id
            else:
                pass
            
            i += 1
        
        return ParsedAction(actor=actor, actions=actions, expression=expression)
    
    def validate(self, parsed: ParsedAction) -> bool:
        """验证解析结果的有效性"""
        for action in parsed.actions:
            action_type = action.get("type")
            if action_type not in self.valid_actions:
                raise InvalidActionError(f"'{action_type}' not in action library")
            
            if action_type in ["pick_up", "put_down", "give", "pour"]:
                prop = action.get("prop")
                if prop and prop not in self.valid_props:
                    raise InvalidActionError(f"'{prop}' not in prop library")
            
            if action_type in ["walk_to", "look_at"]:
                target = action.get("target")
                if target and target not in self.valid_locations:
                    char_ids = {c.id for c in self.scenario_config.characters}
                    if target not in char_ids:
                        raise InvalidActionError(f"'{target}' not in location or character library")
        
        if parsed.expression and parsed.expression not in self.valid_expressions:
            raise InvalidExpressionError(f"'{parsed.expression}' not in expression library")
        
        return True
    
    def to_animation_commands(self, parsed: ParsedAction) -> List[AnimationCommand]:
        """转换为动画指令（供数字人系统使用）"""
        commands = []
        
        for action in parsed.actions:
            if action.get("type") == "say":
                commands.append(AnimationCommand(
                    type="dialogue",
                    actor=parsed.actor,
                    dialogue=action.get("dialogue"),
                    expression=parsed.expression
                ))
            else:
                commands.append(AnimationCommand(
                    type="gesture",
                    actor=parsed.actor,
                    action=action.get("type"),
                    target=action.get("target")
                ))
        
        return commands