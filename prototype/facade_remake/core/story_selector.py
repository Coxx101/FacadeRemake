"""
Story Selector 模块
选择最合适的 Storylet
"""
from typing import List, Optional, Dict, Any
import random

from .world_state import WorldState
from .storylet import Storylet, StoryletManager
from .landmark import LandmarkManager


class StorySelector:
    """故事选择器"""
    def __init__(self, storylet_manager: StoryletManager,
                 landmark_manager: LandmarkManager,
                 llm_client=None):
        self.storylet_manager = storylet_manager
        self.landmark_manager = landmark_manager
        self.use_llm_evaluator = False  # 原型阶段默认关闭
        self.llm_client = llm_client  # LLM 客户端（用于评估器）
    
    def select(self, world_state: WorldState, current_turn: int,
               player_input: str = "") -> Optional[Storylet]:
        """
        三层过滤选择 Storylet：
        1. 条件过滤
        2. Landmark 约束
        3. Salience 评分 (+ 可选 LLM 评估)
        """
        # Step 1: 获取当前 Landmark 的约束
        current_landmark = self.landmark_manager.get_current()
        allowed_tags = []
        if current_landmark:
            allowed_tags = current_landmark.get_allowed_tags()
        
        # Step 2: 条件过滤 + Landmark 约束
        candidates = self.storylet_manager.get_candidates(
            world_state, current_turn, allowed_tags, player_input
        )
        
        if not candidates:
            # 没有候选，尝试兜底 Storylet
            fallback_id = self.landmark_manager.get_fallback_storylet()
            if fallback_id:
                return self.storylet_manager.get(fallback_id)
            return None
        
        # Step 3: Salience 评分
        scored_candidates = []
        for storylet in candidates:
            score = storylet.calculate_salience(world_state)
            
            # Landmark 优先级提升
            if storylet.priority_override:
                score += storylet.priority_override
            
            scored_candidates.append((storylet, score))
        
        # 按分数排序
        scored_candidates.sort(key=lambda x: x[1], reverse=True)
        
        # Step 4: 可选的 LLM 评估器
        if self.use_llm_evaluator and len(scored_candidates) > 1:
            # 取 Top-3 进行 LLM 评估
            top_candidates = scored_candidates[:3]
            selected = self._llm_evaluate_candidates(
                top_candidates, world_state, player_input
            )
        else:
            # 选择最高分
            selected = scored_candidates[0][0]
        
        # 标记已触发
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
            # 如果没有 LLM 客户端，返回第一个
            return scored_candidates[0][0]

        candidates = [c[0] for c in scored_candidates]

        # 构建 LLM 提示词
        prompt = f"""你是一个叙事设计师，需要评估以下 Storylet 候选，选择最合适的一个。

当前情境：
- 玩家输入：{player_input if player_input else "(无输入)"}
- 当前阶段：{self.landmark_manager.current_landmark_id}
- 婚姻紧张度：{world_state.get_quality('marriage_tension')}
- 秘密是否揭露：{'是' if world_state.get_flag('secret_exposed') else '否'}

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
            # 调用 LLM
            response = self.llm_client.call_llm(prompt, max_tokens=50)

            # 解析响应，提取 ID
            selected_id = self._parse_llm_response(response, candidates)

            # 返回选中的 Storylet
            for storylet in candidates:
                if storylet.id == selected_id:
                    return storylet

            # 如果解析失败，返回第一个
            return candidates[0]

        except Exception as e:
            # LLM 调用失败，回退到普通选择
            print(f"[DEBUG] LLM 评估失败: {e}")
            return candidates[0]

    def _parse_llm_response(
        self,
        response: str,
        candidates: List[Storylet]
    ) -> str:
        """解析 LLM 响应，提取 Storylet ID"""
        response = response.strip()

        # 尝试直接匹配
        for storylet in candidates:
            if storylet.id in response:
                return storylet.id

        # 尝试匹配序号（如 "1", "2", "3"）
        import re
        match = re.search(r'\d+', response)
        if match:
            index = int(match.group()) - 1
            if 0 <= index < len(candidates):
                return candidates[index].id

        # 默认返回第一个
        return candidates[0].id
