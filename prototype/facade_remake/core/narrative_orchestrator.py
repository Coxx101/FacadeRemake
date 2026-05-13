"""
NarrativeOrchestrator 模块 - v2.0 核心叙事编排器

职责：
  - 监听 WorldState 变化（通过 StateManager 绑定）
  - 决策叙事流转：Landmark 切换 / Storylet 切换 / 继续当前
  - 协调 StorySelector、LandmarkManager、Director、GameLogWriter

设计原则：
  - 纯 WorldState 驱动，不依赖 player_input 直接判断
  - 仅 Landmark/Storylet 切换时调用 GameLogWriter
  - 通过 StateManager.apply_effects_batch(is_narrative_trigger=True) 解耦触发
"""
from typing import Optional, List
from dataclasses import dataclass
from enum import Enum

from core.world_state import WorldState


class NarrativeEventType(Enum):
    LANDMARK_SWITCH = "landmark_switch"
    STORYLET_SWITCH = "storylet_switch"
    CONTINUE = "continue"


@dataclass
class NarrativeResult:
    """叙事流转结果"""
    type: NarrativeEventType
    new_landmark_id: Optional[str] = None
    new_storylet_id: Optional[str] = None
    is_goal_achieved: bool = False
    goal_assessment: str = ""
    game_log_entry: Optional[object] = None


class NarrativeOrchestrator:
    """叙事编排器。"""

    def __init__(self,
                 landmark_manager,
                 storylet_manager,
                 story_selector,
                 director,
                 state_manager,
                 game_log_writer=None):
        self.landmark_manager = landmark_manager
        self.storylet_manager = storylet_manager
        self.story_selector = story_selector
        self.director = director
        self.state_manager = state_manager
        self.game_log_writer = game_log_writer

        self._current_landmark_id: Optional[str] = None
        self._current_storylet_id: Optional[str] = None

    def bind(self):
        """绑定到 StateManager"""
        self.state_manager.bind_narrative_orchestrator(self)

    def on_world_state_changed(self,
                                delta_keys: set,
                                world_state: WorldState,
                                turn: int) -> NarrativeResult:
        """
        WorldState 变化时的统一回调入口。

        三路决策（按优先级，仅当 WorldState 确实变化时才触发）：
          A. check_progression_by_state() — Landmark 切换 → 首个 Storylet → GameLog
          B. story_selector.select() — 检测是否有更优 Storylet → 切换 → GameLog
          C. 继续当前 Storylet — 不更新 GameLog
        """
        current_landmark = self.landmark_manager.get_current()
        current_storylet = self.storylet_manager.get(self._current_storylet_id)

        # ── 结果A：检查 Landmark 切换 ──
        next_landmark_id = self.landmark_manager.check_progression_by_state(
            world_state, delta_keys
        )
        if next_landmark_id:
            return self._handle_landmark_switch(
                next_landmark_id, current_storylet, turn
            )

        # ── 结果B：检查 Storylet 切换 ──
        if current_landmark:
            new_storylet = self.story_selector.select(
                world_state, turn, delta_keys,
                current_storylet_id=self._current_storylet_id
            )
            if new_storylet and new_storylet.id != self._current_storylet_id:
                return self._handle_storylet_switch(
                    new_storylet, current_storylet, turn
                )

        # ── 结果C：继续当前 ──
        return NarrativeResult(type=NarrativeEventType.CONTINUE)

    def _handle_landmark_switch(self,
                                 new_landmark_id: str,
                                 old_storylet,
                                 turn: int) -> NarrativeResult:
        """处理 Landmark 切换"""
        # 1. 记录旧 Storylet 完成日志（基于历史对话生成）
        if self.game_log_writer and old_storylet:
            self.game_log_writer.generate_on_storylet_switch(
                old_storylet, turn,
                conversation_history=self.state_manager.get_conversation_history(),
                is_landmark_switch=True
            )

        # 2. 切换 Landmark
        old_landmark = self.landmark_manager.get_current()
        self.landmark_manager.set_current(new_landmark_id, self.state_manager.world_state)
        self._current_landmark_id = new_landmark_id

        # 3. 选入首个 Storylet
        new_storylet = self.story_selector.select(
            self.state_manager.world_state, turn
        )
        if new_storylet:
            self._current_storylet_id = new_storylet.id
            self.storylet_manager.mark_triggered(new_storylet.id, turn)
            self.director.set_current_goal(new_storylet.narrative_goal)

        # 4. 生成 Landmark 切换日志
        result = NarrativeResult(
            type=NarrativeEventType.LANDMARK_SWITCH,
            new_landmark_id=new_landmark_id,
            new_storylet_id=new_storylet.id if new_storylet else None,
        )
        if self.game_log_writer:
            result.game_log_entry = self.game_log_writer.generate_on_landmark_switch(
                old_landmark_title=old_landmark.title if old_landmark else "",
                new_landmark_title=new_landmark_id,
                turn=turn
            )
        return result

    def _handle_storylet_switch(self,
                                 new_storylet,
                                 old_storylet,
                                 turn: int) -> NarrativeResult:
        """处理 Storylet 切换"""
        # 1. 强制完成旧 Storylet（应用 effects）
        if old_storylet:
            self.storylet_manager.force_complete(
                old_storylet, self.state_manager, turn=turn
            )
            # 生成旧 Storylet 完成日志（基于历史对话）
            if self.game_log_writer:
                log_entry = self.game_log_writer.generate_on_storylet_switch(
                    old_storylet, turn,
                    conversation_history=self.state_manager.get_conversation_history(),
                    is_landmark_switch=False
                )

        # 2. 切换到新 Storylet
        self._current_storylet_id = new_storylet.id
        self.storylet_manager.mark_triggered(new_storylet.id, turn)
        self.director.set_current_goal(new_storylet.narrative_goal)

        # 3. 返回结果
        result = NarrativeResult(
            type=NarrativeEventType.STORYLET_SWITCH,
            new_storylet_id=new_storylet.id
        )
        if self.game_log_writer and log_entry:
            result.game_log_entry = log_entry
        return result
