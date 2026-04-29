"""
GameEngine - 核心游戏逻辑
包含游戏状态管理、Storylet 切换、Beat 调度等核心业务逻辑
"""
import asyncio
from typing import List, Dict, Any, Optional

from core.di_container import DIContainer
from engine.output import (
    game_banner, character_speaking_hint, character_line, waiting_for_player,
    narrator_text, state_change, system_message, debug_message, reading_delay_info,
    nudge_message, storylet_entered, storylet_ended, landmark_entered, ending,
    show_status, player_silence, input_rejected
)


URGENCY_DELAY = {
    "high":   1.0,
    "medium": 2.0,
    "low":    3.0,
}

_READING_CHARS_PER_SEC = 6.0
_READING_BASE_SEC = 1.0
_URGENCY_LIMITS = {
    "high":   (1.0, 4.0),
    "medium": (1.5, 7.0),
    "low":    (2.0, 10.0),
}

PLAYER_TURN_TIMEOUT = 45.0


def calc_reading_delay(char_count: int, urgency: str = "medium") -> float:
    raw = _READING_BASE_SEC + char_count / _READING_CHARS_PER_SEC
    lo, hi = _URGENCY_LIMITS.get(urgency, (1.5, 7.0))
    return max(lo, min(hi, raw))


class GameEngine:
    def __init__(self, debug_mode: bool = True, provider: Optional[str] = None, scenario_config=None):
        self.debug_mode = debug_mode

        self.container = DIContainer(debug_mode=debug_mode, provider=provider, scenario_config=scenario_config)
        self.container.init_world_state()
        self.container.load_data()

        self.world_state = self.container.world_state
        self.state_manager = self.container.state_manager
        self.logger = self.container.logger
        self.llm_client = self.container.llm_client
        self.input_parser = self.container.input_parser
        self.condition_store = self.container.condition_store
        self.trip_agent = self.container.trip_agent
        self.grace_agent = self.container.grace_agent
        self.storylet_manager = self.container.storylet_manager
        self.landmark_manager = self.container.landmark_manager
        self.story_selector = self.container.story_selector
        self.director = self.container.director

        self.state_manager.add_change_listener(self._on_state_change)

        self.current_turn = 0
        self.conversation_history: List[str] = []
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

        self.landmark_manager.set_current("lm_1_arrive", self.world_state)

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

    async def _refresh_beat_plan(self):
        if not self.current_storylet:
            return

        self.current_beat_plan = []
        self.beat_index = 0

        try:
            beats = await self._loop.run_in_executor(
                None,
                lambda: self.director.generate_beat_plan(
                    self.current_storylet.content,
                    self.world_state.to_dict(),
                    self.conversation_history,
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
                    dialogue_history=self.conversation_history,
                    is_landmark_switch=is_landmark_switch,
                )
            )

            for beat in beats:
                if beat.get("speaker") == "narrator":
                    content = beat.get("content", "")
                    narrator_text(content)
                elif beat.get("speaker") == "player_turn":
                    waiting_for_player()
                    break
                else:
                    speaker = beat.get("speaker", "trip")
                    self._generate_character_response(
                        speaker, "",
                        new_storylet.content if new_storylet else {},
                        beat_intent=beat.get("intent", ""),
                        addressee=beat.get("addressee", ""),
                    )

                delta = beat.get("world_state_delta", {})
                hint = beat.get("state_change_hint", "")
                if delta:
                    self._apply_raw_delta(delta, hint)

        except Exception as e:
            self.logger.error(f"衔接 BeatPlan 执行失败: {e}", module="transition", exception=e)

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
            new_val = current + val
            self.state_manager.set_quality(key, new_val)
            self.accumulated_delta[key] = self.accumulated_delta.get(key, 0) + val

        self._display_state_change(actual_delta, hint)

    def _apply_raw_delta(self, delta: Dict[str, Any], hint: str = ""):
        if not delta:
            return
        actual = {}
        for key, val in delta.items():
            if isinstance(val, (int, float)):
                current = self.world_state.get_quality(key, 0)
                self.state_manager.set_quality(key, current + val)
                self.accumulated_delta[key] = self.accumulated_delta.get(key, 0) + val
                actual[key] = val
        if actual:
            self._display_state_change(actual, hint)

    def _display_state_change(self, delta: Dict[str, int], hint: str = ""):
        current_values = {k: self.world_state.get_quality(k, 0) for k in delta.keys()}
        state_change(delta, current_values, hint)

    def _check_and_handle_transitions(self, player_input: str) -> bool:
        next_landmark_id = self.landmark_manager.check_progression(
            self.world_state, player_input
        )

        if next_landmark_id:
            old_landmark = self.landmark_manager.get_current()
            self.landmark_manager.set_current(next_landmark_id, self.world_state)
            new_landmark = self.landmark_manager.get_current()

            if new_landmark and new_landmark.is_ending:
                self._trigger_ending_landmark(new_landmark)
                self.game_ended = True
                return True

            landmark_entered(new_landmark.title if new_landmark else next_landmark_id)
            self.landmark_start_turn = self.current_turn
            self.current_storylet = None
            self.storylet_turn_count = 0

            new_storylet = self.story_selector.select(self.world_state, self.current_turn, player_input)
            if new_storylet:
                self._switch_to_storylet(new_storylet, is_landmark_switch=True, old_storylet=None)

            return True

        if self._should_switch_storylet(player_input):
            old_storylet = self.current_storylet
            new_storylet = self.story_selector.select(self.world_state, self.current_turn, player_input)

            if new_storylet and (not old_storylet or new_storylet.id != old_storylet.id):
                self._switch_to_storylet(new_storylet, is_landmark_switch=False, old_storylet=old_storylet)
                return True

        return False

    def _switch_to_storylet(self, new_storylet, is_landmark_switch: bool = False, old_storylet=None):
        if old_storylet:
            storylet_ended(old_storylet.title)
            self.logger.record_storylet_switch(old_storylet.title, new_storylet.title)

        self.current_storylet = new_storylet
        self.storylet_turn_count = 0
        self.storylet_start_turn = self.current_turn

        if new_storylet.narrative_goal:
            self.director.set_current_goal(new_storylet.narrative_goal)

        self.landmark_manager.increment_storylet_count()

        self.current_beat_plan = []
        self.beat_index = 0

        self.effect_trends = new_storylet.get_effect_trends()
        self.accumulated_delta = {}

        self._apply_storylet_effects()

        storylet_entered(new_storylet.title, new_storylet.narrative_goal)

        if self.debug_mode:
            self._show_storylet_start(new_storylet)

        self.schedule_async(self._refresh_beat_plan())

        if old_storylet:
            self.schedule_async(self._generate_transition_beats(old_storylet, new_storylet, is_landmark_switch))

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

            if self.debug_mode:
                self._show_storylet_start(storylet)

            self.schedule_async(self._refresh_beat_plan())

    def _check_player_mediation(self, player_input: str):
        if not self.world_state.get_flag("secrets_revealed"):
            return
        if self.world_state.get_flag("player_mediated"):
            return
        mediation_keywords = [
            "劝", "调解", "别吵", "好好说", "冷静", "和好", "谅解", "原谅",
            "理解", "沟通", "一起", "家人", "没事的", "没关系", "说开", "你们俩",
            "爸妈", "帮你们", "出面", "再给他一次机会", "说清楚", "好好谈",
        ]
        if any(kw in player_input for kw in mediation_keywords):
            self.state_manager.set_flag("player_mediated", True)
            self.logger.debug("player_mediated → True", module="mediation")

    def _execute_storylet(self, player_input: str = "", beat_intent: str = "", speaker: str = "",
                          addressee: str = ""):
        if not self.current_storylet:
            return

        if not speaker or speaker not in ("trip", "grace"):
            if self.debug_mode:
                self.logger.warning(f"speaker='{speaker}' 不合法，跳过此 beat", module="storylet")
            return

        content = self.current_storylet.content

        return self._generate_character_response(
            speaker, player_input, content,
            beat_intent=beat_intent,
            addressee=addressee,
        )

    def _generate_character_response(self, character: str, player_input: str, content: Dict,
                                      beat_intent: str = "", addressee: str = ""):
        effective_content = dict(content)
        if self.current_storylet and "narrative_goal" not in effective_content:
            effective_content["narrative_goal"] = getattr(self.current_storylet, "narrative_goal", "")

        narrative_goal = effective_content.get('narrative_goal', '')
        tone = effective_content.get('tone', 'neutral')
        director_instruction = f"叙事目标：{narrative_goal}\n情绪基调：{tone}"

        if beat_intent:
            director_instruction += f"\n[Beat 意图] {beat_intent}"
            if not player_input:
                addr_hint = ""
                if addressee:
                    addr_map = {"grace": "Grace（你的配偶）", "trip": "Trip（你的配偶）", "player": "玩家（你们的老友）", "all": "在场的所有人"}
                    addr_hint = addr_map.get(addressee, addressee)
                if addr_hint:
                    director_instruction += f"\n（你在跟{addr_hint}说话。根据意图自然开口，不要等别人说话。）"
                else:
                    director_instruction += "\n（这是角色主动推进叙事，根据意图自然开口，不要等别人说话。）"

        current_landmark = self.landmark_manager.get_current()
        forbidden_topics = current_landmark.get_forbidden_reveals() if current_landmark else []

        agent = self.trip_agent if character == "trip" else self.grace_agent
        result = agent.generate_response(
            player_input,
            effective_content,
            self.world_state.to_dict(),
            self.conversation_history,
            director_instruction=director_instruction,
            forbidden_topics=forbidden_topics,
            beat_intent=beat_intent,
            addressee=addressee,
        )

        thought = result.get("thought", "")
        dialogue = result.get("dialogue", "")
        actions = result.get("actions", "")

        dialogue = self._clean_response_prefix(dialogue, character)

        character_line(character, dialogue, actions, thought, self.debug_mode)

        history_line = self._format_history_line(character, dialogue, actions)
        if history_line:
            self.conversation_history.append(history_line)

        return len(dialogue) + len(actions)

    def _format_history_line(self, character: str, dialogue: str, actions: str) -> str:
        parts = []
        if dialogue:
            parts.append(dialogue)
        if actions:
            # 结构化 actions 转为可读格式
            action_text = self._parse_actions_to_text(actions)
            if action_text:
                parts.append(action_text)
        if parts:
            return f"{character}: {' | '.join(parts)}"
        return ""

    def _parse_actions_to_text(self, actions: str) -> str:
        """将结构化动作序列转为可读文本"""
        import re
        # 解析 [action_id][param] 格式
        pattern = r'\[([^\]]+)\]'
        parts = re.findall(pattern, actions)
        
        readable = []
        for i, part in enumerate(parts):
            if part and part.strip():
                # 简单转换：将下划线替换为空格
                readable.append(part.replace('_', ' '))
        
        if readable:
            return f"*动作: {' → '.join(readable)}*"
        return ""

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

    def _apply_storylet_effects(self):
        if not self.current_storylet:
            return
        for effect in self.current_storylet.effects:
            op = effect.get("op")
            if op == "=":
                self.state_manager.apply_effect(effect)

        for conditional_effect in self.current_storylet.conditional_effects:
            if self._check_conditional_effect(conditional_effect):
                for effect in conditional_effect.get("effects", []):
                    if effect.get("op") == "=":
                        self.state_manager.apply_effect(effect)

    def _check_conditional_effect(self, conditional_effect: Dict) -> bool:
        conditions = conditional_effect.get("conditions", [])
        if not conditions:
            return True
        for condition in conditions:
            cond_type = condition.get("type")
            if cond_type == "flag_check":
                key = condition.get("key")
                op = condition.get("op")
                value = condition.get("value")
                current = self.world_state.get_flag(key)
                if not self._compare_values(current, op, value):
                    return False
            elif cond_type == "quality_check":
                key = condition.get("key")
                op = condition.get("op")
                value = condition.get("value")
                current = self.world_state.get_quality(key)
                if not self._compare_values(current, op, value):
                    return False
        return True

    def _should_switch_storylet(self, player_input: str) -> bool:
        if not self.current_storylet:
            return True
        storylet = self.current_storylet
        if storylet.sticky:
            return self._check_force_wrap_up()
        completion = storylet.completion_trigger
        if completion:
            max_turns = completion.get("max_turns", 10)
            if self.storylet_turn_count >= max_turns:
                return True
        if self.storylet_turn_count >= 5:
            return True
        return False

    def _check_force_wrap_up(self) -> bool:
        if not self.current_storylet:
            return False
        force_wrap = self.current_storylet.force_wrap_up
        if not force_wrap:
            return False
        max_turns = force_wrap.get("max_turns", 15)
        if self.storylet_turn_count >= max_turns:
            return True
        return False

    def _show_status(self):
        landmark = self.landmark_manager.get_current()
        flags_to_show = [
            'arrived', 'drinks_started', 'renovation_fight',
            'trip_confessed', 'grace_exposed', 'secrets_revealed',
            'trip_detail_revealed', 'grace_detail_revealed',
            'honest_conversation', 'final_decision_made', 'player_mediated'
        ]
        flags = {flag: self.world_state.get_flag(flag) for flag in flags_to_show}
        show_status(
            current_turn=self.current_turn,
            landmark_id=self.landmark_manager.current_landmark_id,
            landmark_title=landmark.title if landmark else None,
            landmark_desc=landmark.description if landmark else None,
            storylet_title=self.current_storylet.title if self.current_storylet else None,
            narrative_goal=self.current_storylet.narrative_goal if self.current_storylet else None,
            beat_index=self.beat_index,
            beat_plan_len=len(self.current_beat_plan),
            storylet_turn_count=self.storylet_turn_count,
            qualities=dict(self.world_state.qualities),
            flags=flags
        )

    def _show_storylet_start(self, storylet):
        if not self.debug_mode:
            return
        self.logger.debug(f"Storylet 开始: {storylet.id}", module="storylet")
        self.logger.debug(f"阶段标签: {storylet.phase_tags}", module="storylet")
        self.logger.debug(f"Salience 基础分: {storylet.salience.get('base', 5)}", module="storylet")

    def _trigger_ending_landmark(self, landmark):
        ending(
            landmark_title=landmark.title,
            description=landmark.description,
            ending_content=landmark.ending_content,
            total_turns=self.current_turn,
            tension=self.world_state.get_quality('tension'),
            trip_confessed=self.world_state.get_flag('trip_confessed'),
            grace_exposed=self.world_state.get_flag('grace_exposed'),
            player_mediated=self.world_state.get_flag('player_mediated')
        )
        self.logger.log_metrics()

    def _compare_values(self, actual, op: str, expected) -> bool:
        if op == "==":
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

    def _pick_nudge_speaker(self) -> str:
        if self.current_beat_plan and self.beat_index > 0:
            prev = self.current_beat_plan[self.beat_index - 1]
            prev_speaker = prev.get("speaker", "")
            if prev_speaker in ("trip", "grace"):
                return prev_speaker
        for i in range(self.beat_index - 1, -1, -1):
            sp = self.current_beat_plan[i].get("speaker", "")
            if sp in ("trip", "grace"):
                return sp
        return "trip"

    def handle_player_input(self, player_input: str):
        if self.event_loop and self.event_loop.pending_beat_task and not self.event_loop.pending_beat_task.done():
            self.event_loop.pending_beat_task.cancel()

        self._player_turn_active = False

        context = {
            "situation": "家庭晚餐",
            "landmark": self.landmark_manager.current_landmark_id
        }
        analysis = self.input_parser.validate_input(player_input, context)
        self.logger.debug(f"输入分析: valid={analysis.get('valid')}, severity={analysis.get('severity')}", module="input")

        if not analysis.get("valid") and analysis.get("severity") == "hard":
            reason = analysis.get("reason", "")
            input_rejected(reason)
            self._player_turn_active = True
            return

        self.current_turn += 1
        self.storylet_turn_count += 1
        self.director.advance_turn()
        self.landmark_manager.increment_turn_count()

        if player_input and player_input.strip():
            self.conversation_history.append(f"玩家: {player_input}")

        self._check_player_mediation(player_input)
        self._apply_beat_delta(player_input)

        self.current_beat_plan = []
        self.beat_index = 0

        storylet_changed = self._check_and_handle_transitions(player_input)
        if not storylet_changed:
            self.schedule_async(self._refresh_beat_plan())

    def handle_player_silence(self):
        if self.event_loop and self.event_loop.pending_beat_task and not self.event_loop.pending_beat_task.done():
            self.event_loop.pending_beat_task.cancel()

        self._player_turn_active = False

        self.current_turn += 1
        self.storylet_turn_count += 1
        self.director.advance_turn()
        self.landmark_manager.increment_turn_count()

        self.conversation_history.append("玩家: 保持沉默")
        player_silence()

        self._apply_beat_delta("")

        self.current_beat_plan = []
        self.beat_index = 0

        storylet_changed = self._check_and_handle_transitions("")
        if not storylet_changed:
            self.schedule_async(self._refresh_beat_plan())

    def handle_auto_beat(self):
        if not self.current_beat_plan or self.beat_index >= len(self.current_beat_plan):
            if self.event_loop:
                self.event_loop.notify_beat_done()
            return

        # 调试：打印完整 BeatPlan
        if self.debug_mode and self.beat_index == 0:
            print(f"\n[DEBUG] 完整 BeatPlan ({len(self.current_beat_plan)} beats):")
            for i, b in enumerate(self.current_beat_plan):
                print(f"  [{i}] {b['speaker']}: {b.get('intent', '')[:50]}...")
            print()

        beat = self.current_beat_plan[self.beat_index]

        try:
            if beat.get("speaker") == "narrator":
                content = beat.get("content", "")
                narrator_text(content)
                self.beat_index += 1
                return

            if beat.get("speaker") == "player_turn":
                return

            speaker = beat.get("speaker", "trip")
            beat_intent = beat.get("intent", "")
            addressee = beat.get("addressee", "")

            char_count = self._execute_storylet(beat_intent=beat_intent, speaker=speaker, addressee=addressee)
            self.last_beat_char_count = char_count or 0

            self.beat_index += 1
            self._apply_beat_delta("", beat)

            storylet_changed = self._check_and_handle_transitions("")
            if storylet_changed:
                return

            if self.beat_index >= len(self.current_beat_plan):
                self.schedule_async(self._refresh_beat_plan())

        finally:
            if self.event_loop:
                self.event_loop.notify_beat_done()