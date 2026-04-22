"""
角色叙事行为库（Character Behavior Library）

设计参考：StoryVerse 4.4 Story Domain 的 Action Schema 设计。
核心思想：将角色的"可执行行为模式"显式定义为有限集合，
让 LLM 先从库中选择一个行为，再据此生成具体台词。

好处：
1. 约束 LLM 自由发挥，使角色行为符合叙事设计意图
2. 行为选择本身成为可观测的中间层（调试/分析）
3. Storylet 可以通过 allowed_behaviors 字段约束当前场景可用的行为
4. 为论文的"可控性"章节提供具体论据
"""

from typing import Dict, List


# ─────────────────────────────────────────────
# 行为元数据结构
# ─────────────────────────────────────────────
# 每条行为包含：
#   id          : 行为标识符
#   label       : 简短中文标签（供 LLM prompt 展示）
#   description : 对 LLM 的行为说明（怎么演绎这个行为）
#   tone_hint   : 默认情绪基调
#   salience_boost : 当该行为被选中时，对 storylet salience 的额外加成（用于统计）

BEHAVIOR_META: Dict[str, Dict] = {
    # ── 通用行为（Trip 和 Grace 均可用）──────────────────
    "deflect": {
        "label": "转移话题",
        "description": "用另一个话题、问题或行为来打断当前话题，但不算强硬回避——更像是下意识的转向。",
        "tone_hint": "guarded",
        "salience_boost": 0,
    },
    "go_quiet": {
        "label": "沉默",
        "description": "不说话，用沉默、停顿或轻微的肢体动作回应。可以只输出一句括号内的动作描述。",
        "tone_hint": "heavy",
        "salience_boost": 1,
    },
    "make_excuse": {
        "label": "找借口",
        "description": "给出一个听起来合理但实际上是托词的解释，语气自然，不像是在撒谎，更像习惯性逃避。",
        "tone_hint": "flat",
        "salience_boost": 0,
    },
    "ask_player": {
        "label": "求助/询问玩家",
        "description": "将话头转给老友，询问他的意见、感受或经历，有时是真心求助，有时是转移焦点。",
        "tone_hint": "open",
        "salience_boost": 2,
    },
    "surface_normal": {
        "label": "维持表面正常",
        "description": "说一些完全正常的寒暄话，表现得一切如常，但细节里藏着微妙的不自然。",
        "tone_hint": "neutral",
        "salience_boost": 0,
    },
    "subtle_hint": {
        "label": "话里有话",
        "description": "说的是一件事，但言外之意指向别的什么。语气平静，让人听后要回味才能察觉。",
        "tone_hint": "loaded",
        "salience_boost": 2,
    },

    # ── Trip 专用行为 ───────────────────────────
    "admit": {
        "label": "承认真相",
        "description": "说出一部分或全部真相。不是慷慨激昂的坦白，更像是憋不住了、或者被逼得没有退路了才说。",
        "tone_hint": "heavy",
        "salience_boost": 5,
    },
    "get_angry": {
        "label": "情绪爆发",
        "description": "用强硬甚至愤怒的语气回击，但这份怒气里有一部分是针对自己的。可以摔杯子、抬高声音或转身。",
        "tone_hint": "volatile",
        "salience_boost": 3,
    },
    "apologize": {
        "label": "道歉",
        "description": "说出迟来的抱歉。Trip 不擅长软话，所以这个道歉可能显得笨拙、不完整，但是真诚的。",
        "tone_hint": "heavy",
        "salience_boost": 5,
    },
    "shut_down": {
        "label": "彻底关闭",
        "description": "拒绝继续对话，用行动（离开、看手机、假装忙）切断交流，但身体语言出卖了他的焦虑。",
        "tone_hint": "cold",
        "salience_boost": 1,
    },

    # ── Grace 专用行为 ───────────────────────────
    "cold_truth": {
        "label": "冷静说出真相",
        "description": "用非常平静、几乎没有情绪的语气说出一个可以切开空气的真相。这比大喊大叫更有压迫感。",
        "tone_hint": "ice",
        "salience_boost": 5,
    },
    "care_through_action": {
        "label": "用行动表达关心",
        "description": "不说话，但通过给老友倒酒、递毯子或整理靠垫等动作表达情感，情绪藏在动作里。",
        "tone_hint": "warm",
        "salience_boost": 1,
    },
    "controlled_sarcasm": {
        "label": "克制的讽刺",
        "description": "用语气或措辞表达不满，但保持表面的礼貌。讽刺是长期压抑的怒气渗出来的方式。",
        "tone_hint": "sharp",
        "salience_boost": 2,
    },
    "withdraw": {
        "label": "情感撤退",
        "description": "表面上继续做事（整理画、调酒），实际上已经从对话中退出，只剩下躯壳在场。",
        "tone_hint": "distant",
        "salience_boost": 1,
    },
    "break_down": {
        "label": "情绪崩溃",
        "description": "长时间的压抑终于破防。不是大哭，更像是声音突然变小、眼睛红了、或者放下了酒杯说不下去。",
        "tone_hint": "raw",
        "salience_boost": 4,
    },
}


# ─────────────────────────────────────────────
# 各角色的可用行为集合
# ─────────────────────────────────────────────

TRIP_BEHAVIORS: List[str] = [
    "deflect",
    "make_excuse",
    "get_angry",
    "go_quiet",
    "ask_player",
    "surface_normal",
    "subtle_hint",
    "admit",
    "apologize",
    "shut_down",
]

GRACE_BEHAVIORS: List[str] = [
    "deflect",
    "go_quiet",
    "ask_player",
    "surface_normal",
    "subtle_hint",
    "cold_truth",
    "care_through_action",
    "controlled_sarcasm",
    "withdraw",
    "break_down",
]

CHARACTER_BEHAVIORS: Dict[str, List[str]] = {
    "trip": TRIP_BEHAVIORS,
    "grace": GRACE_BEHAVIORS,
}


# ─────────────────────────────────────────────
# 工具函数
# ─────────────────────────────────────────────

def get_behavior_prompt_list(character: str, allowed: List[str] = None) -> str:
    """
    生成供 LLM 阅读的行为选项文本。

    Args:
        character: "trip" 或 "grace"
        allowed: 可选的行为白名单（来自 Storylet.allowed_behaviors）。
                 None 表示全部可用。

    Returns:
        形如：
          1. deflect（转移话题）：用另一个话题...
          2. go_quiet（沉默）：不说话...
        的字符串
    """
    behaviors = CHARACTER_BEHAVIORS.get(character, TRIP_BEHAVIORS)
    if allowed:
        behaviors = [b for b in behaviors if b in allowed]

    lines = []
    for i, bid in enumerate(behaviors, 1):
        meta = BEHAVIOR_META.get(bid, {})
        label = meta.get("label", bid)
        desc = meta.get("description", "")
        lines.append(f"{i}. {bid}（{label}）：{desc}")

    return "\n".join(lines)


def get_behavior_meta(behavior_id: str) -> Dict:
    """获取行为的元数据"""
    return BEHAVIOR_META.get(behavior_id, {})


def parse_behavior_from_response(response: str, character: str) -> str:
    """
    从 LLM 返回的行为选择文本中解析出行为 ID。
    LLM 被要求只返回行为 ID（如 "deflect"），
    此函数做宽松解析：在回复中找到第一个已知行为 ID 即返回。

    Returns:
        行为 ID 字符串，解析失败时返回 "surface_normal"（最安全的兜底）
    """
    behaviors = CHARACTER_BEHAVIORS.get(character, TRIP_BEHAVIORS)
    response_lower = response.lower().strip()

    # 优先精确匹配
    if response_lower in behaviors:
        return response_lower

    # 宽松匹配：在回复中找到第一个已知行为 ID
    for bid in behaviors:
        if bid in response_lower:
            return bid

    # 兜底
    return "surface_normal"
