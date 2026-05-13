"""
GameEngine - v2.0 核心游戏逻辑
叙事流转委托给 NarrativeOrchestrator，main loop 简化为协调调度

变更：
  - 新增 NarrativeOrchestrator + GameLogWriter
  - 重构 handle_player_input(): 三层门控 + 按需 BeatPlan 刷新
  - 废弃 _check_and_handle_transitions / _should_switch_storylet / _switch_to_storylet
  - 对话历史迁移到 StateManager
  - conversation_history → state_manager.get_conversation_history()
"""
import asyncio
from typing import List, Dict, Any, Optional

from facade_remake.core.di_container import DIContainer
from facade_remake.core.narrative_orchestrator import NarrativeOrchestrator, NarrativeEventType
from facade_remake.core.game_log_writer import GameLogWriter
from facade_remake.engine.output import (
    game_banner, character_speaking_hint, character_line, waiting_for_player,
    narrator_text, state_change, system_message, debug_message, reading_delay_info,
    nudge_message, storylet_entered, storylet_ended, landmark_entered, ending,
    show_status, player_silence, input_rejected
)

URGENCY_DELAY = {"high": 1.0, "medium": 2.0, "low": 3.0}
_READING_CHARS_PER_SEC = 6.0
_READING_BASE_SEC = 1.0
_URGENCY_LIMITS = {"high": (1.0, 4.0), "medium": (1.5, 7.0), "low": (2.0, 10.0)}
PLAYER_TURN_TIMEOUT = 45.0


def calc_reading_delay(char_count: int, urgency: str = "medium") -> float:
    raw = _READING_BASE_SEC + char_count / _READING_CHARS_PER_SEC
    lo, hi = _URGENCY_LIMITS.get(urgency, (1.5, 7.0))
    return max(lo, min(hi, raw))


class GameEngine:
    def __init__(self, debug_mode: bool = True, provider: Optional[str] = None, scenario_config=None):
        self.debug_mode = debug_mode
        self._has_scenario_config = scenario_config is not None

        self.container = DIContainer(debug_mode=debug_mode, provider=provider, scenario_config=scenario_config)
        self.container.init_world_state()
        self.container.load_data()

        self.world_state = self.container.world_state
        self.state_manager = self.container.state_manager
        self.logger = self.container.logger
        self.llm_client = self.container.llm_client
        self.storylet_manager = self.container.storylet_manager
        self.landmark_manager = self.container.landmark_manager
        self.location_manager = self.container.location_manager

        self._character_agents: Dict[str, Any] = {}
        self._input_parser = None
        self._story_selector = None
        self._director = None

        # ── v2.0 新增 ──
        self.game_log_writer = GameLogWriter(llm_client=self.llm_client)
        self.narrative_orchestrator = NarrativeOrchestrator(
            landmark_manager=self.landmark_manager,
            storylet_manager=self.storylet_manager,
            story_selector=None,  # 延迟绑定
            director=None,        # 延迟绑定
            state_manager=self.state_manager,
            game_log_writer=self.game_log_writer
        )

        if self._has_scenario_config:
            self.input_parser = self.container.input_parser
            self.story_selector = self.container.story_selector
            self.director = self.container.director
            for char_id in self.container.list_characters():
                self._character_agents[char_id] = self.container.get_character_agent(char_id)
            self._bind_v2_components()

        self.state_manager.add_change_listener(self._on_state_change)

        self.current_turn = 0
        self.conversation_history: List[str] = []  # 保留兼容，新代码走 state_manager
        self.current_storylet = None
        self.storylet_turn_count = 0
        self.storylet_start_turn = 0
        self.landmark_start_turn = 0
        self.game_ended = False

        self.current_beat_plan: List[Dict[str, Any]] = []
        self.beat_index: int = 0
        self.effect_trends: Dict[str, Dict[str, Any]] = {}
        self.accumulated_delta: Dict[str, float] = {}

        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self.event_loop = None
        self.last_beat_char_count = 0
        self._player_turn_active = False

        if self._has_scenario_config:
            self.landmark_manager.set_current("lm_1_arrive", self.world_state)
            self.narrative_orchestrator.bind()

    def _bind_v2_components(self):
        """绑定 v2.0 组件之间的引用"""
        self.narrative_orchestrator.story_selector = self.story_selector
        self.narrative_orchestrator.director = self.director
        self.narrative_orchestrator.bind()
        # 注入依赖到 InputParser
        if self._input_parser:
            self._input_parser.inject_dependencies(
                storylet_manager=self.storylet_manager,
                goal_tracker=self.director.goal_tracker if self.director else None
            )

    # ── 属性 ─────────────────────────────────────────────────────────

    @property
    def input_parser(self):
        if self._input_parser is None:
            self._input_parser = self.container.input_parser
            self._bind_v2_components()
        return self._input_parser

    @input_parser.setter
    def input_parser(self, value):
        self._input_parser = value

    @property
    def story_selector(self):
        if self._story_selector is None:
            self._story_selector = self.container.story_selector
        return self._story_selector

    @story_selector.setter
    def story_selector(self, value):
        self._story_selector = value

    @property
    def director(self):
        if self._director is None:
            self._director = self.container.director
        return self._director

    @director.setter
    def director(self, value):
        self._director = value

    # ── 角色管理 ─────────────────────────────────────────────────────

    def get_character_agent(self, character_id: str):
        if character_id not in self._character_agents:
            if self.container.has_character(character_id):
                agent = self.container.get_character_agent(character_id)
                self._character_agents[character_id] = agent
                return agent
            raise ValueError(f"角色 '{character_id}' 未注册")
        return self._character_agents[character_id]

    def register_character_agent(self, character_id: str, agent):
        self._character_agents[character_id] = agent

    def list_characters(self) -> List[str]:
        return list(self._character_agents.keys())

    def has_character(self, character_id: str) -> bool:
        return character_id in self._character_agents

    def clear_characters(self):
        self._character_agents.clear()

    def update_characters_from_container(self):
        self._character_agents.clear()
        for char_id in self.container.list_characters():
            self._character_agents[char_id] = self.container.get_character_agent(char_id)
        self._bind_v2_components()

    def _on_state_change(self, delta: Dict[str, Any], hint: str):
        self.logger.record_state_change(delta)

    def schedule_async(self, coro):
        if self._loop is None or self._loop.is_closed():
            return
        try:
            if self._loop.is_running():
                asyncio.run_coroutine_threadsafe(coro, self._loop)
            else:
                self._loop.create_task(coro)
        except RuntimeError:
            pass

    # ── BeatPlan 管理 ────────────────────────────────────────────────

    async def _refresh_beat_plan(self):
        if not self.current_storylet:
            return
        self.current_beat_plan = []
        self.beat_index = 0

        entity_locations = {}
        all_locations = []
        if self.location_manager:
            entity_locations = self.location_manager.get_all_entity_locations()
            player_loc = self.location_manager.get_player_location()
            ws_dict = self.world_state.to_dict()
            ws_dict["player_location"] = player_loc
            all_locations = self.location_manager.get_all_locations()
        else:
            ws_dict = self.world_state.to_dict()

        try:
            beats = await self._loop.run_in_executor(
                None,
                lambda: self.director.generate_beat_plan(
                    self.current_storylet.content,
                    ws_dict,
                    self.state_manager.get_conversation_history(),
                    entity_locations,
                    all_locations,
                )
            )
            self.current_beat_plan = beats
            self.logger.record_beat_plan_generation(len(beats))
        except Exception as e:
            self.logger.error(f"BeatPlan 刷新失败: {e}", module="beatplan", exception=e)

    async def _generate_transition_beats(self, old_storylet, new_storylet, is_landmark_switch: bool):
        try:
            beats = await self._loop.run_in_executor(
                None,
                lambda: self.director.generate_transition_beat_plan(
                    old_storylet_title=old_storylet.title if old_storylet else "未知",
                    new_storylet_title=new_storylet.title if new_storylet else "未知",
                    old_narrative_goal=old_storylet.narrative_goal if old_storylet else "",
                    new_narrative_goal=new_storylet.narrative_goal if new_storylet else "",
                    world_state=self.world_state.to_dict(),
                    dialogue_history=self.state_manager.get_conversation_history(),
                    is_landmark_switch=is_landmark_switch,
                )
            )
            for beat in beats:
                if beat.get("speaker") == "narrator":
                    narrator_text(beat.get("content", ""))
                elif beat.get("speaker") == "player_turn":
                    waiting_for_player()
                    break
                else:
                    speaker = beat.get("speaker", "trip")
                    self._execute_storylet(
                        beat_intent=beat.get("intent", ""),
                        speaker=speaker,
                        addressee=beat.get("addressee", ""),
                    )
                delta = beat.get("world_state_delta", {})
                if delta:
                    self._apply_raw_delta(delta, beat.get("state_change_hint", ""))
        except Exception as e:
            self.logger.error(f"衔接 BeatPlan 执行失败: {e}", module="transition", exception=e)

    # ── v2.0 核心：玩家输入处理 ──────────────────────────────────────

    def _emit_pipeline(self, step: str, result: str, detail: str = ""):
        """发送流水线调试事件到前端"""
        if self.event_loop:
            self.event_loop.emit("pipeline_event", {
                "turn": self.current_turn,
                "step": step,
                "result": result,
                "detail": detail,
            })

    def handle_player_input(self, player_input: str):
        if self.event_loop and self.event_loop.pending_beat_task and not self.event_loop.pending_beat_task.done():
            self.event_loop.pending_beat_task.cancel()

        self._player_turn_active = False

        # ── 第一步：三层门控分析 ──
        analysis = self.input_parser.analyze_full(
            player_input,
            current_landmark=self.landmark_manager.get_current(),
            current_storylet=self.current_storylet,
            conversation_history=self.state_manager.get_conversation_history()
        )

        # Gate1 阻断：非法输入
        if not analysis.valid and analysis.severity == "hard":
            self._emit_pipeline("gate1", "block", analysis.reason or "输入不可接受")
            input_rejected(analysis.reason or "输入不可接受")
            self._player_turn_active = True
            return
        self._emit_pipeline("gate1", "pass", "输入合法")

        # ── 第二步：更新回合计数 ──
        self.current_turn += 1
        self.storylet_turn_count += 1
        self.director.advance_turn()

        # ── 第三步：追加对话历史（不触发叙事）──
        if player_input and player_input.strip():
            self.state_manager.append_conversation_history(f"玩家: {player_input}")
            self.conversation_history.append(f"玩家: {player_input}")

        # 跟踪本轮是否触发了叙事切换
        narrative_result = None

        # ── 第四步：Gate2 处理 ──
        if analysis.gate2_opened and not analysis.is_in_narrative_goal:
            self._emit_pipeline("gate2", "off_goal",
                f"输入偏离叙事目标 | 命中条件: {analysis.matched_ids} | effects: {len(analysis.world_state_effects)}个")
            if analysis.world_state_effects:
                narrative_result = self.state_manager.apply_effects_batch(
                    effects=analysis.world_state_effects,
                    is_narrative_trigger=True,
                    hint="玩家偏离目标输入触发的状态变化",
                    turn=self.current_turn
                )
                self._emit_pipeline("worldstate", "changed",
                    f"应用 {len(analysis.world_state_effects)} 个 effects → 叙事流转")
        elif analysis.gate2_opened:
            self._emit_pipeline("gate2", "on_goal", "输入在叙事目标内")

        # ── 第五步：Gate3 处理 ──
        if analysis.gate3_opened:
            self._emit_pipeline("gate3", analysis.goal_assessment,
                f"GoalTracker: {analysis.goal_assessment} | apply_effects={analysis.should_apply_goal_effects}")
            if analysis.should_apply_goal_effects:
                if self.current_storylet:
                    result = self.storylet_manager.force_complete(
                        self.current_storylet, self.state_manager,
                        turn=self.current_turn
                    )
                    if result and not narrative_result:
                        narrative_result = result
                        self._emit_pipeline("narration", "storylet_switch" if result.type == NarrativeEventType.STORYLET_SWITCH else "landmark_switch",
                            f"叙事切换: {result.type.value}")

        # ── 第六步：闲聊兜底 → 检查超时 ──
        if self.current_storylet:
            if self.storylet_manager.check_timeout(
                self.current_storylet, self.storylet_turn_count
            ):
                self._emit_pipeline("timeout", "triggered",
                    f"max_turns={self.current_storylet.max_turns} 已到，强制完成")
                result = self.storylet_manager.force_complete(
                    self.current_storylet, self.state_manager,
                    turn=self.current_turn
                )
                if result and not narrative_result:
                    narrative_result = result
                    self._emit_pipeline("narration", "storylet_switch" if result.type == NarrativeEventType.STORYLET_SWITCH else "landmark_switch",
                        f"叙事切换: {result.type.value}")

        # ── 第七步：推送 GameLog ──
        self._emit_game_log()

        # ── 第八步：按需刷新 BeatPlan ──
        narrative_switched = (
            narrative_result is not None
            and narrative_result.type in (NarrativeEventType.LANDMARK_SWITCH, NarrativeEventType.STORYLET_SWITCH)
        )
        if narrative_switched:
            self._emit_pipeline("beatplan", "refresh",
                f"叙事切换，重新生成 BeatPlan | type={narrative_result.type.value}")
        elif self.beat_index >= len(self.current_beat_plan):
            self._emit_pipeline("beatplan", "refresh", "BeatPlan 耗尽，重新生成")
        else:
            self._emit_pipeline("beatplan", "continue", f"继续当前 BeatPlan [{self.beat_index}/{len(self.current_beat_plan)}]")

        if narrative_switched or self.beat_index >= len(self.current_beat_plan):
            self.current_beat_plan = []
            self.beat_index = 0
            self.schedule_async(self._refresh_beat_plan())

        self._player_turn_active = True

    def handle_player_silence(self):
        """处理玩家沉默（v2.0 简化版）"""
        if self.event_loop and self.event_loop.pending_beat_task and not self.event_loop.pending_beat_task.done():
            self.event_loop.pending_beat_task.cancel()

        self._player_turn_active = False

        self.current_turn += 1
        self.storylet_turn_count += 1
        self.director.advance_turn()
        
        silence_line = "玩家: 保持沉默"
        self.state_manager.append_conversation_history(silence_line)
        self.conversation_history.append(silence_line)
        player_silence()

        # 检查超时兜底
        if self.current_storylet:
            if self.storylet_manager.check_timeout(
                self.current_storylet, self.storylet_turn_count
            ):
                self.storylet_manager.force_complete(
                    self.current_storylet, self.state_manager,
                    turn=self.current_turn
                )

        self._emit_game_log()

        if self.beat_index >= len(self.current_beat_plan):
            self.current_beat_plan = []
            self.beat_index = 0
            self.schedule_async(self._refresh_beat_plan())

        self._player_turn_active = True

    def _emit_game_log(self):
        """推送 GameLog 到前端右栏"""
        if self.event_loop:
            self.event_loop.emit("game_log", self.game_log_writer.to_dict_list())

    # ── Beat 自动化 ──────────────────────────────────────────────────

    def handle_auto_beat(self):
        if not self.current_beat_plan or self.beat_index >= len(self.current_beat_plan):
            if self.event_loop:
                self.event_loop.notify_beat_done()
            return

        beat = self.current_beat_plan[self.beat_index]

        try:
            if beat.get("speaker") == "narrator":
                narrator_text(beat.get("content", ""))
                self.beat_index += 1
                return

            if beat.get("speaker") == "player_turn":
                return

            speaker = beat.get("speaker", "trip")
            beat_intent = beat.get("intent", "")
            addressee = beat.get("addressee", "")

            char_count = self._execute_storylet(
                beat_intent=beat_intent, speaker=speaker, addressee=addressee
            )
            self.last_beat_char_count = char_count or 0
            self.beat_index += 1

            if self.beat_index >= len(self.current_beat_plan):
                self.schedule_async(self._refresh_beat_plan())

        finally:
            if self.event_loop:
                self.event_loop.notify_beat_done()

    def _execute_storylet(self, player_input: str = "", beat_intent: str = "",
                          speaker: str = "", addressee: str = ""):
        if not self.current_storylet:
            return
        if not speaker or speaker not in ("trip", "grace"):
            return

        return self._generate_character_response(
            speaker, player_input, self.current_storylet.content,
            beat_intent=beat_intent, addressee=addressee,
        )

    def _generate_character_response(self, character: str, player_input: str,
                                      content: Dict, beat_intent: str = "",
                                      addressee: str = ""):
        effective_content = dict(content)
        if self.current_storylet and "narrative_goal" not in effective_content:
            effective_content["narrative_goal"] = getattr(self.current_storylet, "narrative_goal", "")

        narrative_goal = effective_content.get("narrative_goal", "")
        tone = effective_content.get("tone", "neutral")
        director_instruction = f"叙事目标：{narrative_goal}\n情绪基调：{tone}"

        if beat_intent:
            director_instruction += f"\n[Beat 意图] {beat_intent}"
            if not player_input:
                addr_map = {
                    "grace": "Grace（你的配偶）", "trip": "Trip（你的配偶）",
                    "player": "玩家（你们的老友）", "all": "在场的所有人"
                }
                addr_hint = addr_map.get(addressee, addressee)
                if addr_hint:
                    director_instruction += f"\n（你在跟{addr_hint}说话。根据意图自然开口，不要等别人说话。）"
                else:
                    director_instruction += "\n（这是角色主动推进叙事，根据意图自然开口，不要等别人说话。）"

        current_landmark = self.landmark_manager.get_current()
        forbidden_topics = current_landmark.get_forbidden_reveals() if current_landmark else []

        agent = self.get_character_agent(character)

        result = agent.generate_response(
            player_input, effective_content, self.world_state.to_dict(),
            self.state_manager.get_conversation_history(),
            director_instruction=director_instruction,
            forbidden_topics=forbidden_topics,
            beat_intent=beat_intent, addressee=addressee,
        )

        thought = result.get("thought", "")
        dialogue = result.get("dialogue", "")
        actions = result.get("actions", "")
        dialogue = self._clean_response_prefix(dialogue, character)

        character_line(character, dialogue, actions, thought, self.debug_mode)

        if self.event_loop:
            self.event_loop.emit("character_speaking", character, dialogue, actions, thought)

        history_line = self._format_history_line(character, dialogue, actions)
        if history_line:
            self.state_manager.append_conversation_history(history_line)
            self.conversation_history.append(history_line)

        return len(dialogue) + len(actions)

    def _format_history_line(self, character: str, dialogue: str, actions: str) -> str:
        parts = []
        if dialogue:
            parts.append(dialogue)
        if actions:
            action_text = self._parse_actions_to_text(actions)
            if action_text:
                parts.append(action_text)
        return f"{character}: {' | '.join(parts)}" if parts else ""

    def _parse_actions_to_text(self, actions: str) -> str:
        import re
        pattern = r'\[([^\]]+)\]'
        parts = re.findall(pattern, actions)
        readable = [p.replace("_", " ") for p in parts if p and p.strip()]
        return f"*动作: {' → '.join(readable)}*" if readable else ""

    def _clean_response_prefix(self, response: str, character: str) -> str:
        all_prefixes = [
            "trip:", "trip：", "grace:", "grace：",
            "Trip:", "Trip：", "Grace:", "Grace：",
            "特拉维斯:", "特拉维斯：", "格蕾丝:", "格蕾丝：",
        ]
        cleaned = response.strip()
        while True:
            found = False
            for prefix in all_prefixes:
                if cleaned.lower().startswith(prefix.lower()):
                    cleaned = cleaned[len(prefix):].strip()
                    found = True
                    break
            if not found:
                break
        return cleaned

    # ── 工具方法 ──────────────────────────────────────────────────────

    def _apply_beat_delta(self, player_input: str, beat: Dict = None):
        if not self.effect_trends:
            return
        predicted_delta = beat.get("world_state_delta", {}) if beat else {}
        hint = beat.get("state_change_hint", "") if beat else ""
        actual_delta = self.world_state.compute_beat_delta(
            effect_trends=self.effect_trends,
            accumulated_delta=self.accumulated_delta,
            player_input=player_input,
        )
        if not actual_delta:
            return
        for key, val in actual_delta.items():
            current = self.world_state.get_quality(key, 0)
            self.state_manager.set_quality(key, current + val)
            self.accumulated_delta[key] = self.accumulated_delta.get(key, 0) + val
        self._display_state_change(actual_delta, hint)

    def _apply_raw_delta(self, delta: Dict[str, Any], hint: str = ""):
        if not delta:
            return
        for key, val in delta.items():
            if isinstance(val, (int, float)):
                current = self.world_state.get_quality(key, 0)
                self.state_manager.set_quality(key, current + val)
                self.accumulated_delta[key] = self.accumulated_delta.get(key, 0) + val

    def _display_state_change(self, delta: Dict[str, int], hint: str = ""):
        current_values = {k: self.world_state.get_quality(k, 0) for k in delta}
        state_change(delta, current_values, hint)

    # ── 初始化 Storylet ──────────────────────────────────────────────

    def _trigger_initial_storylet(self):
        storylet = self.story_selector.select(self.world_state, self.current_turn)
        if storylet:
            self.current_storylet = storylet
            self.storylet_turn_count = 0
            self.storylet_start_turn = self.current_turn
            if storylet.narrative_goal:
                self.director.set_current_goal(storylet.narrative_goal)
            self.effect_trends = storylet.get_effect_trends()
            self.accumulated_delta = {}
            storylet_entered(storylet.title, storylet.narrative_goal)
            if self.event_loop:
                self.event_loop.emit("storylet_entered", storylet.title, storylet.narrative_goal)
            self.schedule_async(self._refresh_beat_plan())

    # ── 位置管理 ──────────────────────────────────────────────────────

    def handle_move_location(self, location_id: str):
        if not self.location_manager:
            return False, "位置管理器未初始化", {}

        old_loc = self.location_manager.get_player_location()
        old_loc_obj = self.location_manager.get_location(old_loc) if old_loc else None
        new_loc_obj = self.location_manager.get_location(location_id)

        success, message = self.location_manager.move_player(location_id)

        if success and old_loc_obj and new_loc_obj:
            move_record = f"玩家: （移动）从 {old_loc_obj.label} 移动到了 {new_loc_obj.label}"
            self.state_manager.append_conversation_history(move_record)
            self.conversation_history.append(move_record)
            self.current_turn += 1
            self.storylet_turn_count += 1
            self.director.advance_turn()
            
            if self.current_storylet:
                if self.storylet_manager.check_timeout(
                    self.current_storylet, self.storylet_turn_count
                ):
                    self.storylet_manager.force_complete(
                        self.current_storylet, self.state_manager,
                        turn=self.current_turn
                    )

            self._emit_game_log()

        location_summary = self.location_manager.get_location_summary()
        return success, message, location_summary

    def get_location_info(self) -> Dict[str, Any]:
        if not self.location_manager:
            return {"locations": [], "player_location": "", "entity_locations": {}}
        return self.location_manager.get_location_summary()

    # ── 废弃方法（v1.0 兼容存根）─────────────────────────────────────

    def _check_and_handle_transitions(self, player_input: str) -> bool:
        """已废弃，v2.0 由 NarrativeOrchestrator 接管"""
        return False

    def _should_switch_storylet(self, player_input: str) -> bool:
        """已废弃，v2.0 由 StoryletManager.check_timeout 接管"""
        return False

    def _switch_to_storylet(self, new_storylet, is_landmark_switch=False, old_storylet=None):
        """已废弃，v2.0 由 NarrativeOrchestrator._handle_storylet_switch 接管"""
        pass

    def _apply_storylet_effects(self):
        """已废弃，v2.0 由 StoryletManager.force_complete 接管"""
        pass

    def _check_player_mediation(self, player_input: str):
        """保留兼容"""
        pass

    def _show_status(self):
        pass

    def _show_storylet_start(self, storylet):
        pass

    def _trigger_ending_landmark(self, landmark):
        pass

    def _compare_values(self, actual, op: str, expected) -> bool:
        if op == "==": return actual == expected
        if op == "!=": return actual != expected
        if op == ">": return actual > expected
        if op == ">=": return actual >= expected
        if op == "<": return actual < expected
        if op == "<=": return actual <= expected
        return False

    def _pick_nudge_speaker(self) -> str:
        return "trip"
