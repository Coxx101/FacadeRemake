"""
Landmark 模块
管理主线叙事锚点

设计原则：
  - Landmark 是叙事阶段节点，形成有向无环图（DAG），而不是线性序列。
  - 每个 Landmark 通过 transitions 列表声明向哪些后继节点跳转，以及跳转条件。
  - 结局不再是独立数据结构，而是 is_ending=True 的 Landmark 节点。
  - transitions 中多个分支按声明顺序检查，第一个满足条件的赢。
  - 每个 Landmark 可设置 max_storylets 上限：当前阶段播放了足够多的 Storylet 时，
    自动触发 transitions 检查（即使世界状态条件尚未满足，也可触发兜底分支）。
"""
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field


@dataclass
class LandmarkTransition:
    """
    从当前 Landmark 到另一个 Landmark 的跳转条件。

    字段：
      target_id   : 目标 Landmark 的 id
      conditions  : 世界状态条件列表（AND 关系，全部满足才触发）
                    每条格式：{"type": "flag_check"|"quality_check", "key": ..., "op": ..., "value": ...}
      turn_limit  : 当前 Landmark 内的回合数上限（达到即触发，优先于 storylet_count）
      storylet_count : 当前 Landmark 内已完成的 Storylet 数量上限（达到即触发兜底分支）
      is_fallback : True 时作为兜底分支（conditions 为空时自动匹配），仅在其他分支都不满足时生效
      label       : 可选标签，用于调试/显示（如 "诚实和解"、"沉默收场"）
    """
    target_id: str
    conditions: List[Dict[str, Any]] = field(default_factory=list)
    turn_limit: Optional[int] = None
    storylet_count: Optional[int] = None
    is_fallback: bool = False
    label: str = ""

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "LandmarkTransition":
        return cls(
            target_id=data["target_id"],
            conditions=data.get("conditions", []),
            turn_limit=data.get("turn_limit"),
            storylet_count=data.get("storylet_count"),
            is_fallback=data.get("is_fallback", False),
            label=data.get("label", ""),
        )


@dataclass
class Landmark:
    """
    Landmark 数据结构。

    核心字段：
      id, title, description  : 基本信息
      phase_tag               : 阶段标签，决定本阶段允许哪些 Storylet
      is_ending               : True 表示这是一个结局节点，无后继
      ending_content          : 结局文本（仅 is_ending=True 时有意义）
      transitions             : 跳转列表，替代旧的 next_landmark / DEFAULT_ENDINGS
      max_storylets           : 当前阶段最多运行多少个 Storylet 后强制检查 transitions
      narrative_constraints   : allowed_storylet_tags / forbidden_reveals 等约束
      world_state_effects_on_enter : 进入时自动应用的世界状态效果
      fallback_storylet       : 本阶段无合适 Storylet 时的兜底选项
    """
    id: str
    title: str
    description: str = ""
    phase_tag: str = ""

    # 结局节点标识
    is_ending: bool = False
    ending_content: str = ""

    # 分支跳转列表（有序，优先匹配第一个满足条件的）
    transitions: List[LandmarkTransition] = field(default_factory=list)

    # 本阶段 Storylet 数量上限（到达后触发 transitions 检查）
    max_storylets: Optional[int] = None

    # 叙事约束
    narrative_constraints: Dict[str, Any] = field(default_factory=dict)

    # 进入时的世界状态效果
    world_state_effects_on_enter: List[Dict[str, Any]] = field(default_factory=list)

    # 兜底 Storylet
    fallback_storylet: Optional[str] = None

    # ── 以下字段已废弃，保留仅为向后兼容，不再使用 ──
    order: int = 0
    entry_conditions: Dict[str, Any] = field(default_factory=dict)
    progression_rules: Dict[str, Any] = field(default_factory=dict)

    def get_allowed_tags(self) -> List[str]:
        """获取允许的 Storylet 标签"""
        return self.narrative_constraints.get("allowed_storylet_tags", [])

    def get_forbidden_reveals(self) -> List[str]:
        """获取禁止揭露的信息"""
        return self.narrative_constraints.get("forbidden_reveals", [])

    def on_enter(self, world_state):
        """进入此 Landmark 时应用世界状态效果"""
        for effect in self.world_state_effects_on_enter:
            world_state.apply_effect(effect)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Landmark":
        """从字典创建 Landmark（支持新格式 transitions，也向后兼容旧格式）"""
        # 解析 transitions 列表
        transitions = [
            LandmarkTransition.from_dict(t)
            for t in data.get("transitions", [])
        ]

        # 向后兼容：旧格式用 progression_rules.next_landmark 的单条路径
        if not transitions and data.get("progression_rules"):
            rules = data["progression_rules"]
            next_id = rules.get("next_landmark")
            if next_id:
                advance_when = rules.get("advance_when", {})
                compat_conditions = []
                for key, value in advance_when.get("world_state", {}).items():
                    compat_conditions.append({
                        "type": "flag_check", "key": key, "op": "==", "value": value
                    })
                turn_limit = advance_when.get("or_turn_limit")
                transitions.append(LandmarkTransition(
                    target_id=next_id,
                    conditions=compat_conditions,
                    turn_limit=turn_limit,
                    label="(compat)"
                ))

        return cls(
            id=data["id"],
            title=data.get("title", ""),
            description=data.get("description", ""),
            phase_tag=data.get("phase_tag", ""),
            is_ending=data.get("is_ending", False),
            ending_content=data.get("ending_content", ""),
            transitions=transitions,
            max_storylets=data.get("max_storylets"),
            narrative_constraints=data.get("narrative_constraints", {}),
            world_state_effects_on_enter=data.get("world_state_effects_on_enter", []),
            fallback_storylet=data.get("fallback_storylet"),
            # 保留旧字段供向后兼容读取
            order=data.get("order", 0),
            entry_conditions=data.get("entry_conditions", {}),
            progression_rules=data.get("progression_rules", {}),
        )


class LandmarkManager:
    """
    Landmark 管理器。

    负责：
      - 注册和索引所有 Landmark 节点
      - 追踪当前所在 Landmark 及本阶段已完成的 Storylet 计数
      - 每回合检查当前 Landmark 的 transitions，返回应跳转的目标 id
    """

    def __init__(self, llm_client=None):
        self.landmarks: Dict[str, Landmark] = {}
        self.current_landmark_id: Optional[str] = None
        self.llm_client = llm_client

        # 本阶段已完成的 Storylet 计数（每次切换 Storylet 时由 main 递增）
        self.current_phase_storylet_count: int = 0
        # 本阶段已经历的回合数（每回合由 main 递增）
        self.current_phase_turn_count: int = 0

    # ── 注册与查询 ──────────────────────────────────────────────

    def register(self, landmark: Landmark):
        """注册一个 Landmark"""
        self.landmarks[landmark.id] = landmark

    def get(self, landmark_id: str) -> Optional[Landmark]:
        return self.landmarks.get(landmark_id)

    def get_current(self) -> Optional[Landmark]:
        if self.current_landmark_id:
            return self.landmarks.get(self.current_landmark_id)
        return None

    # ── 切换 Landmark ────────────────────────────────────────────

    def set_current(self, landmark_id: str, world_state):
        """切换到指定 Landmark，重置阶段计数器，执行进入效果"""
        landmark = self.landmarks.get(landmark_id)
        if not landmark:
            return
        self.current_landmark_id = landmark_id
        self.current_phase_storylet_count = 0
        self.current_phase_turn_count = 0
        landmark.on_enter(world_state)

    def increment_storylet_count(self):
        """通知管理器：本阶段又切换了一个新 Storylet"""
        self.current_phase_storylet_count += 1

    def increment_turn_count(self):
        """通知管理器：本阶段又过了一回合"""
        self.current_phase_turn_count += 1

    # ── 核心：检查 transitions ───────────────────────────────────

    def check_progression(self, world_state, player_input: str = "",
                          matched_semantic_ids: List[str] = None) -> Optional[str]:
        """
        检查当前 Landmark 是否应该跳转，返回目标 Landmark id；否则返回 None。

        检查逻辑（按优先级）：
          1. 结局节点没有后继，直接返回 None
          2. 遍历 transitions（按声明顺序）：
             a. 如果 transition 有 turn_limit 且当前阶段回合数已达到 → 触发
             b. 如果 transition 有 storylet_count 且已完成的 Storylet 数已达到 → 触发
             c. 如果 transition 的 conditions 全部满足 → 触发
                - llm_semantic 类型条件：由 matched_semantic_ids 提供匹配结果
             d. 如果 transition 是 is_fallback=True 且前面没有分支触发 → 触发（兜底）
          3. 所有 transitions 都不满足 → 返回 None（继续当前阶段）

        Args:
            world_state: 世界状态
            player_input: 玩家输入（用于 player_input_keyword 类型条件）
            matched_semantic_ids: InputParser.analyze() 返回的命中条件 id 列表，
                用于匹配 llm_semantic 类型的 transition 条件。
        """
        current = self.get_current()
        if not current or current.is_ending:
            return None

        fallback_target: Optional[str] = None

        for transition in current.transitions:
            # 兜底分支：先记录，等其他分支都不满足时再用
            if transition.is_fallback or not transition.conditions:
                if fallback_target is None:
                    fallback_target = transition.target_id
                # 还要继续检查它自己的 turn_limit / storylet_count
                if transition.turn_limit is not None:
                    if self.current_phase_turn_count >= transition.turn_limit:
                        return transition.target_id
                if transition.storylet_count is not None:
                    if self.current_phase_storylet_count >= transition.storylet_count:
                        return transition.target_id
                continue

            # 回合上限触发
            if transition.turn_limit is not None:
                if self.current_phase_turn_count >= transition.turn_limit:
                    return transition.target_id

            # Storylet 数量上限触发
            if transition.storylet_count is not None:
                if self.current_phase_storylet_count >= transition.storylet_count:
                    return transition.target_id

            # 世界状态条件触发
            if transition.conditions and self._check_conditions(transition.conditions, world_state, player_input, matched_semantic_ids):
                return transition.target_id

        # 所有精确分支都不满足，使用兜底
        # （max_storylets 是 Landmark 级别的全局兜底上限）
        if current.max_storylets is not None:
            if self.current_phase_storylet_count >= current.max_storylets:
                return fallback_target  # 可能为 None

        return None

    def _check_conditions(self, conditions: List[Dict], world_state, player_input: str,
                           matched_semantic_ids: List[str] = None) -> bool:
        """检查一组条件（AND 关系），全部满足返回 True

        支持的条件类型：
          - flag_check: 世界状态 flag 检查
          - quality_check: 世界状态 quality 检查
          - player_input_keyword: 简单关键词匹配（轻量级，不需要 LLM）
          - llm_semantic: 语义匹配（由外部 InputParser 提供匹配结果）
        """
        for cond in conditions:
            cond_type = cond.get("type")
            key = cond.get("key")
            op = cond.get("op", "==")
            value = cond.get("value")

            if cond_type == "flag_check":
                current_val = world_state.get_flag(key)
            elif cond_type == "quality_check":
                current_val = world_state.get_quality(key)
            elif cond_type == "player_input_keyword":
                # 简单关键词匹配（轻量级，不需要 LLM）
                keywords = value if isinstance(value, list) else [value]
                if not any(kw in player_input for kw in keywords):
                    return False
                continue
            elif cond_type == "llm_semantic":
                # 语义匹配：由外部 InputParser.analyze() 提供匹配结果
                cond_id = cond.get("id", "")
                if matched_semantic_ids is not None:
                    # 新模式：必须出现在 matched_semantic_ids 中
                    if cond_id and cond_id not in matched_semantic_ids:
                        return False
                # matched_semantic_ids 为 None 时（兼容旧调用），保守放行
                continue
            else:
                continue

            if not self._compare(current_val, op, value):
                return False

        return True

    @staticmethod
    def _compare(actual, op: str, expected) -> bool:
        if op in ("==", "="):
            return actual == expected
        elif op == "!=":
            return actual != expected
        elif op == ">":
            return actual > expected
        elif op == ">=":
            return actual >= expected
        elif op == "<":
            return actual < expected
        elif op == "<=":
            return actual <= expected
        return False

    # ── 辅助方法 ─────────────────────────────────────────────────

    def get_fallback_storylet(self) -> Optional[str]:
        """获取当前 Landmark 的兜底 Storylet"""
        current = self.get_current()
        return current.fallback_storylet if current else None

    def load_from_dicts(self, data_list: List[Dict[str, Any]]):
        """从字典列表批量加载 Landmark"""
        for data in data_list:
            self.register(Landmark.from_dict(data))
