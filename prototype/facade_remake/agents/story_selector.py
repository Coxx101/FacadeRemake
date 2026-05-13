"""
Story Selector 模块 - v2.0
统一选择入口

变更：
  - select() 与 select_if_better() 合并为统一的 select()
  - 通过 current_storylet_id 参数区分两种调用场景：
      current_storylet_id=None → 新 Landmark，直接选最优
      current_storylet_id 传入   → WorldState 变化后，仅在更优时返回
"""
from typing import List, Optional, Dict, Any
import random

from core.world_state import WorldState
from core.storylet import Storylet, StoryletManager
from core.landmark import LandmarkManager
from config.scenario_schema import ScenarioConfig


class StorySelector:
    """故事选择器 — v2.0 统一入口"""

    def __init__(self, storylet_manager: StoryletManager,
                 landmark_manager: LandmarkManager,
                 llm_client=None,
                 scenario_config: Optional[ScenarioConfig] = None):
        self.storylet_manager = storylet_manager
        self.landmark_manager = landmark_manager
        self.use_llm_evaluator = False
        self.llm_client = llm_client
        self.scenario_config = scenario_config

    def select(self, world_state: WorldState, current_turn: int,
               delta_keys: set = None,
               current_storylet_id: Optional[str] = None) -> Optional[Storylet]:
        """
        统一 Storylet 选择入口。

        两种调用场景：
          - current_storylet_id=None → 新 Landmark 进入，直接选最优
          - current_storylet_id 传入   → WorldState 变化后，仅在更优时返回
        """
        current_landmark = self.landmark_manager.get_current()
        phase_tag = current_landmark.phase_tag if current_landmark else ""

        candidates = self.storylet_manager.get_candidates(
            world_state, current_turn, phase_tag
        )

        if not candidates:
            fallback_id = self.landmark_manager.get_fallback_storylet()
            if fallback_id:
                return self.storylet_manager.get(fallback_id)
            return None

        scored = []
        for s in candidates:
            score = s.calculate_salience(world_state)
            if s.priority_override:
                score += s.priority_override
            # v2.0: delta_keys 命中的标签加分
            if delta_keys and s.tags:
                for tag in s.tags:
                    if tag in delta_keys:
                        score += 5
            scored.append((s, score))

        scored.sort(key=lambda x: x[1], reverse=True)

        # 如果有当前 Storylet，仅当得分严格更高时才切换
        if current_storylet_id:
            current = self.storylet_manager.get(current_storylet_id)
            current_score = current.calculate_salience(world_state) if current else -999
            if scored[0][1] <= current_score:
                return None

        winner = scored[0][0]
        winner.mark_triggered(current_turn)
        return winner

    def select_by_id(self, storylet_id: str, current_turn: int) -> Optional[Storylet]:
        """直接选择指定 Storylet"""
        storylet = self.storylet_manager.get(storylet_id)
        if storylet:
            storylet.mark_triggered(current_turn)
        return storylet

    def _llm_evaluate_candidates(
        self, scored_candidates: List[tuple],
        world_state: WorldState, player_input: str
    ) -> Storylet:
        """LLM 评估候选 Storylet（保留兼容）"""
        if not self.llm_client or len(scored_candidates) == 0:
            return scored_candidates[0][0]

        candidates = [c[0] for c in scored_candidates]
        display_cfg = self.scenario_config.world_state_display if self.scenario_config else None

        status_lines = []
        if display_cfg:
            for q in display_cfg.quality_displays:
                value = world_state.get_quality(q["key"], 0)
                status_lines.append(f"- {q['label']}：{value}")
            for f in display_cfg.flag_displays:
                value = world_state.get_flag(f["key"])
                status_lines.append(f"- {f['label']}：{'是' if value else '否'}")
        else:
            status_lines.append(f"- 婚姻紧张度：{world_state.get_quality('marriage_tension', 0)}")

        status_text = "\n".join(status_lines)

        prompt = f"""你是一个叙事设计师，需要选择最合适的 Storylet。

当前阶段：{self.landmark_manager.current_landmark_id}
玩家输入：{player_input if player_input else '(无)'}
{status_text}

候选：
"""
        for i, storylet in enumerate(candidates, 1):
            prompt += f"\n{i}. {storylet.id} - {storylet.title}\n"
            prompt += f"   叙事目标：{storylet.narrative_goal}\n"
            prompt += f"   Salience：{scored_candidates[i-1][1]}\n"

        prompt += "\n返回选中的 Storylet ID："

        try:
            response = self.llm_client.call_llm(prompt, max_tokens=50)
            for storylet in candidates:
                if storylet.id in response:
                    return storylet
            return candidates[0]
        except Exception:
            return candidates[0]
