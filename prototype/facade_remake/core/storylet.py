"""
Storylet 模块 - v2.0
定义和管理叙事单元

变更：
  - 新增 max_turns：最大交互回合数，闲聊兜底用
  - 新增 tags：语义标签列表，供 InputParser Gate2 条件收集用
  - 废弃 conditional_effects：条件效果已由 Gate2 + WorldState 驱动层统一处理
  - 废弃 completion_trigger / force_wrap_up：职责合并到 max_turns
  - 新增 StoryletManager.check_timeout() / force_complete()
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

    # 内容
    content: Dict[str, Any] = field(default_factory=dict)

    # 后置效果（Storylet 完成时应用）
    effects: List[Dict[str, Any]] = field(default_factory=list)

    # ── v2.0 新增 ──
    max_turns: int = 8
    tags: List[str] = field(default_factory=list)

    # ── v2.0 废弃（保留字段只为数据兼容，运行时不再使用）──
    conditional_effects: List[Dict[str, Any]] = field(default_factory=list)
    completion_trigger: Optional[Dict[str, Any]] = None
    force_wrap_up: Optional[Dict[str, Any]] = None

    # 调度
    repeatability: str = "never"
    cooldown: Optional[int] = None
    sticky: bool = False
    priority_override: Optional[int] = None

    # Salience
    salience: Dict[str, Any] = field(default_factory=dict)

    # 演出
    on_interrupt: str = "pause"

    # 运行时状态
    times_triggered: int = 0
    last_triggered_turn: int = -1

    # 位置配置
    initial_locations: Dict[str, str] = field(default_factory=dict)
    location_requirements: Optional[Dict[str, Any]] = None

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
        if self.repeatability == "never" and self.times_triggered > 0:
            return False

        if self.repeatability == "cooldown" and self.cooldown:
            if current_turn - self.last_triggered_turn < self.cooldown:
                return False

        for condition in self.conditions:
            if not world_state.check_condition(condition):
                return False

        return True

    def mark_triggered(self, turn: int):
        """标记已触发"""
        self.times_triggered += 1
        self.last_triggered_turn = turn

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Storylet":
        """从字典创建 Storylet"""
        return cls(
            id=data["id"],
            title=data.get("title", ""),
            phase_tags=data.get("phase_tags", []),
            narrative_goal=data.get("narrative_goal", ""),
            conditions=data.get("conditions", []),
            content=data.get("content", {}),
            effects=data.get("effects", []),
            # v2.0
            max_turns=data.get("max_turns", 8),
            tags=data.get("tags", []),
            # v2.0 废弃但保留兼容
            conditional_effects=data.get("conditional_effects", []),
            completion_trigger=data.get("completion_trigger"),
            force_wrap_up=data.get("force_wrap_up"),
            # 调度
            repeatability=data.get("repeatability", "never"),
            cooldown=data.get("cooldown"),
            sticky=data.get("sticky", False),
            priority_override=data.get("priority_override"),
            salience=data.get("salience", {}),
            on_interrupt=data.get("on_interrupt", "pause"),
            # 位置
            initial_locations=data.get("initial_locations", {}),
            location_requirements=data.get("location_requirements"),
        )

    def get_effect_trends(self) -> Dict[str, Dict[str, Any]]:
        """获取 effects 的趋势信息"""
        trends = {}
        for effect in self.effects:
            key = effect.get("key")
            if not key:
                continue
            if "trend" in effect:
                trends[key] = {
                    "trend": effect.get("trend", "rising"),
                    "range": effect.get("range", [0, 1]),
                }
                continue
            op = effect.get("op")
            value = effect.get("value", 0)
            if isinstance(value, (int, float)):
                abs_val = abs(value)
                if op in ("+", "max"):
                    trends[key] = {"trend": "rising", "range": [abs_val, abs_val]}
                elif op == "-":
                    trends[key] = {"trend": "falling", "range": [abs_val, abs_val]}
                elif op == "=":
                    trends[key] = {"trend": "set", "range": [0, 0]}
                elif op == "min":
                    trends[key] = {"trend": "falling", "range": [abs_val, abs_val]}
        return trends


class StoryletManager:
    """Storylet 管理器"""

    def __init__(self, llm_client=None):
        self.storylets: Dict[str, Storylet] = {}
        self.llm_client = llm_client
        self._completed_storylets: List[str] = []

    # ── 注册与查询 ──────────────────────────────────────────────

    def register(self, storylet: Storylet):
        self.storylets[storylet.id] = storylet

    def get(self, storylet_id: str) -> Optional[Storylet]:
        return self.storylets.get(storylet_id)

    def get_storylets_by_landmark(self, landmark_id: str) -> List[Storylet]:
        """获取属于指定 Landmark 的所有 Storylet"""
        return [
            s for s in self.storylets.values()
            if landmark_id in s.phase_tags
        ]

    def get_candidates(self, world_state, current_turn: int,
                       phase_tag: str = "") -> List[Storylet]:
        """获取候选 Storylets，按 phase_tag 过滤"""
        candidates = []
        for storylet in self.storylets.values():
            if phase_tag and phase_tag not in storylet.phase_tags:
                continue
            if not storylet.can_trigger(world_state, current_turn):
                continue
            candidates.append(storylet)
        return candidates

    # ── v2.0 超时与强制完成 ─────────────────────────────────────

    def check_timeout(self, storylet: Storylet, turn_count: int) -> bool:
        """检查 Storylet 是否达到最大交互回合数"""
        return turn_count >= storylet.max_turns

    def force_complete(self,
                        storylet: Storylet,
                        state_manager,
                        turn: int = 0):
        """
        强制完成 Storylet：应用 effects，触发叙事流转。

        Returns:
            NarrativeResult 或 None
        """
        result = None
        if storylet.effects:
            result = state_manager.apply_effects_batch(
                storylet.effects,
                is_narrative_trigger=True,
                hint=f"Storylet[{storylet.id}] 强制完成",
                turn=turn
            )
        self._completed_storylets.append(storylet.id)
        return result

    def mark_triggered(self, storylet_id: str, turn: int):
        """标记 Storylet 已触发（更新运行时状态）"""
        storylet = self.storylets.get(storylet_id)
        if storylet:
            storylet.mark_triggered(turn)

    def load_from_dicts(self, data_list: List[Dict[str, Any]]):
        """从字典列表加载 Storylets"""
        for data in data_list:
            storylet = Storylet.from_dict(data)
            self.register(storylet)
