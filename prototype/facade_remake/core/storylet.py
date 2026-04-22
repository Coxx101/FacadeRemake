"""
Storylet 模块 - 基于 Facade 架构
定义和管理叙事单元
"""
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field


@dataclass
class Storylet:
    """Storylet 数据结构"""
    id: str
    title: str
    phase_tags: List[str] = field(default_factory=list)
    narrative_goal: str = ""
    
    # 前置条件
    conditions: List[Dict[str, Any]] = field(default_factory=list)
    llm_trigger: Optional[str] = None
    
    # 内容
    content: Dict[str, Any] = field(default_factory=dict)
    
    # 后置效果
    effects: List[Dict[str, Any]] = field(default_factory=list)
    conditional_effects: List[Dict[str, Any]] = field(default_factory=list)
    
    # 调度
    repeatability: str = "never"  # never, unlimited, cooldown
    cooldown: Optional[int] = None
    sticky: bool = False
    priority_override: Optional[int] = None
    
    # Salience
    salience: Dict[str, Any] = field(default_factory=dict)
    
    # 演出
    choices_hint: List[str] = field(default_factory=list)
    on_interrupt: str = "pause"  # pause, abort, continue
    
    # 结束触发
    completion_trigger: Optional[Dict[str, Any]] = None
    force_wrap_up: Optional[Dict[str, Any]] = None
    
    # 运行时状态
    times_triggered: int = 0
    last_triggered_turn: int = -1
    
    def calculate_salience(self, world_state) -> float:
        """计算 Salience 得分"""
        base = self.salience.get("base", 5)
        score = base
        
        modifiers = self.salience.get("modifiers", [])
        for mod in modifiers:
            key = mod.get("key")
            threshold = mod.get("threshold", 0)
            bonus = mod.get("bonus", 0)
            penalty = mod.get("penalty", 0)
            
            current = world_state.get_quality(key, 0)
            if current >= threshold:
                score += bonus
            else:
                score -= penalty
        
        return score
    
    def can_trigger(self, world_state, current_turn: int, player_input: str = "") -> bool:
        """检查是否可以触发"""
        # 检查重复性
        if self.repeatability == "never" and self.times_triggered > 0:
            return False

        if self.repeatability == "cooldown" and self.cooldown:
            if current_turn - self.last_triggered_turn < self.cooldown:
                return False

        # 检查条件
        for condition in self.conditions:
            if not world_state.check_condition(condition):
                return False

        # llm_trigger 的语义判断由 StoryletManager._check_llm_trigger() 统一处理
        # can_trigger() 只负责结构性条件（flag / quality / cooldown），不在此做 LLM 调用

        return True
    
    def mark_triggered(self, turn: int):
        """标记已触发"""
        self.times_triggered += 1
        self.last_triggered_turn = turn
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Storylet":
        """从字典创建 Storylet"""
        storylet = cls(
            id=data["id"],
            title=data.get("title", ""),
            phase_tags=data.get("phase_tags", []),
            narrative_goal=data.get("narrative_goal", ""),
            conditions=data.get("conditions", []),
            llm_trigger=data.get("llm_trigger"),
            content=data.get("content", {}),
            effects=data.get("effects", []),
            conditional_effects=data.get("conditional_effects", []),
            repeatability=data.get("repeatability", "never"),
            cooldown=data.get("cooldown"),
            sticky=data.get("sticky", False),
            priority_override=data.get("priority_override"),
            salience=data.get("salience", {}),
            choices_hint=data.get("choices_hint", []),
            on_interrupt=data.get("on_interrupt", "pause"),
            completion_trigger=data.get("completion_trigger"),
            force_wrap_up=data.get("force_wrap_up")
        )

        return storylet


class StoryletManager:
    """Storylet 管理器"""
    def __init__(self, llm_client=None):
        self.storylets: Dict[str, Storylet] = {}
        self.llm_client = llm_client  # LLM 客户端（用于语义匹配）
    
    def register(self, storylet: Storylet):
        """注册一个 Storylet"""
        self.storylets[storylet.id] = storylet
    
    def get(self, storylet_id: str) -> Optional[Storylet]:
        """获取指定 Storylet"""
        return self.storylets.get(storylet_id)
    
    def get_candidates(self, world_state, current_turn: int,
                       allowed_tags: List[str] = None, player_input: str = "") -> List[Storylet]:
        """获取候选 Storylets"""
        candidates = []

        for storylet in self.storylets.values():
            # 检查标签约束
            if allowed_tags:
                if not any(tag in storylet.phase_tags for tag in allowed_tags):
                    continue

            # 检查结构性触发条件（flag / quality / cooldown）
            if not storylet.can_trigger(world_state, current_turn, player_input):
                continue

            # 如果有 llm_trigger，进行语义匹配
            if storylet.llm_trigger:
                if player_input:
                    # 有玩家输入时才做语义判断
                    if self._check_llm_trigger(storylet.llm_trigger, player_input, world_state):
                        candidates.append(storylet)
                    # 无玩家输入时跳过（需要玩家说了什么才能匹配）
                else:
                    # 没有玩家输入时跳过 llm_trigger storylet，等待玩家发言
                    pass
            else:
                candidates.append(storylet)

        return candidates

    def _check_llm_trigger(self, trigger_condition: str, player_input: str,
                            world_state=None) -> bool:
        """
        使用 LLM 检查语义触发条件（DRAMA LLAMA 设计）
        返回 True 如果玩家输入满足触发条件

        Args:
            trigger_condition: 自然语言描述的触发条件
            player_input: 玩家的输入文本
            world_state: 当前世界状态（用于提供上下文）
        """
        if not self.llm_client:
            # 没有 LLM 客户端时保守放行（避免 llm_trigger 永远沉默）
            print(f"[llm_trigger] 无 LLM 客户端，保守放行: '{trigger_condition[:30]}...'")
            return True

        # 构建世界状态摘要
        state_summary = ""
        if world_state is not None:
            try:
                tension = world_state.get_quality("marriage_tension", 0)
                secret_exposed = world_state.get_flag("secret_exposed")
                state_summary = (
                    f"当前世界状态：婚姻紧张度={tension}，"
                    f"秘密是否揭露={'是' if secret_exposed else '否'}"
                )
            except Exception:
                state_summary = ""

        prompt = f"""你是一个叙事系统的触发条件判断器。

{f'故事背景：{state_summary}' if state_summary else ''}
触发条件：{trigger_condition}
玩家输入："{player_input}"

请判断：玩家的输入是否符合触发条件？

只回答 YES 或 NO，不要有其他内容。"""

        try:
            response = self.llm_client.call_llm(prompt, max_tokens=5, temperature=0.0)
            result = response.strip().upper()
            matched = "YES" in result
            print(f"[llm_trigger] 条件='{trigger_condition[:40]}' | 输入='{player_input[:30]}' | 结果={result} → {'✓ 匹配' if matched else '✗ 跳过'}")
            return matched
        except Exception as e:
            # LLM 调用失败，保守放行
            print(f"[llm_trigger] 调用失败（{e}），保守放行")
            return True
    
    def load_from_dicts(self, data_list: List[Dict[str, Any]]):
        """从字典列表加载 Storylets"""
        for data in data_list:
            storylet = Storylet.from_dict(data)
            self.register(storylet)
