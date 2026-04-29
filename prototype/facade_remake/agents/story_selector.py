"""
Story Selector 模块
选择最合适的 Storylet
"""
from typing import List, Optional, Dict, Any
import random

from core.world_state import WorldState
from core.storylet import Storylet, StoryletManager
from core.landmark import LandmarkManager
from config.scenario_schema import ScenarioConfig


class StorySelector:
    """故事选择器"""
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
               player_input: str = "", matched_semantic_ids: List[str] = None) -> Optional[Storylet]:
        """
        三层过滤选择 Storylet：
        1. 条件过滤
        2. Landmark 约束
        3. Salience 评分 (+ 可选 LLM 评估)
        """
        current_landmark = self.landmark_manager.get_current()
        allowed_tags = []
        if current_landmark:
            allowed_tags = current_landmark.get_allowed_tags()
        
        candidates = self.storylet_manager.get_candidates(
            world_state, current_turn, allowed_tags,
            matched_semantic_ids=matched_semantic_ids,
        )
        
        if not candidates:
            fallback_id = self.landmark_manager.get_fallback_storylet()
            if fallback_id:
                return self.storylet_manager.get(fallback_id)
            return None
        
        scored_candidates = []
        for storylet in candidates:
            score = storylet.calculate_salience(world_state)
            
            if storylet.priority_override:
                score += storylet.priority_override
            
            scored_candidates.append((storylet, score))
        
        scored_candidates.sort(key=lambda x: x[1], reverse=True)
        
        if self.use_llm_evaluator and len(scored_candidates) > 1:
            top_candidates = scored_candidates[:3]
            selected = self._llm_evaluate_candidates(
                top_candidates, world_state, player_input
            )
        else:
            selected = scored_candidates[0][0]
        
        selected.mark_triggered(current_turn)
        
        return selected
    
    def select_by_id(self, storylet_id: str, current_turn: int) -> Optional[Storylet]:
        """直接选择指定 Storylet"""
        storylet = self.storylet_manager.get(storylet_id)
        if storylet:
            storylet.mark_triggered(current_turn)
        return storylet

    def _llm_evaluate_candidates(
        self,
        scored_candidates: List[tuple],
        world_state: WorldState,
        player_input: str
    ) -> Storylet:
        """
        使用 LLM 评估 Top-3 候选 Storylet
        返回最合适的 Storylet
        """
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
            status_lines.append(f"- 秘密是否揭露：{'是' if world_state.get_flag('secret_exposed') else '否'}")

        status_text = "\n".join(status_lines)

        prompt = f"""你是一个叙事设计师，需要评估以下 Storylet 候选，选择最合适的一个。

当前情境：
- 玩家输入：{player_input if player_input else "(无输入)"}
- 当前阶段：{self.landmark_manager.current_landmark_id}
{status_text}

候选 Storylet：
"""

        for i, storylet in enumerate(candidates, 1):
            prompt += f"""
{i}. {storylet.id} - {storylet.title}
   叙事目标：{storylet.narrative_goal}
   Salience 分数：{scored_candidates[i-1][1]}
   导演说明：{storylet.content.get('director_note', '无')}
"""

        prompt += """
请根据以下标准选择最合适的 Storylet：
1. 与当前情境和玩家输入的契合度
2. 叙事连贯性和情感推进
3. 角色行为的合理性

只返回选中的 Storylet ID（如 sl_xxx），不要其他解释。
"""

        try:
            response = self.llm_client.call_llm(prompt, max_tokens=50)

            selected_id = self._parse_llm_response(response, candidates)

            for storylet in candidates:
                if storylet.id == selected_id:
                    return storylet

            return candidates[0]

        except Exception as e:
            print(f"[DEBUG] LLM 评估失败: {e}")
            return candidates[0]

    def _parse_llm_response(
        self,
        response: str,
        candidates: List[Storylet]
    ) -> str:
        """解析 LLM 响应，提取 Storylet ID"""
        response = response.strip()

        for storylet in candidates:
            if storylet.id in response:
                return storylet.id

        import re
        match = re.search(r'\d+', response)
        if match:
            index = int(match.group()) - 1
            if 0 <= index < len(candidates):
                return candidates[index].id

        return candidates[0].id