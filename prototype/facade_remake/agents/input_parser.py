"""
InputParser 模块 - v2.0 三层门控检测

    控制流：
        Gate1(合法性) ─[合法]─► Gate2(叙事目标判断)
                                      │
                        [不在目标内] ◄─┘ [在目标内]
                             │                │
                             ▼                ▼
                    (批量条件匹配         Gate3(GoalTracker
                     + 修改WorldState)        目标达成检测)

职责：
  - analyze_full(): 三层门控统一入口
  - validate_input(): Gate1 输入合法性
  - _is_input_in_narrative_goal(): Gate2 叙事目标判断
  - _collect_conditions_for_landmark(): 检索可匹配条件
  - _llm_match_conditions(): LLM 批量条件匹配
  - _assess_narrative_goal(): Gate3 GoalTracker 目标达成检测
"""
import re
import json
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field

from config.scenario_schema import ScenarioConfig


@dataclass
class InputAnalysisResult:
    """
    InputParser 三层检测的统一结果。
    """
    valid: bool
    severity: str = "soft"
    response_mode: Optional[str] = None
    reason: Optional[str] = None

    gate2_opened: bool = False
    is_in_narrative_goal: bool = True
    matched_ids: List[str] = field(default_factory=list)
    world_state_effects: List[Dict] = field(default_factory=list)

    gate3_opened: bool = False
    goal_assessment: str = ""
    should_apply_goal_effects: bool = False


class InputParser:
    """玩家输入检测与分析器 — v2.0 三层门控"""

    def __init__(self, llm_client=None,
                 scenario_config: Optional[ScenarioConfig] = None):
        self.llm_client = llm_client
        self.scenario_config = scenario_config

        self._storylet_manager = None
        self._goal_tracker = None

        self._meta_patterns = [
            re.compile(r"这是.*游戏", re.IGNORECASE),
            re.compile(r"你是.*AI", re.IGNORECASE),
            re.compile(r"你是.*程序", re.IGNORECASE),
            re.compile(r"你是.*机器人", re.IGNORECASE),
            re.compile(r"你是什么", re.IGNORECASE),
        ]
        self._build_violation_patterns()

    def inject_dependencies(self, storylet_manager=None, goal_tracker=None):
        """注入 v2.0 依赖"""
        if storylet_manager is not None:
            self._storylet_manager = storylet_manager
        if goal_tracker is not None:
            self._goal_tracker = goal_tracker

    def _build_violation_patterns(self):
        character_names = []
        if self.scenario_config and self.scenario_config.characters:
            character_names = [c.name for c in self.scenario_config.characters]
        name_pattern = "|".join(character_names) if character_names else "Trip|Grace|trip|grace"
        self._violation_patterns = [
            re.compile(r"砸|摔|打|砍|杀|枪|刀|炸弹|武器"),
            re.compile(r"跳窗|离开|逃跑|出去|滚"),
            re.compile(rf"(拥抱|亲吻|抱|亲)\s*({name_pattern})"),
        ]

    # ── Gate 1: 输入合法性 ────────────────────────────────────────

    def validate_input(self, player_input: str, context: Dict[str, Any] = None) -> Dict[str, Any]:
        """检查玩家输入是否合法"""
        if not player_input or not player_input.strip():
            return {"valid": True, "severity": "soft", "reason": None, "response_mode": None}

        rule_result = self._rule_check(player_input)
        if rule_result is not None:
            return rule_result

        return self._llm_validate(player_input, context or {})

    def _rule_check(self, text: str) -> Optional[Dict[str, Any]]:
        for pattern in self._meta_patterns:
            if pattern.search(text):
                return {"valid": True, "severity": "soft", "reason": "meta输入", "response_mode": "deflect"}
        for pattern in self._violation_patterns:
            if pattern.search(text):
                return {"valid": False, "severity": "hard", "reason": "违反场景约束", "response_mode": "ignore"}
        if len(text) > 200:
            return {"valid": True, "severity": "soft", "reason": "输入过长", "response_mode": "confused"}
        return None

    def _llm_validate(self, player_input: str, context: Dict[str, Any]) -> Dict[str, Any]:
        if not self.llm_client:
            return {"valid": True, "severity": "soft", "reason": None, "response_mode": None}

        situation = context.get("situation", "")
        storylet_title = context.get("storylet_title", "")
        narrative_goal = context.get("narrative_goal", "")

        constraints = self.scenario_config.scene_constraints if self.scenario_config else None
        constraint_text = ""
        if constraints:
            constraint_text = (
                f"场景约束：{constraints.location_description}。"
                f"玩家{'可以' if constraints.can_leave_location else '不能'}离开场景。"
                f"禁止行为：{', '.join(constraints.forbidden_actions)}。"
            )

        prompt = f"""你是一个互动戏剧系统的输入验证器。

当前场景：{situation}
当前剧情段落：{storylet_title}
当前叙事目标：{narrative_goal}
{constraint_text}

玩家输入："{player_input}"

请结合当前叙事上下文，判断这段输入是否可以接受。
返回 JSON：{{"valid": true/false, "reason": "简短原因", "severity": "soft或hard"}}
只返回 JSON。"""

        try:
            response = self.llm_client.call_llm(prompt, max_tokens=50, temperature=0.0, debug_tag='InputParser/Gate1')
            cleaned = response.strip()
            if cleaned.startswith("```"):
                lines = cleaned.split("\n")
                cleaned = "\n".join(lines[1:-1]) if len(lines) > 2 else cleaned
            result = json.loads(cleaned)

            valid = result.get("valid", True)
            severity = result.get("severity", "soft")
            response_mode = None
            if not valid and severity == "hard":
                response_mode = "ignore"
            elif severity == "hard":
                response_mode = "confused"

            return {"valid": valid, "severity": severity, "reason": result.get("reason", ""), "response_mode": response_mode}
        except Exception as e:
            print(f"[InputParser] LLM validate 失败（{e}），放行")
            return {"valid": True, "severity": "soft", "reason": None, "response_mode": None}

    # ── 三层门控统一入口 ──────────────────────────────────────────

    def analyze_full(self,
                     player_input: str,
                     current_landmark,
                     current_storylet,
                     conversation_history: List[str]) -> InputAnalysisResult:
        """
        三层门控检测的统一入口。

        控制流（串联，前层阻断则不进入后层）：
            Gate1 ─[合法]─► Gate2 ─[不在目标内]─► 批量条件匹配
                                    ─[在目标内]──► Gate3(GoalTracker)
        """
        # ── Gate 1 ──
        gate1_result = self.validate_input(player_input, context={
            "situation": current_landmark.description if current_landmark else "",
            "storylet_title": current_storylet.title if current_storylet else "",
            "narrative_goal": current_storylet.narrative_goal if current_storylet else ""
        })

        if not gate1_result.get("valid") and gate1_result.get("severity") == "hard":
            return InputAnalysisResult(
                valid=False, severity="hard", response_mode="ignore",
                reason=gate1_result.get("reason"),
            )

        # ── Gate 2 ──
        is_in_goal = self._is_input_in_narrative_goal(
            player_input, current_storylet, conversation_history
        )
        result = InputAnalysisResult(valid=True, gate2_opened=True, is_in_narrative_goal=is_in_goal)

        if not is_in_goal:
            conditions = self._collect_conditions_for_landmark(current_landmark)
            gate2_result = self._llm_match_conditions(
                player_input, conditions, current_landmark, conversation_history
            )
            result.matched_ids = gate2_result.get("matched_ids", [])
            result.world_state_effects = gate2_result.get("effects", [])
            return result

        # ── Gate 3 ──
        goal_assessment = self._assess_narrative_goal(
            player_input, current_storylet, conversation_history
        )
        result.gate3_opened = True
        result.goal_assessment = goal_assessment["status"]
        result.should_apply_goal_effects = (goal_assessment["status"] == "complete")
        return result

    # ── Gate 2 内部实现 ───────────────────────────────────────────

    def _is_input_in_narrative_goal(self, player_input: str, current_storylet,
                                     conversation_history: List[str]) -> bool:
        """LLM 检测为必须项，失败直接报错。"""
        if not current_storylet.narrative_goal:
            raise ValueError(
                f"当前 Storylet[{current_storylet.id}] 缺少 narrative_goal，无法进行 Gate2 叙事目标判断"
            )
        return self._llm_judge_goal_relevance(
            player_input, current_storylet.narrative_goal, conversation_history
        )

    def _llm_judge_goal_relevance(self, player_input: str, narrative_goal: str,
                                   conversation_history: List[str]) -> bool:
        recent = "\n".join(conversation_history[-7:]) if conversation_history else "(无)"
        prompt = f"""你是叙事相关度判断器。

当前叙事目标：{narrative_goal}
最近对话：
{recent}
玩家最新输入：「{player_input}」

判断：玩家这段输入是否在「当前叙事目标」的推进范围内？
- 回答 YES：输入与目标直接/间接相关
- 回答 NO：输入偏离了当前叙事目标

只回答 YES 或 NO："""

        try:
            response = self.llm_client.call_llm(prompt, max_tokens=5, temperature=0.0, debug_tag='InputParser/Gate2/Goal')
            resp = response.strip().upper()
            if "YES" not in resp and "NO" not in resp:
                raise ValueError(f"非预期结果: {resp}")
            return "YES" in resp
        except Exception as e:
            raise RuntimeError(f"Gate2 叙事目标判断 LLM 调用失败: {e}") from e

    def _collect_conditions_for_landmark(self, landmark) -> List[Dict]:
        """检索当前 Landmark 下所有可匹配条件。返回：[{"id","desc","effect"}, ...]"""
        collected = []
        if not landmark or not self._storylet_manager:
            return collected

        for storylet in self._storylet_manager.get_storylets_by_landmark(landmark.id):
            for cond in storylet.conditions:
                cid = cond.get("id", "")
                if cid:
                    collected.append({"id": cid, "desc": cond.get("desc", storylet.title), "effect": cond.get("effect", {})})

        for transition in landmark.transitions:
            for cond in transition.conditions:
                cid = cond.get("id", "")
                if cid:
                    collected.append({"id": cid, "desc": cond.get("desc", f"Landmark 转场: {cid}"), "effect": cond.get("effect", {})})

        return collected

    def _llm_match_conditions(self, player_input: str, conditions: List[Dict],
                               landmark, conversation_history: List[str]) -> Dict:
        if not conditions:
            return {"has_match": False, "matched_ids": [], "effects": []}

        cond_lines = [f"  {i}. [{c['id']}] {c['desc']}" for i, c in enumerate(conditions)]
        recent = "\n".join(conversation_history[-10:]) if conversation_history else "(无)"

        prompt = f"""你是叙事条件判断器。

当前叙事阶段：{landmark.title if landmark else '未知'}
场景：{landmark.description if landmark else ''}
最近对话：
{recent}
玩家最新输入：「{player_input}」

请判断玩家输入触发了以下哪些条件？

条件列表：
{chr(10).join(cond_lines)}

返回 JSON：{{"matched": [编号列表], "reason": "简短说明"}}
只返回 JSON。"""

        try:
            response = self.llm_client.call_llm(prompt, max_tokens=80, temperature=0.0, debug_tag='InputParser/Gate2/Match')
            result = json.loads(response.strip())
            indices = result.get("matched", [])
            matched_ids, all_effects = [], []

            for idx in indices:
                if isinstance(idx, int) and 0 <= idx < len(conditions):
                    c = conditions[idx]
                    matched_ids.append(c["id"])
                    if c.get("effect"):
                        all_effects.append(c["effect"])

            return {"has_match": len(matched_ids) > 0, "matched_ids": matched_ids, "effects": all_effects}
        except Exception as e:
            raise RuntimeError(f"[InputParser] Gate2 条件匹配 LLM 调用失败: {e}") from e

    # ── Gate 3 内部实现 (GoalTracker) ─────────────────────────────

    def _assess_narrative_goal(self, player_input: str, current_storylet,
                                conversation_history: List[str]) -> Dict:
        if not current_storylet or not current_storylet.narrative_goal:
            return {"status": "in_progress"}

        if self._goal_tracker:
            from .director import GoalStatus
            status, reason = self._goal_tracker.check_completion(
                world_state={},
                dialogue_history=conversation_history,
                llm_client=self.llm_client
            )
            return {"status": "complete" if status == GoalStatus.COMPLETE else "in_progress", "reason": reason}

        return {"status": "in_progress", "reason": "GoalTracker 未绑定"}
