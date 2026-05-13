"""
GameLogWriter 模块 - v2.0 游戏日志生成器

职责：
  - 在 Storylet/Landmark 切换时，根据历史对话生成旧 Storylet 的完成总结
  - 推送前端右栏展示

触发时机（严格遵守）：
  ✓ Storylet 切换时 → 生成旧 Storylet 完成日志
  ✓ Landmark 切换时 → 生成阶段切换日志
  ✗ 玩家在当前 Storylet 内多轮对话 → 不更新日志
"""
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class GameLogEntry:
    """单条游戏日志条目（面向玩家展示）"""
    title: str
    completion_status: str  # "completed" | "landmark_switch"
    summary: str
    turn: int
    storylet_id: str = ""
    snapshot: Optional[Dict[str, Any]] = None
    timestamp: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().isoformat()


class GameLogWriter:
    """生成面向玩家的叙事摘要"""

    def __init__(self, llm_client=None):
        self.llm_client = llm_client
        self._log_entries: List[GameLogEntry] = []

    def generate_on_storylet_switch(self,
                                     old_storylet,
                                     turn: int,
                                     conversation_history: List[str],
                                     is_landmark_switch: bool = False) -> GameLogEntry:
        """生成 Storylet 切换时的日志（旧 Storylet 完成状况）"""
        status = "landmark_switch" if is_landmark_switch else "completed"
        title = old_storylet.title

        summary = self._llm_generate_summary(
            storylet_title=title,
            narrative_goal=old_storylet.narrative_goal,
            status=status,
            conversation_history=conversation_history
        )

        entry = GameLogEntry(
            title=title,
            completion_status=status,
            summary=summary,
            turn=turn,
            storylet_id=old_storylet.id
        )
        self._log_entries.append(entry)
        return entry

    def generate_on_landmark_switch(self,
                                     old_landmark_title: str,
                                     new_landmark_title: str,
                                     turn: int) -> GameLogEntry:
        """生成 Landmark 切换时的日志"""
        entry = GameLogEntry(
            title=f"阶段切换: {old_landmark_title} → {new_landmark_title}",
            completion_status="landmark_switch",
            summary=f"叙事阶段从「{old_landmark_title}」推进至「{new_landmark_title}」",
            turn=turn
        )
        self._log_entries.append(entry)
        return entry

    def _llm_generate_summary(self,
                               storylet_title: str,
                               narrative_goal: str,
                               status: str,
                               conversation_history: List[str]) -> str:
        """LLM 根据历史对话生成 50 字以内的叙事摘要"""
        if not self.llm_client:
            return f"{storylet_title} 已结束"

        status_desc = {
            "completed": "顺利完成",
            "landmark_switch": "因阶段切换而结束"
        }.get(status, "已结束")

        recent = "\n".join(conversation_history[-10:]) if conversation_history else "(无)"

        prompt = f"""你是一个叙事摘要生成器。

请用 30~50 字概括以下叙事段落的结果：

段落：「{storylet_title}」
叙事目标：{narrative_goal}
状态：{status_desc}

最近对话：
{recent}

要求：
- 面向普通玩家，语言简洁
- 描述关键事件或角色反应，像游戏日志
- 不要使用游戏术语

只返回摘要文字，不要其他内容。"""

        try:
            response = self.llm_client.call_llm(prompt, max_tokens=60, temperature=0.3)
            return response.strip()[:50]
        except Exception:
            return f"{storylet_title} {status_desc}"

    def get_recent_entries(self, limit: int = 8) -> List[GameLogEntry]:
        """获取最近的日志条目"""
        return self._log_entries[-limit:]

    def to_dict_list(self) -> List[Dict]:
        """序列化为字典列表（供 JSON 序列化）"""
        return [
            {
                "title": e.title,
                "completion_status": e.completion_status,
                "summary": e.summary,
                "turn": e.turn,
                "storylet_id": e.storylet_id,
                "timestamp": e.timestamp
            }
            for e in self._log_entries
        ]
