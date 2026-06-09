"""
Story Selector 模块 - v2.0
基于 WorldState 的 Salience 计分选择最优 Storylet

逻辑：
  1. 按 phase_tag 和 can_trigger() 筛选候选
  2. calculate_salience() 计分 + priority_override 加分
  3. 返回最高分；无候选时尝试 fallback
"""
from typing import Optional

from core.world_state import WorldState
from core.storylet import Storylet, StoryletManager
from core.landmark import LandmarkManager
from config.scenario_schema import ScenarioConfig


class StorySelector:
    """故事选择器 — v2.0 计分选最优"""

    def __init__(self, storylet_manager: StoryletManager,
                 landmark_manager: LandmarkManager,
                 llm_client=None,
                 scenario_config: Optional[ScenarioConfig] = None):
        self.storylet_manager = storylet_manager
        self.landmark_manager = landmark_manager
        self.llm_client = llm_client
        self.scenario_config = scenario_config

    def select(self, world_state: WorldState, current_turn: int) -> Optional[Storylet]:
        """筛选并返回当前条件下 salience 最高的 Storylet"""
        current_landmark = self.landmark_manager.get_current()
        phase_tag = current_landmark.phase_tag if current_landmark else ""

        candidates = self.storylet_manager.get_candidates(
            world_state, current_turn, phase_tag
        )

        if not candidates:
            fallback_id = self.landmark_manager.get_fallback_storylet()
            print(f"[Selector] 无候选 (phase_tag={phase_tag}, total_storylets={len(self.storylet_manager.storylets)})")

            # 详细诊断：遍历所有 storylets，记录每个被过滤的原因
            all_storylets = list(self.storylet_manager.storylets.values())
            for s in all_storylets:
                reasons = []
                if phase_tag and phase_tag not in s.phase_tags:
                    reasons.append(f"phase_tag 不匹配({s.phase_tags})")
                if not s.can_trigger(world_state, current_turn):
                    if s.repeatability == "never" and s.times_triggered > 0:
                        reasons.append(f"repeatability=never 且已触发 {s.times_triggered} 次")
                    elif s.repeatability == "cooldown" and s.cooldown and current_turn - s.last_triggered_turn < s.cooldown:
                        reasons.append(f"冷却中 (剩余 {s.cooldown - (current_turn - s.last_triggered_turn)} 回合)")
                    else:
                        # 检查具体条件失败
                        for cond in s.conditions:
                            if not world_state.check_condition(cond):
                                reasons.append(f"条件失败: {cond}")
                if not reasons:
                    reasons.append("can_trigger 通过但被 get_candidates 过滤")
                print(f"  [过滤] {s.id}: {'; '.join(reasons)}")

            if fallback_id:
                fb = self.storylet_manager.get(fallback_id)
                print(f"[Selector] fallback={fallback_id} → {'找到' if fb else '未注册!'}")
                if fb:
                    return fb
            return None

        scored = []
        for s in candidates:
            score = s.calculate_salience(world_state)
            if s.priority_override:
                score += s.priority_override
            scored.append((s, score))

        scored.sort(key=lambda x: x[1], reverse=True)
        print(f"[Selector] 候选: {[(s[0].id, s[1]) for s in scored[:3]]}")
        winner = scored[0][0]
        winner.mark_triggered(current_turn)
        return winner
