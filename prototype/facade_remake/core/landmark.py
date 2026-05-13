"""
Landmark 模块 - v2.0
管理主线叙事锚点

设计原则：
  - Landmark 是叙事阶段节点，形成有向无环图（DAG）
  - 结局是 is_ending=True 的 Landmark 节点
  - Landmark 切换仅由 WorldState flag/quality 变化驱动（check_progression_by_state）
"""
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field


@dataclass
class LandmarkTransition:
    """Landmark 跳转条件。conditions 为 flag_check / quality_check 列表（AND 关系）"""
    target_id: str
    conditions: List[Dict[str, Any]] = field(default_factory=list)
    label: str = ""

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "LandmarkTransition":
        return cls(
            target_id=data["target_id"],
            conditions=data.get("conditions", []),
            label=data.get("label", ""),
        )


@dataclass
class Landmark:
    """Landmark 数据结构"""
    id: str
    title: str
    description: str = ""
    phase_tag: str = ""

    is_ending: bool = False
    ending_content: str = ""

    transitions: List[LandmarkTransition] = field(default_factory=list)
    narrative_constraints: Dict[str, Any] = field(default_factory=dict)
    fallback_storylet: Optional[str] = None

    def get_forbidden_reveals(self) -> List[str]:
        return self.narrative_constraints.get("forbidden_reveals", [])

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Landmark":
        transitions = [
            LandmarkTransition.from_dict(t)
            for t in data.get("transitions", [])
        ]
        return cls(
            id=data["id"],
            title=data.get("title", ""),
            description=data.get("description", ""),
            phase_tag=data.get("phase_tag", ""),
            is_ending=data.get("is_ending", False),
            ending_content=data.get("ending_content", ""),
            transitions=transitions,
            narrative_constraints=data.get("narrative_constraints", {}),
            fallback_storylet=data.get("fallback_storylet"),
        )


class LandmarkManager:
    """Landmark 管理器"""

    def __init__(self):
        self.landmarks: Dict[str, Landmark] = {}
        self.current_landmark_id: Optional[str] = None

    # ── 注册与查询 ──────────────────────────────────────────────

    def register(self, landmark: Landmark):
        self.landmarks[landmark.id] = landmark

    def get(self, landmark_id: str) -> Optional[Landmark]:
        return self.landmarks.get(landmark_id)

    def get_current(self) -> Optional[Landmark]:
        if self.current_landmark_id:
            return self.landmarks.get(self.current_landmark_id)
        return None

    # ── 切换 ────────────────────────────────────────────────────

    def set_current(self, landmark_id: str, _world_state=None):
        landmark = self.landmarks.get(landmark_id)
        if not landmark:
            return
        self.current_landmark_id = landmark_id

    # ── v2.0 核心：纯 WorldState 检测 ────────────────────────────

    def check_progression_by_state(self, world_state, delta_keys: set = None) -> Optional[str]:
        """仅基于 WorldState flag/quality 检测 Landmark 切换"""
        current = self.get_current()
        if not current or current.is_ending:
            return None

        for transition in current.transitions:
            if self._check_conditions_by_state(transition.conditions, world_state):
                return transition.target_id

        return None

    def _check_conditions_by_state(self, conditions: List[Dict], world_state) -> bool:
        for cond in conditions:
            cond_type = cond.get("type")
            if cond_type in ("flag_check", "quality_check"):
                if not world_state.check_condition(cond):
                    return False
        return True

    # ── 辅助 ─────────────────────────────────────────────────────

    def get_fallback_storylet(self) -> Optional[str]:
        current = self.get_current()
        return current.fallback_storylet if current else None

    def load_from_dicts(self, data_list: List[Dict[str, Any]]):
        for data in data_list:
            self.register(Landmark.from_dict(data))
