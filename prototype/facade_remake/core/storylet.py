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
    
    def can_trigger(self, world_state, current_turn: int) -> bool:
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
        self.llm_client = llm_client  # 保留引用（兼容），但语义匹配已移至 InputParser
    
    def register(self, storylet: Storylet):
        """注册一个 Storylet"""
        self.storylets[storylet.id] = storylet
    
    def get(self, storylet_id: str) -> Optional[Storylet]:
        """获取指定 Storylet"""
        return self.storylets.get(storylet_id)
    
    def get_candidates(self, world_state, current_turn: int,
                       allowed_tags: List[str] = None,
                       matched_semantic_ids: List[str] = None) -> List[Storylet]:
        """获取候选 Storylets。

        Args:
            world_state: 世界状态
            current_turn: 当前回合
            allowed_tags: Landmark 阶段标签约束
            matched_semantic_ids: InputParser.analyze() 返回的命中条件 id 列表。
                有 llm_trigger 的 Storylet 必须出现在此列表中才算候选。
                如果为 None，则跳过语义检查（兼容旧调用方式）。
        """
        candidates = []

        for storylet in self.storylets.values():
            # 检查标签约束
            if allowed_tags:
                if not any(tag in storylet.phase_tags for tag in allowed_tags):
                    continue

            # 检查结构性触发条件（flag / quality / cooldown）
            if not storylet.can_trigger(world_state, current_turn):
                continue

            # 如果有 llm_trigger，必须由 InputParser 的语义匹配结果确认
            if storylet.llm_trigger:
                if matched_semantic_ids is not None:
                    # 新模式：必须出现在 matched_semantic_ids 中
                    if storylet.id not in matched_semantic_ids:
                        continue
                # matched_semantic_ids 为 None 时（兼容旧调用），保守放行

            candidates.append(storylet)

        return candidates
    
    def load_from_dicts(self, data_list: List[Dict[str, Any]]):
        """从字典列表加载 Storylets"""
        for data in data_list:
            storylet = Storylet.from_dict(data)
            self.register(storylet)
