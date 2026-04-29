"""
Director Agent 模块 - 基于 IBSEN 论文的导演-演员系统

IBSEN 论文核心机制：
- Director（导演）：管理叙事目标、生成剧情指导、控制叙事节奏
- Actor（演员）：接收导演指导，结合角色记忆生成响应

FacadeRemake 的 Director 设计：
1. GoalTracker：追踪叙事目标进度，每 N 回合评估完成度
2. InstructionGenerator：基于当前 Storylet + 对话历史 + 世界状态生成动态指导
3. DirectorAgent：协调 GoalTracker 和 InstructionGenerator，为每个角色生成针对性指导
"""
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
import json

from config.scenario_schema import ScenarioConfig


class GoalStatus(Enum):
    """叙事目标状态"""
    IN_PROGRESS = "in_progress"
    NEARLY_COMPLETE = "nearly_complete"
    COMPLETE = "complete"
    FAILED = "failed"


@dataclass
class NarrativeGoal:
    """叙事目标数据结构"""
    id: str
    description: str
    target_turns: int = 3
    current_turns: int = 0
    status: GoalStatus = GoalStatus.IN_PROGRESS
    interventions: int = 0
    checkpoints: List[str] = field(default_factory=list)
    failed_attempts: int = 0

    def advance_turn(self):
        """推进一回合"""
        self.current_turns += 1
        if self.current_turns >= self.target_turns:
            self.status = GoalStatus.NEARLY_COMPLETE

    def mark_complete(self):
        """标记为目标完成"""
        self.status = GoalStatus.COMPLETE

    def mark_intervention(self):
        """记录一次干预"""
        self.interventions += 1
        if self.interventions >= 3:
            self.status = GoalStatus.FAILED





class GoalTracker:
    """叙事目标追踪器"""

    def __init__(self):
        self.current_goal: Optional[NarrativeGoal] = None
        self.goal_history: List[NarrativeGoal] = []
        self.default_target_turns = 5

    def set_goal(self, narrative_goal: str, target_turns: Optional[int] = None) -> NarrativeGoal:
        """设置新的叙事目标"""
        goal = NarrativeGoal(
            id=f"goal_{len(self.goal_history)}",
            description=narrative_goal,
            target_turns=target_turns or self.default_target_turns
        )
        self.current_goal = goal
        return goal

    def advance_turn(self):
        """推进回合计数器"""
        if self.current_goal:
            self.current_goal.advance_turn()

    def check_completion(self, world_state: Dict, 
                        dialogue_history: List[str],
                        llm_client) -> Tuple[GoalStatus, str]:
        """检查叙事目标完成状态"""
        if not self.current_goal:
            return GoalStatus.COMPLETE, "无活跃目标"

        if self.current_goal.current_turns >= self.current_goal.target_turns:
            if self.current_goal.status == GoalStatus.NEARLY_COMPLETE:
                if llm_client:
                    return self._llm_check_completion(world_state, dialogue_history)
                return GoalStatus.NEARLY_COMPLETE, "目标回合数已到"

        for checkpoint in self.current_goal.checkpoints:
            if not self._check_checkpoint(checkpoint, dialogue_history):
                return GoalStatus.IN_PROGRESS, f"检查点未完成: {checkpoint}"

        return self.current_goal.status, ""

    def _llm_check_completion(self, world_state: Dict,
                              dialogue_history: List[str]) -> Tuple[GoalStatus, str]:
        """使用 LLM 判断目标是否完成"""
        prompt = f"""你是一个叙事目标评估器。

当前叙事目标：{self.current_goal.description}
目标回合数：{self.current_goal.target_turns}
已过回合数：{self.current_goal.current_turns}

最近对话：
{chr(10).join(dialogue_history[-5:]) if dialogue_history else '(无)'}

请评估：这个叙事目标是否已经基本完成？
- "YES"：目标已完成或接近完成，角色已经做出了预期的反应
- "NO"：目标尚未完成，还需要更多回合

只回答 YES 或 NO："""

        try:
            response = llm_client.call_llm(prompt, max_tokens=10, temperature=0.0)
            response = response.strip().upper()
            if "YES" in response:
                self.current_goal.mark_complete()
                return GoalStatus.COMPLETE, "LLM 判定完成"
            else:
                return GoalStatus.IN_PROGRESS, "LLM 判定未完成"
        except Exception as e:
            return GoalStatus.IN_PROGRESS, f"LLM 检查失败: {e}"

    def _check_checkpoint(self, checkpoint: str, dialogue_history: List[str]) -> bool:
        """检查单个检查点"""
        history_text = " ".join(dialogue_history)
        checkpoint_lower = checkpoint.lower()
        return any(keyword in history_text.lower() for keyword in checkpoint.split())

    def get_progress_report(self) -> str:
        """获取目标进度报告"""
        if not self.current_goal:
            return "无活跃目标"
        g = self.current_goal
        progress = min(100, int(g.current_turns / g.target_turns * 100))
        return f"目标进度: {progress}% ({g.current_turns}/{g.target_turns} 回合) | 状态: {g.status.value}"


class InstructionGenerator:
    """导演指导生成器"""

    def __init__(self, llm_client=None, scenario_config: Optional[ScenarioConfig] = None):
        self.llm_client = llm_client
        self.scenario_config = scenario_config

    def _get_character_config(self, character: str) -> Dict[str, str]:
        """从配置获取角色信息"""
        if self.scenario_config and self.scenario_config.characters:
            for char in self.scenario_config.characters:
                if char.id == character:
                    return {
                        "role": f"{char.name}，{char.identity}，{'、'.join(char.background)}",
                        "secret": "、".join(char.secret_knowledge),
                        "emotion": char.personality
                    }
        return {}

    def _get_forbidden_topics(self, storylet_content: Dict) -> List[str]:
        """获取禁止话题列表"""
        return storylet_content.get("forbidden_topics", [])

    def generate_llm_instruction(self,
                               character: str,
                               storylet_content: Dict[str, Any],
                               world_state: Dict[str, Any],
                               dialogue_history: List[str],
                               current_goal: Optional[NarrativeGoal] = None) -> str:
        """使用 LLM 生成更精细的导演指导"""
        if not self.llm_client:
            print("[Director] LLM 不可用，跳过导演指导生成")
            return ""

        narrative_goal = storylet_content.get("narrative_goal", "")
        director_note = storylet_content.get("director_note", "")
        tone = storylet_content.get("tone", "neutral")

        char_config = self._get_character_config(character)
        if not char_config:
            char_config = {
                "role": f"{character}，角色信息未配置",
                "secret": "未配置",
                "emotion": "未配置"
            }

        recent_history = "\n".join(dialogue_history) if dialogue_history else "(无)"

        prompt = f"""你是一个叙事导演，正在为一场戏剧生成导演指导。

【当前角色】
{char_config.get('role', '')}

【角色秘密】
{char_config.get('secret', '')}

【角色当前情绪】
{char_config.get('emotion', '')}

【叙事目标】
{narrative_goal}

【场景说明】
{director_note}

【情绪基调】
{tone}

【最近对话】
{recent_history}

请为这个角色生成导演指导，包含以下方面：
1. 本轮主要目标（1-2句话）
2. 情绪基调指导（具体的情绪词汇）
3. 叙事节奏（推动/维持/释放）
4. 对话策略建议（如何回应玩家输入）
5. 禁止行为（什么话不能说，什么动作不能做）

请用中文输出，格式简洁明了，像导演在给演员说戏一样。"""

        try:
            instruction_text = self.llm_client.call_llm(
                prompt,
                max_tokens=200,
                temperature=0.5
            )
            return instruction_text.strip()
        except Exception as e:
            return ""


class DirectorAgent:
    """导演 Agent"""

    def __init__(self, llm_client=None, scenario_config: Optional[ScenarioConfig] = None):
        self.llm_client = llm_client
        self.scenario_config = scenario_config
        self.goal_tracker = GoalTracker()
        self.instruction_generator = InstructionGenerator(llm_client, scenario_config)
        self.debug_mode = False

        self.instruction_history: List[Dict] = []

    def set_debug(self, enabled: bool):
        """设置调试模式"""
        self.debug_mode = enabled

    def set_current_goal(self, narrative_goal: str, target_turns: Optional[int] = None):
        """设置当前叙事目标"""
        goal = self.goal_tracker.set_goal(narrative_goal, target_turns)
        if self.debug_mode:
            print(f"[Director] 设置新目标: {narrative_goal[:50]}... (目标回合: {target_turns or '默认5'})")
        return goal

    def advance_turn(self):
        """推进回合计数器"""
        self.goal_tracker.advance_turn()

    def generate_instruction_for(self,
                                character: str,
                                storylet_content: Dict[str, Any],
                                world_state: Dict[str, Any],
                                dialogue_history: List[str],
                                use_llm: bool = True) -> str:
        """为指定角色生成导演指导"""
        current_goal = self.goal_tracker.current_goal

        if use_llm and self.llm_client:
            instruction_text = self.instruction_generator.generate_llm_instruction(
                character,
                storylet_content,
                world_state,
                dialogue_history,
                current_goal
            )
        else:
            instruction_text = ""

        self.instruction_history.append({
            "turn": len(self.instruction_history),
            "character": character,
            "instruction": instruction_text,
            "goal": current_goal.description if current_goal else None
        })

        if self.debug_mode:
            print(f"[Director] 为 {character} 生成指导:")
            print(f"  {instruction_text[:100]}...")

        return instruction_text

    def check_and_update_goal(self,
                             world_state: Dict[str, Any],
                             dialogue_history: List[str]) -> Tuple[bool, str]:
        """检查叙事目标状态，必要时更新"""
        status, reason = self.goal_tracker.check_completion(
            world_state,
            dialogue_history,
            self.llm_client
        )

        if self.debug_mode:
            print(f"[Director] 目标检查: {status.value} - {reason}")

        if status == GoalStatus.FAILED:
            self.goal_tracker.current_goal.mark_intervention()
            return True, f"目标接近失败: {reason}"

        if status == GoalStatus.NEARLY_COMPLETE:
            return False, "目标快完成"

        return False, reason

    def generate_beat_plan(self,
                           storylet_content: Dict[str, Any],
                           world_state: Dict[str, Any],
                           dialogue_history: List[str]) -> List[Dict[str, Any]]:
        """为当前 Storylet 生成对话节拍序列"""
        if not self.llm_client:
            return []

        narrative_goal = storylet_content.get("narrative_goal", "")
        director_note = storylet_content.get("director_note", "")
        tone = storylet_content.get("tone", "neutral")

        # 只取最近 2 条对话（减少 token）
        recent_text = "\n".join(dialogue_history[-2:]) if dialogue_history else "(无)"
        tension = world_state.get("qualities", {}).get("tension", 0)

        # 完整版 system prompt（确保格式正确）
        system_msg = """你是互动叙事导演，为戏剧片段规划对话节拍（BeatPlan）。

核心规则：
1. 必须以 player_turn 结尾（等待玩家回应）
2. 节拍是"建议"，不是台词脚本
3. 每步服务叙事目标，推进剧情
4. 紧张时刻紧凑，轻松时刻舒缓

重要：intent 字段必须用第三人称描述，只写角色名字（trip/grace），禁止出现"你"字！

每个 beat 格式（JSON）：
{"speaker": "trip|grace|player_turn", "addressee": "player|grace|all", "intent": "叙事目的（第三人称，如'Trip 向 Grace 追问' 或 'Grace 观察玩家的反应'，禁止使用'你'字）", "urgency": "low|medium|high", "world_state_delta": {"tension": 1}, "state_change_hint": "气氛描述"}"""

        user_msg = f"""叙事目标：{narrative_goal}
场景：{director_note[:100] if director_note else '无'}
基调：{tone}
张力：{tension}
最近对话：{recent_text}

规划节拍："""

        try:
            messages = [
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ]
            raw = self.llm_client.chat_completion(messages, temperature=0.8, max_tokens=500)
            raw = raw.strip()

            import re
            # 尝试提取 JSON 数组
            if "```" in raw:
                # 尝试匹配 ```json ... ``` 块内的内容
                json_match = re.search(r'```json\s*(\[.*?\])\s*```', raw, re.DOTALL)
                if json_match:
                    raw = json_match.group(1)
                else:
                    # 尝试直接提取 JSON 数组
                    json_match = re.search(r'(\[.*\])', raw, re.DOTALL)
                    if json_match:
                        raw = json_match.group(1)
                    else:
                        # 尝试去除 markdown 代码块标记
                        raw = re.sub(r'```\w*\n?', '', raw).strip()

            beats = json.loads(raw)

            # 处理 LLM 返回 {"beats": [...]} 格式
            if isinstance(beats, dict) and "beats" in beats:
                beats = beats["beats"]

            if self.debug_mode:
                print(f"[Director] 原始 beats 数量: {len(beats)}")
                print(f"[Director] 原始响应前500字符: {raw[:500]}")
                if beats:
                    print(f"[Director] 第一个 beat 字段: {list(beats[0].keys()) if isinstance(beats[0], dict) else type(beats[0])}")
            valid_beats = self._parse_beats(beats)
            if self.debug_mode:
                print(f"[Director] 解析后 beats 数量: {len(valid_beats)}")
            valid_beats = self._validate_beat_plan(valid_beats)

            if self.debug_mode:
                print(f"\n[Director] 生成 BeatPlan ({len(valid_beats)} beats):")
                for i, b in enumerate(valid_beats):
                    addr = f" →{b['addressee']}" if b.get('addressee') else ""
                    delta_str = f" delta={b['world_state_delta']}" if b.get('world_state_delta') else ""
                    hint_str = f" hint=\"{b['state_change_hint']}\"" if b.get('state_change_hint') else ""
                    print(f"  Beat {i+1}: [{b['speaker']}{addr}] {b['intent']} (urgency={b['urgency']}){delta_str}{hint_str}")

            return valid_beats

        except json.JSONDecodeError:
            # JSON 解析失败，重试一次
            if self.debug_mode:
                print(f"[Director] JSON 解析失败，重试...")
            try:
                messages = [
                    {"role": "system", "content": system_msg + "\n\n重要：只输出 JSON 数组，不要任何其他文字。"},
                    {"role": "user", "content": user_msg},
                ]
                raw = self.llm_client.chat_completion(messages, temperature=0.8, max_tokens=500)
                raw = raw.strip()
                
                if self.debug_mode:
                    print(f"[Director] 重试响应: {raw[:500]}...")
                
                import re
                json_match = re.search(r'\[.*\]', raw, re.DOTALL)
                if json_match:
                    raw = json_match.group(0)
                
                beats = json.loads(raw)
                valid_beats = self._parse_beats(beats)
                
                if self.debug_mode:
                    print(f"[Director] 解析后 beats: {len(valid_beats)}/{len(beats)}")
                
                valid_beats = self._validate_beat_plan(valid_beats)
                return valid_beats
            except Exception as retry_err:
                if self.debug_mode:
                    print(f"[Director] 重试也失败（{retry_err}）")
                raise

    def _parse_beats(self, beats: list) -> list:
        """解析 beats 列表"""
        valid_beats = []
        for beat in beats:
            if isinstance(beat, dict) and "speaker" in beat and "intent" in beat:
                speaker = beat.get("speaker", "grace")
                addressee = beat.get("addressee", "")
                if not addressee:
                    if speaker == "player_turn":
                        addressee = "all"
                    elif speaker in ("trip", "grace"):
                        addressee = "player"
                valid_beats.append({
                    "speaker": speaker,
                    "addressee": addressee,
                    "intent": beat.get("intent", ""),
                    "player_can_interrupt": beat.get("player_can_interrupt", True),
                    "urgency": beat.get("urgency", "medium"),
                    "world_state_delta": beat.get("world_state_delta", {}),
                    "state_change_hint": beat.get("state_change_hint", ""),
                })
        return valid_beats

    def _validate_beat_plan(self, beats: List[Dict]) -> List[Dict]:
        """后处理校验 BeatPlan 质量"""
        if not beats:
            return beats

        valid_speakers = {"trip", "grace", "player_turn", "narrator"}
        valid_urgency = {"low", "medium", "high"}

        valid = []
        for b in beats:
            if b.get("speaker") not in valid_speakers:
                continue
            if not b.get("intent"):
                continue
            b["urgency"] = b.get("urgency", "medium")
            if b["urgency"] not in valid_urgency:
                b["urgency"] = "medium"
            b["speaker"] = b["speaker"].lower().strip()
            valid.append(b)

        if not valid:
            return valid

        result = [valid[0]]
        for b in valid[1:]:
            last_two = [r["speaker"] for r in result[-2:]]
            if len(last_two) == 2 and all(s == b["speaker"] for s in last_two) and b["speaker"] != "player_turn":
                other = "grace" if b["speaker"] == "trip" else "trip"
                result.append({
                    "speaker": other,
                    "addressee": b["speaker"],
                    "intent": "(自动插入) 听了对方的话，做出反应",
                    "player_can_interrupt": True,
                    "urgency": "medium",
                    "world_state_delta": {},
                    "state_change_hint": "",
                })
            result.append(b)

        char_beats_since_player = 0
        final = []
        for b in result:
            if b["speaker"] != "player_turn":
                char_beats_since_player += 1
            else:
                char_beats_since_player = 0
            final.append(b)
            if char_beats_since_player >= 5:
                final.append({
                    "speaker": "player_turn",
                    "addressee": "all",
                    "intent": "玩家自然介入点",
                    "player_can_interrupt": True,
                    "urgency": "medium",
                    "world_state_delta": {},
                    "state_change_hint": "",
                })
                char_beats_since_player = 0

        if final and final[0]["speaker"] == "player_turn":
            final.pop(0)

        if final and final[-1]["speaker"] != "player_turn":
            final.append({
                "speaker": "player_turn",
                "addressee": "all",
                "intent": "等待玩家回应",
                "player_can_interrupt": True,
                "urgency": "medium",
                "world_state_delta": {},
                "state_change_hint": "",
            })

        return final

    def generate_transition_beat_plan(self,
                                       old_storylet_title: str,
                                       new_storylet_title: str,
                                       old_narrative_goal: str,
                                       new_narrative_goal: str,
                                       world_state: Dict[str, Any],
                                       dialogue_history: List[str],
                                       is_landmark_switch: bool = False) -> List[Dict[str, Any]]:
        """生成场景衔接 beat 序列"""
        if not self.llm_client:
            return []

        tension = world_state.get("qualities", {}).get("tension", 0) if isinstance(world_state, dict) else 0
        recent_text = "\n".join(dialogue_history) if dialogue_history else "(无)"

        beat_count = "2~3" if is_landmark_switch else "1~2"
        narrator_note = "\n最后一个 beat 可以是 narrator 类型（系统旁白），用于描述环境变化。" if is_landmark_switch else ""

        system_msg = f"""你是一个互动叙事导演，场景正在过渡。

从「{old_storylet_title}」({old_narrative_goal[:50]}) 过渡到「{new_storylet_title}」({new_narrative_goal[:50]})。

请生成 {beat_count} 个衔接 beat，要求：
- 用角色的动作、表情、环境变化自然过渡，不硬切
- 承上启下：回应上一个场景的结尾情绪，引入下一个场景的氛围
{narrator_note}
- 最后一个 beat 的 speaker 设为 player_turn，让玩家适应新场景

每个 beat 额外携带 "transition_type"：
  - "atmosphere_shift"（氛围变化）
  - "topic_shift"（话题转移）
  - "action_bridge"（动作衔接）
  - "scene_setting"（环境叙事，仅 Landmark 切换）

只输出 JSON 数组。"""

        user_msg = f"""【当前张力值】{tension}

最近对话：
{recent_text}

请生成衔接节拍："""

        try:
            messages = [
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ]
            raw = self.llm_client.chat_completion(messages, temperature=0.7, max_tokens=500)
            raw = raw.strip()

            if "```" in raw:
                import re
                json_match = re.search(r'\[.*\]', raw, re.DOTALL)
                if json_match:
                    raw = json_match.group(0)

            beats = json.loads(raw)

            valid_beats = []
            for beat in beats:
                if isinstance(beat, dict) and "speaker" in beat and "intent" in beat:
                    speaker = beat.get("speaker", "trip")
                    addressee = beat.get("addressee", "")
                    if not addressee:
                        if speaker == "player_turn":
                            addressee = "all"
                        elif speaker in ("trip", "grace"):
                            addressee = "player"
                    valid_beats.append({
                        "speaker": speaker,
                        "addressee": addressee,
                        "intent": beat.get("intent", ""),
                        "player_can_interrupt": beat.get("player_can_interrupt", True),
                        "urgency": beat.get("urgency", "medium"),
                        "world_state_delta": beat.get("world_state_delta", {}),
                        "state_change_hint": beat.get("state_change_hint", ""),
                        "transition_type": beat.get("transition_type", "action_bridge"),
                        "content": beat.get("content", ""),
                    })

            if self.debug_mode:
                print(f"\n[Director] 生成衔接 BeatPlan ({len(valid_beats)} beats, landmark={is_landmark_switch}):")
                for i, b in enumerate(valid_beats):
                    print(f"  Beat {i+1}: [{b['speaker']}] {b['intent']} ({b.get('transition_type', '')})")

            return valid_beats

        except Exception as e:
            if self.debug_mode:
                print(f"[Director] 衔接 BeatPlan 生成失败（{e}），返回空计划")
            return []

    def get_progress_report(self) -> str:
        """获取进度报告"""
        return self.goal_tracker.get_progress_report()

    def reset(self):
        """重置 Director 状态"""
        self.goal_tracker = GoalTracker()
        self.instruction_history = []


def create_director(llm_client=None, debug_mode=False, scenario_config: Optional[ScenarioConfig] = None) -> DirectorAgent:
    """创建 Director Agent 的便捷函数"""
    director = DirectorAgent(llm_client, scenario_config)
    director.set_debug(debug_mode)
    return director