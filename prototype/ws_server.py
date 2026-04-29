"""
FacadeRemake WebSocket Server
LLM 驱动的互动叙事后端
"""
import sys
import os
import json
import asyncio
from typing import Optional, Dict, Any, List
from functools import partial

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# ws_server.py 在 prototype/ 下，facade_remake 包也在 prototype/ 下
sys.path.insert(0, os.path.dirname(__file__))

from facade_remake.core.world_state import WorldState
from facade_remake.core.storylet import StoryletManager
from facade_remake.core.landmark import LandmarkManager
from facade_remake.core.story_selector import StorySelector
from facade_remake.core.input_parser import InputParser, SemanticCondition, SemanticConditionStore


app = FastAPI(title="FacadeRemake WebSocket")

# CORS
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
        self._ws_ready = True  # ws 连接可用
        self.turn = 0
        self.game_ended = False

        # 在主线程中保存 event loop 引用，供线程池中的回调使用
        self._loop = asyncio.get_running_loop()

        # ── LLM 初始化（优先于 managers，以便注入 llm_client）──
        self.llm_client = None
        self.trip_agent = None
        self.grace_agent = None
        self.director_agent = None
        self._init_llm_agents()

        # 初始化后端核心组件（空壳，等 init_scene 填充）
        self.world_state = WorldState()
        self.storylet_manager = StoryletManager(llm_client=self.llm_client)
        self.landmark_manager = LandmarkManager(llm_client=self.llm_client)
        self.story_selector = StorySelector(
            self.storylet_manager,
            self.landmark_manager,
            llm_client=self.llm_client,
        )
        self.input_parser = InputParser(llm_client=self.llm_client)
        self.condition_store = SemanticConditionStore()

        # 当前 Storylet
        self.current_storylet = None
        self.storylet_turn_count = 0

        # 对话历史
        self.conversation_history: List[str] = []

        # 场景数据是否已加载
        self.scene_loaded = False

    def init_scene(self, scene_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """用前端传来的场景数据初始化 GameSession"""
        messages: List[Dict[str, Any]] = []

        landmarks = scene_data.get("landmarks", [])
        storylets = scene_data.get("storylets", [])
        characters = scene_data.get("characters", [])
        world_state_definition = scene_data.get("world_state_definition", {})

        if not landmarks:
            # 空项目：通知前端没有场景数据
            messages.append({
                "type": "chat",
                "role": "system",
                "speech": "[提示] 该项目尚未配置任何 Landmark 节点。请先在 Design 模式中创建叙事蓝图。",
            })
            messages.append(self._get_state_snapshot())
            return messages

        # 1. 初始化 WorldState（根据 world_state_definition）
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

        # 4. 设置初始 Landmark（取第一个非结局节点）
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

        # 5. 用前端传来的角色配置初始化 CharacterAgent
        if characters and self.llm_client:
            self._init_characters_from_scene(characters)

        # 6. 触发初始 Storylet 选择
        if storylets:
            initial_storylet = self.story_selector.select(
                self.world_state, self.turn
            )
            if initial_storylet:
                self.current_storylet = initial_storylet
                self.storylet_turn_count = 0
                self._apply_storylet_effects()
                # 设置 Director 叙事目标
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

    def _init_llm_agents(self):
        """初始化 LLM 相关 Agent"""
        try:
            from facade_remake.agents.llm_client import LLMClient
            from facade_remake.agents.director import DirectorAgent

            # 加载 .env.local / .env
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

            # 支持通过环境变量或请求参数选择 LLM provider
            provider = os.getenv("LLM_PROVIDER", "openai")
            model = os.getenv("LLM_MODEL")
            self.llm_client = LLMClient(provider=provider, model=model)
            self.llm_client.debug = True  # 终端也打印

            # 注入 on_debug 回调：将 LLM 调试信息通过 WebSocket 推送到前端
            # 回调在线程池中执行，必须用 call_soon_threadsafe 调度到主线程
            ws_ref = self.ws
            loop_ref = self._loop  # 闭包捕获主线程的 event loop
            import time as _time
            def _ws_debug_callback(event_type: str, payload: dict):
                """LLMClient.on_debug 回调（线程池中执行）"""
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
            self.llm_client.on_debug = _ws_debug_callback

            self.director_agent = DirectorAgent(self.llm_client)
            self.director_agent.set_debug(True)
            print(f"[LLM] 已初始化 LLMClient + DirectorAgent（模型: {model}, debug=ON, WS推送=ON）")
        except RuntimeError as e:
            print(f"[LLM] 初始化失败: {e}")
            print(f"[LLM] 将以无 LLM 模式运行（仅 WorldState/Storylet/Landmark 调度可用）")


    def _init_characters_from_scene(self, characters: List[Dict[str, Any]]):
        """根据前端传来的角色配置初始化 CharacterAgent"""
        try:
            from facade_remake.agents.llm_client import CharacterAgent

            for char_data in characters:
                char_id = char_data.get("id", "")
                if char_id not in ("trip", "grace"):
                    continue

                # 构造 character_profile 供 CharacterAgent 使用
                profile = {
                    "name": char_data.get("name", char_id),
                    "identity": char_data.get("identity", ""),
                    "personality": char_data.get("personality", ""),
                    "background": char_data.get("background", []),
                    "secret_knowledge": char_data.get("secret_knowledge", []),
                    "ng_words": char_data.get("ng_words", []),
                }

                # monologue_knowledge
                monologues = char_data.get("monologues", [])
                monologue_knowledge = []
                for m in monologues:
                    monologue_knowledge.append({
                        "ref_secret": m.get("ref_secret", ""),
                        "category": m.get("category", ""),
                        "monologue": m.get("monologue", ""),
                        "emotion_tags": m.get("emotion_tags", []),
                    })
                profile["monologue_knowledge"] = monologue_knowledge

                # 行为库（由前端下发）
                profile["behaviors"] = char_data.get("behaviors", [])
                profile["behavior_meta"] = char_data.get("behavior_meta", {})

                agent = CharacterAgent(self.llm_client, char_id, character_profile=profile)

                if char_id == "trip":
                    self.trip_agent = agent
                elif char_id == "grace":
                    self.grace_agent = agent

                print(f"[LLM] CharacterAgent 初始化完成: {char_id}（{profile['name']}）")
        except Exception as e:
            print(f"[LLM] 角色初始化失败: {e}")

    def _get_state_snapshot(self) -> Dict[str, Any]:
        """获取当前完整状态快照（推送给前端）"""
        # 解析 landmark 信息
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

        # 解析 storylet 信息
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

    def _collect_semantic_conditions(self) -> List[SemanticCondition]:
        """收集当前阶段需要做语义匹配的条件。

        剪枝策略：只取当前 Landmark 内的 Storylet + 出边 transition。
        通常 2~15 条，全量 LLM 判断即可。
        """
        conditions = []
        current_landmark = self.landmark_manager.get_current()
        if not current_landmark:
            return conditions

        allowed_tags = current_landmark.get_allowed_tags()

        # 1. 当前阶段候选 Storylet 的 llm_trigger
        for storylet in self.storylet_manager.storylets.values():
            if not storylet.llm_trigger:
                continue
            # 标签过滤
            if allowed_tags:
                if not any(tag in storylet.phase_tags for tag in allowed_tags):
                    continue
            # 结构性条件过滤（flag/quality/cooldown）
            if not storylet.can_trigger(self.world_state, self.turn):
                continue
            conditions.append(SemanticCondition(
                id=storylet.id,
                source_type="storylet",
                description=storylet.llm_trigger,
            ))

        # 2. 当前 Landmark 出边 transition 的 llm_semantic 条件
        for transition in current_landmark.transitions:
            for cond in transition.conditions:
                if cond.get("type") == "llm_semantic":
                    cond_id = cond.get("id", f"{current_landmark.id}→{transition.target_id}")
                    conditions.append(SemanticCondition(
                        id=cond_id,
                        source_type="landmark_transition",
                        description=cond.get("description", ""),
                        metadata={"transition_target": transition.target_id},
                    ))

        return conditions

    def _handle_invalid_input(self, analysis: Dict) -> List[Dict[str, Any]]:
        """处理非法输入，生成角色困惑/回避反应"""
        messages = []
        response_mode = analysis.get("response_mode", "confused")
        reason = analysis.get("reason", "")

        if response_mode == "ignore":
            messages.append({
                "type": "chat",
                "role": "system",
                "speech": f"[输入被忽略]",
            })
        elif response_mode in ("confused", "deflect"):
            # 角色用困惑的方式反应
            messages.append({
                "type": "chat",
                "role": "narrator",
                "speech": "空气突然安静了一下。Trip 和 Grace 交换了一个不解的眼神。",
            })

        return messages

    def _generate_storylet_response(self, storylet, player_input: str,
                                     director_extra: str = "") -> List[Dict[str, Any]]:
        """根据当前 Storylet 生成响应消息（BeatPlan 驱动）"""
        content = storylet.content

        messages: List[Dict[str, Any]] = []

        # 1. 旁白（仅在 Storylet 首轮发送）
        director_note = content.get("director_note", "")
        if director_note and self.storylet_turn_count <= 1:
            sentences = director_note.split("。")
            narration = "。".join(sentences[:2]).strip()
            if narration and not narration.endswith("。"):
                narration += "。"
            if narration:
                messages.append({
                    "type": "chat",
                    "role": "narrator",
                    "speech": narration,
                })

        # 2. 获取 BeatPlan（由 Director 生成，包含说话人、意图等）
        world_state_dict = self.world_state.to_dict()
        beat_plan = []
        if self.director_agent and self.director_agent.llm_client:
            try:
                beat_plan = self.director_agent.generate_beat_plan(
                    storylet_content=content,
                    world_state=world_state_dict,
                    dialogue_history=self.conversation_history,
                )
                if self.director_agent.debug_mode:
                    print(f"[Director] BeatPlan: {len(beat_plan)} beats")
            except Exception as e:
                print(f"[Director] BeatPlan 生成失败: {e}")

        if not beat_plan:
            # Fallback：兜底旁白
            messages.append({
                "type": "chat",
                "role": "narrator",
                "speech": "三人沉默着。空气凝固了一瞬。",
            })
            return messages

        # 3. 执行 BeatPlan
        char_agents = {"trip": self.trip_agent, "grace": self.grace_agent}
        char_display = {"trip": "Trip", "grace": "Grace"}
        forbidden = storylet.content.get("forbidden_reveals", [])
        allowed_behaviors = storylet.content.get("allowed_behaviors", None)

        for beat in beat_plan:
            speaker = beat.get("speaker", "")
            beat_intent = beat.get("intent", "")
            addressee = beat.get("addressee", "player")

            # player_turn = 交还给玩家
            if speaker == "player_turn":
                if self.director_agent and self.director_agent.debug_mode:
                    print(f"[Director] BeatPlan 结束，等待玩家输入")
                break

            # 忽略无效 speaker
            if speaker not in char_agents:
                continue

            agent = char_agents[speaker]
            if agent is None:
                continue

            # 构建 BeatContext
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

            # 注入额外提示（如 soft 违规、沉默等）
            if director_extra:
                context.beat.intent = f"{context.beat.intent}\n{director_extra}"

            try:
                result = agent._generate_beat_response(beat_obj, context)
                speech = result.get("dialogue", "")
                action = result.get("action", "")
                thought = result.get("thought", "")

                # 清理前缀（如 "Grace: "）
                speech = agent._strip_name_prefix(speech)

                # 验证并清理动作
                action = agent._validate_actions(action)

                # 记录到对话历史
                parts = [p for p in [speech, action] if p]
                if parts:
                    self.conversation_history.append(f"{speaker}: {'  '.join(parts)}")

                messages.append({
                    "type": "chat",
                    "role": speaker,
                    "speaker_name": char_display.get(speaker, speaker),
                    "speech": speech,
                    "action": action,
                    "thought": thought,
                })

            except Exception as e:
                print(f"[LLM] {speaker} 响应失败: {e}")
                messages.append({
                    "type": "chat",
                    "role": "system",
                    "speech": f"[Error] {speaker} 生成失败: {e}",
                })

        return messages

    async def process_turn(self, player_input: str, is_silence: bool = False) -> List[Dict[str, Any]]:
        """处理一个回合，返回要推送给前端的消息列表

        Args:
            player_input: 玩家输入文本
            is_silence: True 表示玩家保持沉默（回车/超时），此时对话历史记录"保持沉默"
        """
        self.turn += 1
        self.storylet_turn_count += 1

        messages: List[Dict[str, Any]] = []

        # 记录玩家输入到对话历史
        if is_silence:
            self.conversation_history.append("玩家: 保持沉默")
        else:
            self.conversation_history.append(f"玩家: {player_input}")

        # ── 通知 Director 推进回合计数 ──
        if self.director_agent:
            try:
                self.director_agent.advance_turn()
            except Exception as e:
                print(f"[Director] advance_turn 失败: {e}")

        # ── 通知 LandmarkManager 推进回合计数 ──
        self.landmark_manager.increment_turn_count()

        # ── 玩家消息回显 ──
        if is_silence:
            messages.append({
                "type": "chat",
                "role": "player",
                "speech": "……",
                "is_silence": True,
            })
        else:
            messages.append({
                "type": "chat",
                "role": "player",
                "speech": player_input,
            })

        # ── InputParser：合法性检查 + 语义条件匹配 ──
        # 沉默时跳过 InputParser（不需要检查合法性），直接生成角色对沉默的反应
        matched_semantic_ids = []
        if not is_silence:
            semantic_conditions = self._collect_semantic_conditions()
            analysis_context = {
                "situation": "老友做客，气氛微妙",
                "storylet_title": self.current_storylet.title if self.current_storylet else "",
            }
            analysis = self.input_parser.analyze(player_input, semantic_conditions, analysis_context)

            matched_semantic_ids = analysis.get("matched_conditions", [])
            print(f"[InputParser] valid={analysis.get('valid')}, matched={matched_semantic_ids}")

            # ── 非法输入处理 ──
            if not analysis.get("valid", True):
                invalid_msgs = self._handle_invalid_input(analysis)
                messages.extend(invalid_msgs)
                messages.append(self._get_state_snapshot())
                return messages

            # ── 检测玩家调解行为 ──
            self._check_player_mediation(player_input)

        # ── Storylet 选择（传入 matched_semantic_ids）──
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
                    messages.append({
                        "type": "chat",
                        "role": "system",
                        "speech": f"[Storylet] {new_storylet.title} — {new_storylet.narrative_goal[:40]}",
                    })
                self.current_storylet = new_storylet
                self.storylet_turn_count = 0
                self._apply_storylet_effects()
                # 更新 Director 叙事目标
                if new_storylet.narrative_goal and self.director_agent:
                    try:
                        self.director_agent.set_current_goal(new_storylet.narrative_goal)
                    except Exception as e:
                        print(f"[Director] set_current_goal 失败: {e}")
                # 通知 LandmarkManager：本阶段又切换了一个 Storylet
                self.landmark_manager.increment_storylet_count()

        # ── 生成角色响应（基于当前 Storylet）──
        if self.current_storylet:
            # 如果 InputParser 检测到 soft 违规，给 Director 注入提示
            director_extra = ""
            if is_silence:
                director_extra = "\n（玩家选择了沉默。角色可以注意到并做出反应——追问、尴尬、生气、或自己继续话题。）"
            elif analysis.get("severity") == "soft" and analysis.get("response_mode") == "confused":
                director_extra = "\n（玩家的话有点奇怪，角色可以用困惑或转移话题的方式反应。）"

            # LLM 调用是同步的，用线程池避免阻塞事件循环
            loop = asyncio.get_event_loop()
            response_msgs = await loop.run_in_executor(
                None,
                partial(self._generate_storylet_response, self.current_storylet, player_input, director_extra)
            )
            messages.extend(response_msgs)
        else:
            # 兜底：没有 Storylet 时的默认响应
            messages.append({
                "type": "chat",
                "role": "narrator",
                "speech": "三个人沉默着。空气凝固了一瞬。",
            })

        # ── 检查 Landmark 推进（传入 matched_semantic_ids）──
        next_landmark_id = self.landmark_manager.check_progression(
            self.world_state, player_input,
            matched_semantic_ids=matched_semantic_ids,
        )
        if next_landmark_id:
            self.landmark_manager.set_current(next_landmark_id, self.world_state)
            next_landmark = self.landmark_manager.get_current()
            if next_landmark:
                messages.append({
                    "type": "chat",
                    "role": "system",
                    "speech": f"[进入新阶段: {next_landmark.title}]",
                })
                if next_landmark.is_ending:
                    messages.append({
                        "type": "chat",
                        "role": "narrator",
                        "speech": next_landmark.ending_content or next_landmark.description,
                    })
                    self.game_ended = True

        # ── 推送状态更新 ──
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
        # sticky Storylet 不会被切换，除非达到强制结束条件
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
        """检查是否应该强制结束当前 Storylet"""
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
        """评估单个条件"""
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
        # 应用普通效果
        for effect in self.current_storylet.effects:
            self.world_state.apply_effect(effect)
        # 应用条件效果
        for conditional_effect in self.current_storylet.conditional_effects:
            if self._check_conditional_effect(conditional_effect):
                for effect in conditional_effect.get("effects", []):
                    self.world_state.apply_effect(effect)

    def _check_conditional_effect(self, conditional_effect: Dict) -> bool:
        """检查条件效果是否满足"""
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
        """比较值"""
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

        # qualities
        for k, v in data.get("qualities", {}).items():
            self.world_state.set_quality(k, float(v))
        # flags
        for k, v in data.get("flags", {}).items():
            self.world_state.set_flag(k, v)
        # relationships
        for k, v in data.get("relationships", {}).items():
            self.world_state.set_relationship(k, float(v))

        # ── 检查 Landmark 推进 ──
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

        # ── 检查 Storylet 切换 ──
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

        # 推送最终状态
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
        return [
            {
                "type": "chat",
                "role": "system",
                "speech": "游戏已重置。请发送 init_scene 重新加载场景。",
            },
        ]


# ── 开场消息（默认模板，仅作为 fallback）──
def get_opening_messages(characters: List[Dict[str, Any]] = []) -> List[Dict[str, Any]]:
    """根据角色配置生成简短开场氛围描述（不截取 identity 作为台词）"""
    if not characters:
        return [
            {
                "type": "chat",
                "role": "system",
                "speech": "[提示] 该项目尚未配置角色。请先在 Design 模式中添加角色。",
            },
        ]

    # 收集非玩家角色名，用于旁白
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


# ── WebSocket 端点 ──
@app.websocket("/ws/play")
async def websocket_play(ws: WebSocket):
    await ws.accept()
    print(f"[WS] 新连接")

    # 不再立即创建 session，等前端发 init_scene
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
                # ── 初始化场景（前端发来的完整场景数据）──
                scene_data = data.get("data", {})
                landmarks_count = len(scene_data.get("landmarks", []))
                storylets_count = len(scene_data.get("storylets", []))
                characters_count = len(scene_data.get("characters", []))
                print(f"[WS] init_scene received: {landmarks_count} landmarks, {storylets_count} storylets, {characters_count} characters")
                session = GameSession(ws)

                messages = session.init_scene(scene_data)
                if session.scene_loaded:
                    # 发送开场消息
                    characters = scene_data.get("characters", [])
                    opening = get_opening_messages(characters)
                    for i, msg in enumerate(opening):
                        if i > 0:
                            await asyncio.sleep(0.6)
                        await ws.send_json(msg)
                    await asyncio.sleep(0.3)
                for msg in messages:
                    await ws.send_json(msg)

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

                # 空输入 = 玩家保持沉默，和命令行回车沉默走同一逻辑
                is_silence = not player_text
                if is_silence:
                    player_text = "保持沉默"

                messages = await session.process_turn(player_text, is_silence=is_silence)
                for msg in messages:
                    await ws.send_json(msg)

            elif msg_type == "debug_worldstate":
                if session is None:
                    await ws.send_json({"type": "error", "message": "Scene not initialized."})
                    continue
                messages = session.apply_debug_worldstate(data.get("data", {}))
                for msg in messages:
                    await ws.send_json(msg)

            elif msg_type == "reset":
                if session is None:
                    await ws.send_json({"type": "error", "message": "Scene not initialized."})
                    continue
                messages = await session.reset()
                for msg in messages:
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


# ── REST 端点（健康检查）──
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
