"""
InputParser 模块 — 玩家输入分析与语义匹配

职责：
  1. validate_input(): 检测非法/破坏叙事的输入
  2. analyze(): 合法性检查 + 语义条件匹配（合并为一次 LLM 调用）

SemanticConditionStore:
  语义条件索引接口。当前实现为全量列表存储；
  未来可替换为向量检索实现，上层代码无需改动。
"""
import re
import json
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field

from config.scenario_schema import ScenarioConfig


@dataclass
class SemanticCondition:
    """一条语义条件"""
    id: str                    # 唯一标识，如 "sl_push_trip" 或 "lm2→lm3a"
    source_type: str           # "storylet" | "landmark_transition"
    description: str           # 自然语言描述（用于 LLM 判断 / embedding）
    metadata: Dict[str, Any] = field(default_factory=dict)


class SemanticConditionStore:
    """语义条件索引。

    当前实现：全量列表存储，search() 返回全部。
    未来实现：替换 search() 为向量检索（cosine similarity top-k），
              上层 InputParser 无需改动。
    """

    def __init__(self):
        self._conditions: Dict[str, SemanticCondition] = {}

    def add(self, condition: SemanticCondition):
        """注册一条语义条件"""
        self._conditions[condition.id] = condition

    def add_many(self, conditions: List[SemanticCondition]):
        """批量注册"""
        for c in conditions:
            self._conditions[c.id] = c

    def remove(self, condition_id: str):
        """移除一条条件"""
        self._conditions.pop(condition_id, None)

    def remove_by_prefix(self, prefix: str):
        """按前缀批量移除（Landmark 切换时清除旧阶段条件）"""
        to_remove = [cid for cid in self._conditions if cid.startswith(prefix)]
        for cid in to_remove:
            del self._conditions[cid]

    def get_all(self) -> List[SemanticCondition]:
        """返回全部条件（简单实现）"""
        return list(self._conditions.values())

    def search(self, query: str, top_k: int = 5) -> List[SemanticCondition]:
        """根据查询检索相关条件。

        当前实现：返回全部。
        未来实现：embedding cosine similarity → top_k。
        """
        return self.get_all()

    def clear(self):
        self._conditions.clear()


class InputParser:
    """玩家输入检测与分析器。

    职责：
      - validate_input(): 规则快速过滤 + LLM 语义判断输入合法性
      - analyze(): 合并合法性检查与语义条件匹配，一次 LLM 调用

    不再做结构化意图分类（intent/target/topic_tags），
    因为 CharacterAgent 和 Director 会自行理解玩家原文。
    """

    def __init__(self, llm_client=None, condition_store: SemanticConditionStore = None,
                 scenario_config: Optional[ScenarioConfig] = None):
        self.llm_client = llm_client
        self.condition_store = condition_store
        self.scenario_config = scenario_config

        self._meta_patterns = [
            re.compile(r"这是.*游戏", re.IGNORECASE),
            re.compile(r"你是.*AI", re.IGNORECASE),
            re.compile(r"你是.*程序", re.IGNORECASE),
            re.compile(r"你是.*机器人", re.IGNORECASE),
            re.compile(r"你是什么", re.IGNORECASE),
        ]
        
        self._build_violation_patterns()

    def _build_violation_patterns(self):
        """根据配置动态构建违规正则"""
        character_names = []
        if self.scenario_config and self.scenario_config.characters:
            character_names = [c.name for c in self.scenario_config.characters]
        
        name_pattern = "|".join(character_names) if character_names else "Trip|Grace|trip|grace|特拉维斯|格蕾丝"
        
        self._violation_patterns = [
            re.compile(r"砸|摔|打|砍|杀|枪|刀|炸弹|武器"),
            re.compile(r"跳窗|离开|逃跑|出去|滚"),
            re.compile(rf"(拥抱|亲吻|抱|亲)\s*({name_pattern})"),
        ]

    def validate_input(self, player_input: str, context: Dict[str, Any] = None) -> Dict[str, Any]:
        """检查玩家输入是否合法。

        返回：
            {
                "valid": bool,
                "severity": "soft" | "hard",   # soft: 角色困惑反应; hard: 忽略输入
                "reason": str | None,
                "response_mode": "confused" | "deflect" | "ignore" | None,
            }
        """
        if not player_input or not player_input.strip():
            return {"valid": True, "severity": "soft", "reason": None, "response_mode": None}

        rule_result = self._rule_check(player_input)
        if rule_result is not None:
            return rule_result

        return self._llm_validate(player_input, context or {})

    def _rule_check(self, text: str) -> Optional[Dict[str, Any]]:
        """规则层快速过滤。返回 None 表示规则层无法判断。"""
        for pattern in self._meta_patterns:
            if pattern.search(text):
                return {
                    "valid": True,
                    "severity": "soft",
                    "reason": "meta输入",
                    "response_mode": "deflect",
                }

        for pattern in self._violation_patterns:
            if pattern.search(text):
                return {
                    "valid": False,
                    "severity": "hard",
                    "reason": "违反场景约束",
                    "response_mode": "ignore",
                }

        if len(text) > 200:
            return {
                "valid": True,
                "severity": "soft",
                "reason": "输入过长",
                "response_mode": "confused",
            }

        return None

    def _llm_validate(self, player_input: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """LLM 语义合法性判断"""
        if not self.llm_client:
            return {"valid": True, "severity": "soft", "reason": None, "response_mode": None}

        situation = context.get("situation", "老友做客，气氛微妙")
        storylet_title = context.get("storylet_title", "")

        constraints = self.scenario_config.scene_constraints if self.scenario_config else None
        
        if constraints:
            location_desc = constraints.location_description
            can_leave = "可以" if constraints.can_leave_location else "不能"
            allowed_props_text = "可以使用任何物品" if not constraints.allowed_props else f"只能使用：{constraints.allowed_props}"
            forbidden_actions_text = ", ".join(constraints.forbidden_actions)
        else:
            location_desc = "公寓客厅，三个大学好友（Trip、Grace、玩家）在做客聊天"
            can_leave = "不能"
            allowed_props_text = "可以使用任何物品"
            forbidden_actions_text = "离开、暴力、不合理的亲密行为"

        prompt = f"""你是一个互动戏剧系统的输入验证器。

当前场景：{situation}
当前剧情段落：{storylet_title}
场景约束：{location_desc}
  - 玩家{can_leave}离开场景
  - 玩家{allowed_props_text}
  - 禁止行为：{forbidden_actions_text}
  - 玩家不应该暴露"这是游戏/AI"等 meta 信息

玩家输入："{player_input}"

请判断输入是否可以接受。

返回 JSON：
{{"valid": true/false, "reason": "简短原因", "severity": "soft或hard"}}
- valid=true, severity="soft" → 完全合法
- valid=true, severity="hard" → 输入很奇怪但角色可以困惑地反应
- valid=false, severity="hard" → 完全不可接受，应忽略

只返回 JSON，不要其他内容。"""

        try:
            response = self.llm_client.call_llm(prompt, max_tokens=50, temperature=0.0)
            cleaned = response.strip()
            if cleaned.startswith("```"):
                lines = cleaned.split("\n")
                cleaned = "\n".join(lines[1:-1]) if len(lines) > 2 else cleaned
            result = json.loads(cleaned)

            valid = result.get("valid", True)
            severity = result.get("severity", "soft")
            reason = result.get("reason", "")

            if not valid and severity == "hard":
                response_mode = "ignore"
            elif severity == "hard":
                response_mode = "confused"
            else:
                response_mode = None

            print(f"[InputParser] validate: valid={valid}, severity={severity}, reason={reason}")
            return {
                "valid": valid,
                "severity": severity,
                "reason": reason,
                "response_mode": response_mode,
            }
        except Exception as e:
            print(f"[InputParser] LLM validate 失败（{e}），放行")
            return {"valid": True, "severity": "soft", "reason": None, "response_mode": None}

    def analyze(self,
                player_input: str,
                conditions: List[SemanticCondition],
                context: Dict[str, Any] = None) -> Dict[str, Any]:
        """统一分析入口：一次 LLM 调用完成合法性检查 + 语义条件匹配。

        Args:
            player_input: 玩家输入文本
            conditions: 已剪枝的语义条件列表（通常只有当前阶段的，2~15 条）
            context: 当前场景上下文

        Returns:
            {
                "valid": bool,
                "severity": "soft" | "hard",
                "reason": str | None,
                "response_mode": str | None,
                "matched_conditions": List[str],  # 命中的条件 id 列表
            }
        """
        if not conditions:
            val = self.validate_input(player_input, context)
            val["matched_conditions"] = []
            return val

        rule_result = self._rule_check(player_input)
        if rule_result is not None and rule_result.get("valid") is False:
            rule_result["matched_conditions"] = []
            return rule_result

        return self._llm_analyze(player_input, conditions, context or {})

    def _llm_analyze(self,
                     player_input: str,
                     conditions: List[SemanticCondition],
                     context: Dict[str, Any]) -> Dict[str, Any]:
        """一次 LLM 调用完成合法性和语义匹配"""

        if self.condition_store and len(conditions) > 10:
            narrowed = self.condition_store.search(player_input, top_k=8)
            narrowed_ids = {c.id for c in narrowed}
            conditions = [c for c in conditions if c.id in narrowed_ids]
            print(f"[InputParser] 条件预筛选：{len(conditions)} 条（原始 {len(narrowed_ids)} 条）")

        if not self.llm_client:
            return {
                "valid": True,
                "severity": "soft",
                "reason": None,
                "response_mode": None,
                "matched_conditions": [c.id for c in conditions],
            }

        situation = context.get("situation", "老友做客，气氛微妙")
        storylet_title = context.get("storylet_title", "")

        constraints = self.scenario_config.scene_constraints if self.scenario_config else None
        location_desc = constraints.location_description if constraints else "公寓客厅，三个大学好友做客聊天"
        can_leave = "可以" if (constraints and constraints.can_leave_location) else "不能"

        cond_lines = []
        for i, cond in enumerate(conditions):
            source_label = "剧情" if cond.source_type == "storylet" else "转场"
            cond_lines.append(f"  {i}. [{cond.id}] ({source_label}) {cond.description}")

        cond_text = "\n".join(cond_lines)

        prompt = f"""你是一个互动戏剧系统的输入分析器。

当前场景：{situation}
当前剧情段落：{storylet_title}
场景约束：{location_desc}。玩家{can_leave}离开公寓、不能使用暴力。

玩家输入："{player_input}"

请完成两个任务：

任务1 - 合法性判断：这段输入是否可以接受？
  - 如果输入违反场景约束或完全脱离语境，valid=false
  - 如果输入有点奇怪但角色可以反应，valid=true, severity="soft"

任务2 - 语义匹配：玩家的输入匹配以下哪些条件？只返回编号。

条件列表：
{cond_text}

返回 JSON：
{{"valid": true/false, "reason": "简短原因", "severity": "soft或hard", "matched": [编号列表]}}

只返回 JSON，不要其他内容。"""

        try:
            response = self.llm_client.call_llm(prompt, max_tokens=80, temperature=0.0)
            cleaned = response.strip()
            if cleaned.startswith("```"):
                lines = cleaned.split("\n")
                cleaned = "\n".join(lines[1:-1]) if len(lines) > 2 else cleaned
            result = json.loads(cleaned)

            valid = result.get("valid", True)
            severity = result.get("severity", "soft")
            reason = result.get("reason", "")
            matched_indices = result.get("matched", [])

            if not valid and severity == "hard":
                response_mode = "ignore"
            elif severity == "hard":
                response_mode = "confused"
            else:
                response_mode = None

            matched_ids = []
            for idx in matched_indices:
                if isinstance(idx, int) and 0 <= idx < len(conditions):
                    matched_ids.append(conditions[idx].id)
                elif isinstance(idx, (int, float)):
                    i = int(idx) - 1
                    if 0 <= i < len(conditions):
                        matched_ids.append(conditions[i].id)

            print(f"[InputParser] analyze: valid={valid}, matched={[c.id for c in conditions if c.id in matched_ids]}")
            return {
                "valid": valid,
                "severity": severity,
                "reason": reason,
                "response_mode": response_mode,
                "matched_conditions": matched_ids,
            }
        except Exception as e:
            print(f"[InputParser] LLM analyze 失败（{e}），放行 + 不过滤")
            return {
                "valid": True,
                "severity": "soft",
                "reason": None,
                "response_mode": None,
                "matched_conditions": [],
            }