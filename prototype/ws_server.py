"""
FacadeRemake WebSocket Server
LLM 驱动的互动叙事后端
基于 DIContainer 重构版
"""
import sys
import os
import json
import asyncio
from typing import Optional, Dict, Any, List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

sys.path.insert(0, os.path.dirname(__file__))

# 改用 DIContainer 导入
from facade_remake.core.di_container import DIContainer


app = FastAPI(title="FacadeRemake WebSocket")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GameSession:
    """一个 WebSocket 连接对应的游戏会话"""

    def __init__(self, ws: WebSocket):
        self.ws = ws
        self._ws_ready = True
        self.turn = 0
        self.game_ended = False

        self._loop = asyncio.get_running_loop()

        # 使用 DIContainer 管理所有组件
        self.container = None
        self.llm_client = None
        self.trip_agent = None
        self.grace_agent = None
        self.director_agent = None

        # 从 container 获取的组件
        self.world_state = None
        self.storylet_manager = None
        self.landmark_manager = None
        self.story_selector = None
        self.input_parser = None

        # 当前 Storylet
        self.current_storylet = None
        self.storylet_turn_count = 0

        # 对话历史
        self.conversation_history: List[str] = []

        # 场景数据是否已加载
        self.scene_loaded = False

    def _init_container(self, provider: Optional[str] = None):
        """初始化 DIContainer"""
        try:
            from pathlib import Path
            try:
                from dotenv import load_dotenv
                prototype_dir = Path(__file__).resolve().parent
                env_local = prototype_dir / ".env.local"
                env_file = prototype_dir / ".env"
                if env_local.exists():
                    load_dotenv(env_local)
                elif env_file.exists():
                    load_dotenv(env_file)
            except ImportError:
                pass

            # 优先使用环境变量，其次使用参数
            env_provider = os.getenv("LLM_PROVIDER", "openai")
            effective_provider = provider or env_provider

            self.container = DIContainer(
                debug_mode=True,
                provider=effective_provider,
                scenario_config=None  # 场景配置由前端传入
            )

            # 获取核心组件（不含角色 Agent 和 Director，等场景数据到达后再初始化）
            self.world_state = self.container.world_state
            self.storylet_manager = self.container.storylet_manager
            self.landmark_manager = self.container.landmark_manager
            self.story_selector = self.container.story_selector
            self.input_parser = self.container.input_parser
            self.llm_client = self.container.llm_client
            # trip_agent, grace_agent, director_agent 延迟到 init_scene 中初始化

            # 注入 on_debug 回调
            ws_ref = self.ws
            loop_ref = self._loop
            import time as _time

            def _ws_debug_callback(event_type: str, payload: dict):
                try:
                    msg = {
                        "type": "llm_debug",
                        "event": event_type,
                        "data": payload,
                        "ts": _time.time(),
                    }

                    async def _do_send():
                        try:
                            await ws_ref.send_json(msg)
                        except Exception:
                            pass

                    coro = _do_send()
                    loop_ref.call_soon_threadsafe(loop_ref.create_task, coro)
                except Exception as e:
                    print(f"[debug-ws] 推送失败: {e}")

            if self.llm_client:
                self.llm_client.on_debug = _ws_debug_callback
                self.llm_client.debug = True

            print(f"[LLM] 已初始化 DIContainer（provider: {effective_provider}, debug=ON, WS推送=ON）")
        except RuntimeError as e:
            print(f"[LLM] 初始化失败: {e}")
            print(f"[LLM] 将以无 LLM 模式运行")

    def init_scene(self, scene_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """用前端传来的场景数据初始化 GameSession"""
        messages: List[Dict[str, Any]] = []

        landmarks = scene_data.get("landmarks", [])
        storylets = scene_data.get("storylets", [])
        characters = scene_data.get("characters", [])
        world_state_definition = scene_data.get("world_state_definition", {})

        # 首次初始化时创建 container
        if not self.container:
            self._init_container()

        if not landmarks:
            messages.append({
                "type": "chat",
                "role": "system",
                "speech": "[提示] 该项目尚未配置任何 Landmark 节点。请先在 Design 模式中创建叙事蓝图。",
            })
            messages.append(self._get_state_snapshot())
            return messages

        # 1. 初始化 WorldState
        wsd_qualities = world_state_definition.get("qualities", [])
        for q in wsd_qualities:
            self.world_state.set_quality(q["key"], q.get("initial", 0))

        wsd_flags = world_state_definition.get("flags", [])
        for f in wsd_flags:
            self.world_state.set_flag(f["key"], f.get("initial", False))

        wsd_relationships = world_state_definition.get("relationships", [])
        for r in wsd_relationships:
            self.world_state.set_relationship(r["key"], r.get("initial", 0))

        # 2. 加载 Landmarks
        self.landmark_manager.load_from_dicts(landmarks)

        # 3. 加载 Storylets
        self.storylet_manager.load_from_dicts(storylets)

        # 4. 设置初始 Landmark
        first_landmark = None
        for lm in landmarks:
            if not lm.get("is_ending", False):
                first_landmark = lm["id"]
                break
        if first_landmark is None and landmarks:
            first_landmark = landmarks[0]["id"]

        if first_landmark:
            self.landmark_manager.set_current(first_landmark, self.world_state)

        self.scene_loaded = True

        # 5. 用前端传来的角色配置构建 ScenarioConfig，初始化 CharacterAgent 和 Director
        if characters:
            self._init_agents_from_scene(characters, scene_data)

        # 6. 触发初始 Storylet 选择
        if storylets:
            initial_storylet = self.story_selector.select(
                self.world_state, self.turn
            )
            if initial_storylet:
                self.current_storylet = initial_storylet
                self.storylet_turn_count = 0
                self._apply_storylet_effects()
                if initial_storylet.narrative_goal and self.director_agent:
                    try:
                        self.director_agent.set_current_goal(initial_storylet.narrative_goal)
                    except Exception as e:
                        print(f"[Director] set_current_goal 失败: {e}")
                messages.append({
                    "type": "chat",
                    "role": "system",
                    "speech": f"[Storylet] {initial_storylet.title} — {initial_storylet.narrative_goal[:60]}",
                })

        messages.append(self._get_state_snapshot())
        return messages

    def _init_agents_from_scene(self, characters: List[Dict[str, Any]], scene_data: Dict[str, Any]):
        """根据前端传来的角色配置构建 ScenarioConfig，初始化 CharacterAgent 和 Director"""
        try:
            from facade_remake.config.scenario_schema import (
                ScenarioConfig, CharacterConfig, SceneConstraints,
                WorldStateDisplayConfig
            )

            # 构建 CharacterConfig 列表
            char_configs = []
            for char_data in characters:
                char_config = CharacterConfig(
                    id=char_data.get("id", ""),
                    name=char_data.get("name", char_data.get("id", "")),
                    identity=char_data.get("identity", ""),
                    personality=char_data.get("personality", ""),
                    background=char_data.get("background", []),
                    secret_knowledge=char_data.get("secret_knowledge", []),
                    ng_words=char_data.get("ng_words", []),
                    monologue_templates=char_data.get("monologues", []),
                )
                char_configs.append(char_config)

            # 构建 ScenarioConfig（只填充角色相关必填字段，storylets/landmarks 已单独加载）
            wsd = scene_data.get("world_state_definition", {})
            scenario_config = ScenarioConfig(
                id="frontend_scene",
                name="前端场景",
                setting_name="用户自定义场景",
                setting_description="",
                conflict_summary="",
                action_library=[],
                expression_library=[],
                prop_library=[],
                location_library=[],
                characters=char_configs,
                narrative_goals=[],
                world_state_schema=wsd,
                scene_constraints=SceneConstraints(
                    location_description="",
                    forbidden_actions=[],
                    forbidden_targets=[],
                ),
                world_state_display=WorldStateDisplayConfig(
                    quality_displays=[],
                    flag_displays=[],
                ),
                storylets=[],   # 已通过 storylet_manager.load_from_dicts 加载
                landmarks=[],   # 已通过 landmark_manager.load_from_dicts 加载
            )

            # 通过 configure_scenario 注入，会清除角色 Agent 等缓存并重建
            self.container.configure_scenario(scenario_config)

            # 现在可以安全访问角色 Agent 和 Director
            self.trip_agent = self.container.trip_agent
            self.grace_agent = self.container.grace_agent
            self.director_agent = self.container.director

            print(f"[LLM] CharacterAgent 初始化完成: {len(char_configs)} 个角色")

        except Exception as e:
            print(f"[LLM] 角色初始化失败: {e}")
            import traceback
            traceback.print_exc()

    def _get_state_snapshot(self) -> Dict[str, Any]:
        """获取当前完整状态快照（推送给前端）"""
        lm_id = self.landmark_manager.current_landmark_id
        lm_obj = self.landmark_manager.get_current()
        landmark_info = None
        if lm_obj:
            landmark_info = {
                "id": lm_id,
                "title": lm_obj.title,
                "phase_tag": lm_obj.phase_tag,
                "is_ending": lm_obj.is_ending,
            }

        sl_obj = self.current_storylet
        storylet_info = None
        if sl_obj:
            storylet_info = {
                "id": sl_obj.id,
                "title": sl_obj.title,
                "narrative_goal": sl_obj.narrative_goal,
                "phase_tags": sl_obj.phase_tags,
            }

        return {
            "type": "state_update",
            "world_state": self.world_state.to_dict(),
            "current_landmark_id": lm_id,
            "current_landmark": landmark_info,
            "current_storylet_id": sl_obj.id if sl_obj else None,
            "current_storylet": storylet_info,
            "turn": self.turn,
            "game_ended": self.game_ended,
        }

    def _collect_semantic_conditions(self) -> List:
        """收集当前阶段需要做语义匹配的条件"""
        conditions = []
        current_landmark = self.landmark_manager.get_current()
        if not current_landmark:
            return conditions

        allowed_tags = current_landmark.get_allowed_tags()

        for storylet in self.storylet_manager.storylets.values():
            if not storylet.llm_trigger:
                continue
            if allowed_tags:
                if not any(tag in storylet.phase_tags for tag in allowed_tags):
                    continue
            if not storylet.can_trigger(self.world_state, self.turn):
                continue
            conditions.append({
                "id": storylet.id,
                "source_type": "storylet",
                "description": storylet.llm_trigger,
            })

        for transition in current_landmark.transitions:
            for cond in transition.conditions:
                if cond.get("type") == "llm_semantic":
                    cond_id = cond.get("id", f"{current_landmark.id}→{transition.target_id}")
                    conditions.append({
                        "id": cond_id,
                        "source_type": "landmark_transition",
                        "description": cond.get("description", ""),
                        "metadata": {"transition_target": transition.target_id},
                    })

        return conditions

    def _handle_invalid_input(self, analysis: Dict) -> List[Dict[str, Any]]:
        """处理非法输入，生成角色困惑/回避反应"""
        messages = []
        response_mode = analysis.get("response_mode", "confused")

        if response_mode == "ignore":
            messages.append({
                "type": "chat",
                "role": "system",
                "speech": "[输入被忽略]",
            })
        elif response_mode in ("confused", "deflect"):
            messages.append({
                "type": "chat",
                "role": "narrator",
                "speech": "空气突然安静了一下。Trip 和 Grace 交换了一个不解的眼神。",
            })

        return messages

    async def send_beat_messages(self, storylet, player_input: str,
                                  director_extra: str = "") -> List[Dict[str, Any]]:
        """根据当前 Storylet 生成响应消息并逐条发送（BeatPlan 驱动）

        每生成一个 beat 的角色响应就立即通过 WS 推送，
        避免一次性全部涌出。返回最终的状态快照等非角色消息。
        """
        content = storylet.content
        remaining_messages: List[Dict[str, Any]] = []

        director_note = content.get("director_note", "")
        if director_note and self.storylet_turn_count <= 1:
            sentences = director_note.split("。")
            narration = "。".join(sentences[:2]).strip()
            if narration and not narration.endswith("。"):
                narration += "。"
            if narration:
                narrator_msg = {
                    "type": "chat",
                    "role": "narrator",
                    "speech": narration,
                }
                await self.ws.send_json(narrator_msg)
                await asyncio.sleep(0.4)

        # 1. Director 生成 BeatPlan（同步 LLM 调用）
        world_state_dict = self.world_state.to_dict()
        beat_plan = []
        if self.director_agent and self.director_agent.llm_client:
            try:
                loop = asyncio.get_event_loop()
                beat_plan = await loop.run_in_executor(
                    None,
                    lambda: self.director_agent.generate_beat_plan(
                        storylet_content=content,
                        world_state=world_state_dict,
                        dialogue_history=self.conversation_history,
                    )
                )
                if self.director_agent.debug_mode:
                    print(f"[Director] BeatPlan: {len(beat_plan)} beats")
            except Exception as e:
                print(f"[Director] BeatPlan 生成失败: {e}")

        if not beat_plan:
            empty_msg = {
                "type": "chat",
                "role": "narrator",
                "speech": "三人沉默着。空气凝固了一瞬。",
            }
            await self.ws.send_json(empty_msg)
            return []

        # 2. 逐条执行 beat，每条立即推送
        char_agents = {"trip": self.trip_agent, "grace": self.grace_agent}
        char_display = {"trip": "Trip", "grace": "Grace"}
        first_beat = True

        for beat in beat_plan:
            speaker = beat.get("speaker", "")
            beat_intent = beat.get("intent", "")
            addressee = beat.get("addressee", "player")

            if speaker == "player_turn":
                if self.director_agent and self.director_agent.debug_mode:
                    print(f"[Director] BeatPlan 结束，等待玩家输入")
                break

            if speaker not in char_agents:
                continue

            agent = char_agents[speaker]
            if agent is None:
                continue

            from facade_remake.agents.character_agent import Beat, BeatContext
            beat_obj = Beat(
                speaker=speaker,
                addressee=addressee,
                intent=beat_intent,
                urgency=beat.get("urgency", "medium"),
                world_state_delta=beat.get("world_state_delta", {}),
                state_change_hint=beat.get("state_change_hint", ""),
            )

            context = BeatContext(
                beat=beat_obj,
                character=speaker,
                player_input=player_input,
                dialogue_history=self.conversation_history,
                world_state=world_state_dict,
                character_profile=agent.profile,
                scenario_config=agent._scenario_config,
            )

            if director_extra:
                context.beat.intent = f"{context.beat.intent}\n{director_extra}"

            try:
                # 每个 beat 的角色生成是同步 LLM 调用
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(
                    None,
                    lambda: agent._generate_beat_response(beat_obj, context)
                )
                speech = result.get("dialogue", "")
                action = result.get("action", "")
                thought = result.get("thought", "")

                speech = agent._strip_name_prefix(speech)
                action = agent._validate_actions(action)

                parts = [p for p in [speech, action] if p]
                if parts:
                    self.conversation_history.append(f"{speaker}: {'  '.join(parts)}")

                chat_msg = {
                    "type": "chat",
                    "role": speaker,
                    "speaker_name": char_display.get(speaker, speaker),
                    "speech": speech,
                    "action": action,
                    "thought": thought,
                }

                # 生成完立即推送
                if not first_beat:
                    await asyncio.sleep(0.8)
                first_beat = False
                await self.ws.send_json(chat_msg)

            except Exception as e:
                print(f"[LLM] {speaker} 响应失败: {e}")
                error_msg = {
                    "type": "chat",
                    "role": "system",
                    "speech": f"[Error] {speaker} 生成失败: {e}",
                }
                if not first_beat:
                    await asyncio.sleep(0.5)
                first_beat = False
                await self.ws.send_json(error_msg)

        return remaining_messages

    async def process_turn(self, player_input: str, is_silence: bool = False) -> List[Dict[str, Any]]:
        """处理一个回合，逐条发送角色消息，返回剩余非角色消息"""
        self.turn += 1
        self.storylet_turn_count += 1

        messages: List[Dict[str, Any]] = []

        if is_silence:
            self.conversation_history.append("玩家: 保持沉默")
        else:
            self.conversation_history.append(f"玩家: {player_input}")

        if self.director_agent:
            try:
                self.director_agent.advance_turn()
            except Exception as e:
                print(f"[Director] advance_turn 失败: {e}")

        self.landmark_manager.increment_turn_count()

        # 发送玩家消息
        if is_silence:
            player_msg = {
                "type": "chat",
                "role": "player",
                "speech": "……",
                "is_silence": True,
            }
        else:
            player_msg = {
                "type": "chat",
                "role": "player",
                "speech": player_input,
            }
        await self.ws.send_json(player_msg)
        await asyncio.sleep(0.3)

        matched_semantic_ids = []
        analysis = {}  # 确保在 is_silence 时也有默认值
        if not is_silence:
            semantic_conditions = self._collect_semantic_conditions()
            analysis_context = {
                "situation": "老友做客，气氛微妙",
                "storylet_title": self.current_storylet.title if self.current_storylet else "",
            }
            analysis = self.input_parser.analyze(player_input, semantic_conditions, analysis_context)

            matched_semantic_ids = analysis.get("matched_conditions", [])
            print(f"[InputParser] valid={analysis.get('valid')}, matched={matched_semantic_ids}")

            if not analysis.get("valid", True):
                invalid_msgs = self._handle_invalid_input(analysis)
                for idx, msg in enumerate(invalid_msgs):
                    if idx > 0:
                        await asyncio.sleep(0.4)
                    await self.ws.send_json(msg)
                messages.append(self._get_state_snapshot())
                return messages

            self._check_player_mediation(player_input)

        should_select = (
            not self.current_storylet
            or (not self.current_storylet.sticky and self._should_switch_storylet())
        )
        if should_select:
            new_storylet = self.story_selector.select(
                self.world_state, self.turn,
                matched_semantic_ids=matched_semantic_ids,
            )
            if new_storylet:
                switched = (
                    not self.current_storylet
                    or new_storylet.id != self.current_storylet.id
                )
                if switched:
                    switch_msg = {
                        "type": "chat",
                        "role": "system",
                        "speech": f"[Storylet] {new_storylet.title} — {new_storylet.narrative_goal[:40]}",
                    }
                    await self.ws.send_json(switch_msg)
                    await asyncio.sleep(0.3)
                self.current_storylet = new_storylet
                self.storylet_turn_count = 0
                self._apply_storylet_effects()
                if new_storylet.narrative_goal and self.director_agent:
                    try:
                        self.director_agent.set_current_goal(new_storylet.narrative_goal)
                    except Exception as e:
                        print(f"[Director] set_current_goal 失败: {e}")
                self.landmark_manager.increment_storylet_count()

        if self.current_storylet:
            director_extra = ""
            if is_silence:
                director_extra = "\n（玩家选择了沉默。角色可以注意到并做出反应——追问、尴尬、生气、或自己继续话题。）"
            elif analysis.get("severity") == "soft" and analysis.get("response_mode") == "confused":
                director_extra = "\n（玩家的话有点奇怪，角色可以用困惑或转移话题的方式反应。）"

            # 逐条发送角色 beat 消息
            await self.send_beat_messages(self.current_storylet, player_input, director_extra)
        else:
            empty_msg = {
                "type": "chat",
                "role": "narrator",
                "speech": "三个人沉默着。空气凝固了一瞬。",
            }
            await self.ws.send_json(empty_msg)

        next_landmark_id = self.landmark_manager.check_progression(
            self.world_state, player_input,
            matched_semantic_ids=matched_semantic_ids,
        )
        if next_landmark_id:
            self.landmark_manager.set_current(next_landmark_id, self.world_state)
            next_landmark = self.landmark_manager.get_current()
            if next_landmark:
                landmark_msg = {
                    "type": "chat",
                    "role": "system",
                    "speech": f"[进入新阶段: {next_landmark.title}]",
                }
                await self.ws.send_json(landmark_msg)
                if next_landmark.is_ending:
                    ending_msg = {
                        "type": "chat",
                        "role": "narrator",
                        "speech": next_landmark.ending_content or next_landmark.description,
                    }
                    await self.ws.send_json(ending_msg)
                    self.game_ended = True

        messages.append(self._get_state_snapshot())
        return messages

    def _check_player_mediation(self, player_input: str):
        """检测玩家是否在坦白后做出调解行为"""
        if not self.world_state.get_flag("secrets_revealed"):
            return
        if self.world_state.get_flag("player_mediated"):
            return
        mediation_keywords = [
            "劝", "调解", "别吵", "好好说", "冷静", "和好", "谅解", "原谅",
            "理解", "沟通", "一起", "说清楚", "好好谈", "没事的", "没关系",
            "说开", "你们俩", "帮你们", "出面", "再给他一次机会",
        ]
        if any(kw in player_input for kw in mediation_keywords):
            self.world_state.set_flag("player_mediated", True)

    def _should_switch_storylet(self) -> bool:
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
        conditions = force_wrap.get("conditions", [])
        for condition in conditions:
            if not self._evaluate_condition(condition):
                return False
        return True

    def _evaluate_condition(self, condition: Dict) -> bool:
        cond_type = condition.get("type")
        if cond_type == "quality_check":
            actual = self.world_state.get_quality(condition.get("key"))
            return self._compare_values(actual, condition.get("op"), condition.get("value"))
        elif cond_type == "flag_check":
            actual = self.world_state.get_flag(condition.get("key"))
            return self._compare_values(actual, condition.get("op"), condition.get("value"))
        return True

    def _apply_storylet_effects(self):
        if not self.current_storylet:
            return
        for effect in self.current_storylet.effects:
            self.world_state.apply_effect(effect)
        for conditional_effect in self.current_storylet.conditional_effects:
            if self._check_conditional_effect(conditional_effect):
                for effect in conditional_effect.get("effects", []):
                    self.world_state.apply_effect(effect)

    def _check_conditional_effect(self, conditional_effect: Dict) -> bool:
        conditions = conditional_effect.get("conditions", [])
        if not conditions:
            return True
        for condition in conditions:
            cond_type = condition.get("type")
            if cond_type == "quality_check":
                key = condition.get("key")
                op = condition.get("op")
                value = condition.get("value")
                current = self.world_state.get_quality(key)
                if not self._compare_values(current, op, value):
                    return False
            elif cond_type == "flag_check":
                key = condition.get("key")
                op = condition.get("op")
                value = condition.get("value")
                current = self.world_state.get_flag(key)
                if not self._compare_values(current, op, value):
                    return False
            elif cond_type == "turn_range":
                min_turn = condition.get("min_turn", 0)
                max_turn = condition.get("max_turn", float('inf'))
                if self.turn < min_turn or self.turn > max_turn:
                    return False
        return True

    @staticmethod
    def _compare_values(actual, op: str, expected) -> bool:
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

    def apply_debug_worldstate(self, data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Debug 面板修改 WorldState，然后检查 Storylet/Landmark 切换"""
        messages: List[Dict[str, Any]] = []

        for k, v in data.get("qualities", {}).items():
            self.world_state.set_quality(k, float(v))
        for k, v in data.get("flags", {}).items():
            self.world_state.set_flag(k, v)
        for k, v in data.get("relationships", {}).items():
            self.world_state.set_relationship(k, float(v))

        next_landmark_id = self.landmark_manager.check_progression(
            self.world_state, ""
        )
        if next_landmark_id:
            self.landmark_manager.set_current(next_landmark_id, self.world_state)
            next_landmark = self.landmark_manager.get_current()
            if next_landmark:
                messages.append({
                    "type": "chat",
                    "role": "system",
                    "speech": f"[Debug] 进入新阶段: {next_landmark.title}",
                })
                if next_landmark.is_ending:
                    messages.append({
                        "type": "chat",
                        "role": "narrator",
                        "speech": next_landmark.ending_content or next_landmark.description,
                    })
                    self.game_ended = True

        new_storylet = self.story_selector.select(
            self.world_state, self.turn, ""
        )
        if new_storylet and (not self.current_storylet or
                            new_storylet.id != self.current_storylet.id):
            self.current_storylet = new_storylet
            self.storylet_turn_count = 0
            self._apply_storylet_effects()
            messages.append({
                "type": "chat",
                "role": "system",
                "speech": f"[Debug] 切换 Storylet: {new_storylet.title}",
            })

        messages.append(self._get_state_snapshot())
        return messages

    async def reset(self) -> List[Dict[str, Any]]:
        """重置游戏 — 前端应重新发送 init_scene"""
        self.turn = 0
        self.game_ended = False
        self.current_storylet = None
        self.storylet_turn_count = 0
        self.conversation_history = []
        self.scene_loaded = False

        # 重置 container 状态
        if self.container:
            self.container.init_world_state()
            self.world_state = self.container.world_state

        return [
            {
                "type": "chat",
                "role": "system",
                "speech": "游戏已重置。请发送 init_scene 重新加载场景。",
            },
        ]


def get_opening_messages(characters: List[Dict[str, Any]] = []) -> List[Dict[str, Any]]:
    """根据角色配置生成简短开场氛围描述"""
    if not characters:
        return [
            {
                "type": "chat",
                "role": "system",
                "speech": "[提示] 该项目尚未配置角色。请先在 Design 模式中添加角色。",
            },
        ]

    char_names = []
    for char_data in characters:
        char_id = char_data.get("id", "")
        if char_id == "player":
            continue
        name = char_data.get("name", char_id)
        char_names.append(name)

    if not char_names:
        return [
            {
                "type": "chat",
                "role": "narrator",
                "speech": "故事开始了。",
            },
        ]

    names_str = "、".join(char_names)
    return [
        {
            "type": "chat",
            "role": "narrator",
            "speech": f"故事开始了。{names_str}在场。",
        },
    ]


@app.websocket("/ws/play")
async def websocket_play(ws: WebSocket):
    await ws.accept()
    print(f"[WS] 新连接")

    session: Optional[GameSession] = None

    try:
        while True:
            raw = await ws.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_json({"type": "error", "message": "Invalid JSON"})
                continue

            msg_type = data.get("type")

            if msg_type == "init_scene":
                scene_data = data.get("data", {})
                landmarks_count = len(scene_data.get("landmarks", []))
                storylets_count = len(scene_data.get("storylets", []))
                characters_count = len(scene_data.get("characters", []))
                print(f"[WS] init_scene received: {landmarks_count} landmarks, {storylets_count} storylets, {characters_count} characters")
                session = GameSession(ws)

                try:
                    messages = session.init_scene(scene_data)
                    print(f"[WS] init_scene 返回 {len(messages)} 条消息, scene_loaded={session.scene_loaded}")

                    if session.scene_loaded:
                        characters = scene_data.get("characters", [])
                        opening = get_opening_messages(characters)
                        print(f"[WS] 准备发送开场消息 {len(opening)} 条")
                        for i, msg in enumerate(opening):
                            if i > 0:
                                await asyncio.sleep(0.6)
                            await ws.send_json(msg)
                        await asyncio.sleep(0.3)

                    print(f"[WS] 准备发送 init_scene 消息 {len(messages)} 条")
                    for idx, msg in enumerate(messages):
                        # chat 消息之间加延时，让前端逐条展示（state_update 不延时）
                        if idx > 0 and msg.get("type") == "chat":
                            await asyncio.sleep(0.4)
                        await ws.send_json(msg)

                    # 自动生成开场角色对话（不需要等玩家输入）
                    if session.scene_loaded and session.current_storylet and session.director_agent:
                        print(f"[WS] 自动生成开场对话...")
                        await asyncio.sleep(0.5)
                        try:
                            await session.send_beat_messages(
                                session.current_storylet,
                                player_input="",
                                director_extra="\n（这是故事的开场，玩家刚到达。角色需要主动迎接、寒暄、营造氛围。不需要等待玩家说话。）"
                            )
                        except Exception as e:
                            print(f"[WS] 开场对话生成失败: {e}")
                            import traceback
                            traceback.print_exc()

                        # 开场后发送一次状态快照
                        await ws.send_json(session._get_state_snapshot())

                    print("[WS] 所有消息发送完成")
                except Exception as e:
                    print(f"[WS] 发送消息失败: {e}")
                    import traceback
                    traceback.print_exc()

            elif msg_type == "player_input":
                if session is None:
                    await ws.send_json({"type": "error", "message": "Scene not initialized. Send init_scene first."})
                    continue

                player_text = data.get("text", "").strip()
                if session.game_ended:
                    await ws.send_json({
                        "type": "chat",
                        "role": "system",
                        "speech": "游戏已结束，请重置。",
                    })
                    continue

                is_silence = not player_text
                if is_silence:
                    player_text = "保持沉默"

                # process_turn 内部已逐条发送角色消息，返回剩余非角色消息
                remaining = await session.process_turn(player_text, is_silence=is_silence)
                for idx, msg in enumerate(remaining):
                    if idx > 0 and msg.get("type") == "chat":
                        await asyncio.sleep(0.4)
                    await ws.send_json(msg)

            elif msg_type == "debug_worldstate":
                if session is None:
                    await ws.send_json({"type": "error", "message": "Scene not initialized."})
                    continue
                messages = session.apply_debug_worldstate(data.get("data", {}))
                for idx, msg in enumerate(messages):
                    if idx > 0 and msg.get("type") == "chat":
                        await asyncio.sleep(0.4)
                    await ws.send_json(msg)

            elif msg_type == "reset":
                if session is None:
                    await ws.send_json({"type": "error", "message": "Scene not initialized."})
                    continue
                messages = await session.reset()
                for idx, msg in enumerate(messages):
                    if idx > 0 and msg.get("type") == "chat":
                        await asyncio.sleep(0.4)
                    await ws.send_json(msg)

            else:
                await ws.send_json({"type": "error", "message": f"Unknown type: {msg_type}"})

    except WebSocketDisconnect:
        print("[WS] Client disconnected")
    except Exception as e:
        print(f"[WS] Error: {e}")
        try:
            await ws.send_json({"type": "error", "message": str(e)})
        except:
            pass


@app.get("/api/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    print("=" * 50)
    print("FacadeRemake WebSocket Server")
    print("ws://localhost:8000/ws/play")
    print("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=8000)