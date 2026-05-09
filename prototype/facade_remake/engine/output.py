"""输出工具 — 当前实现为 print()，未来替换为 WebSocket 推送"""
import sys
import re
from typing import Dict, Any, Optional, List


def game_banner():
    print("=" * 60)
    print("FacadeRemake 原型")
    print("基于 LLM + Storylet + BeatPlan 架构的互动叙事系统")
    print("=" * 60)
    print()
    print("情境：你受邀到老友 Trip 和 Grace 家中做客。")
    print("气氛似乎有些微妙...")
    print()
    print("输入 'quit' 退出，'status' 查看状态")
    print("-" * 60)
    print()


def character_speaking_hint(display_name: str):
    print(f"\n（{display_name} 似乎想说什么……）")


def _parse_action_sequence(actions: str) -> str:
    """将结构化动作序列转为可读中文描述

    格式示例：walk_to[living_room]gesture[come_here]say[]happy
    - 解析动作ID + 参数（如 walk_to[living_room]）
    - 识别表情（如 happy 在最后）
    """
    if not actions:
        return ""

    # 动作 ID 到中文的映射
    action_map = {
        "walk_to": "走向", "pick_up": "拿起", "put_down": "放下", "give": "递给",
        "look_at": "看向", "sit_down": "坐下", "stand_up": "站起来", "pour": "倒",
        "drink": "喝", "sigh": "叹气", "laugh": "笑", "pause": "停顿",
        "open_arm": "张开双臂", "gesture": "做手势", "exit": "离开", "wave": "挥手",
        "shake": "摇头", "nod": "点头", "touch": "触碰", "embrace": "拥抱",
        "push": "推开", "point": "指向", "lean": "倚靠",
    }

    # 表情 ID 到中文的映射
    expression_map = {
        "neutral": "（平静）", "happy": "（开心）", "sad": "（难过）",
        "angry": "（生气）", "thinking": "（思考）", "embarrassed": "（尴尬）",
        "smirk": "（坏笑）", "confused": "（困惑）", "nervous": "（紧张）",
        "smiling": "（微笑）", "laughing": "（大笑）", "frowning": "（皱眉）",
        "worried": "（担忧）",
    }

    # 地点 ID 到中文的映射
    location_map = {
        "living_room": "客厅", "kitchen": "厨房", "dining_room": "餐厅",
        "balcony": "阳台", "entrance": "门口", "sofa": "沙发", "window": "窗户",
    }

    # 物品 ID 到中文的映射
    prop_map = {
        "wine_glass": "酒杯", "bottle": "酒瓶", "plate": "盘子",
        "napkin": "餐巾", "cushion": "靠垫", "remote": "遥控器",
    }

    result_parts = []

    # 用正则匹配完整的动作格式: action[param]
    # 例如 "walk_to[living_room]" -> match ("walk_to", "living_room")
    pattern = r'([a-z_]+)\[([^\]]*)\]'
    matches = re.findall(pattern, actions.lower())

    # 检查是否有结尾的表情（不在方括号内）
    last_bracket_pos = actions.rfind(']')
    suffix = actions[last_bracket_pos + 1:].strip().lower() if last_bracket_pos >= 0 else actions.lower()

    for action_id, param in matches:
        # 检查是否是表情
        if action_id in expression_map:
            result_parts.append(expression_map[action_id])
            continue

        # 检查是否是已知动作
        if action_id not in action_map:
            continue

        action_desc = action_map[action_id]

        # 跳过 say[]（台词在 dialogue 字段）和 gesture[]（手势不显示）
        if action_id in ("say", "gesture"):
            continue

        param = param.strip().lower()
        param_is_target = False

        # 检查参数是否是目标（角色名）
        if param in ("player", "grace", "trip"):
            target_map = {"player": "玩家", "grace": "Grace", "trip": "Trip"}
            result_parts.append(f"给{target_map[param]}")
            param_is_target = True

        # 根据动作类型处理参数
        if not param_is_target:
            if action_id == "walk_to" and param in location_map:
                result_parts.append(f"{action_desc}{location_map[param]}")
            elif action_id in ("pick_up", "pour") and param in prop_map:
                result_parts.append(f"{action_desc}{prop_map[param]}")
            elif action_id == "look_at":
                # look_at 可以是地点或物品
                target = location_map.get(param, prop_map.get(param, param))
                result_parts.append(f"{action_desc}{target}")
            elif param:
                result_parts.append(f"{action_desc} {param}")
            else:
                result_parts.append(action_desc)

    # 检查结尾的表情（不在方括号内的内容）
    suffix = suffix.strip().lower()
    if suffix and suffix in expression_map:
        expr = expression_map[suffix]
        if expr not in result_parts:
            result_parts.append(expr)

    return "".join(result_parts)


def character_line(character: str, speech: str, action: str = "", thought: str = "", debug: bool = False):
    if thought and debug:
        print(f"\n  [thought] [{character} 内心] {thought}")
    if speech and action:
        print(f"\n{character}: {speech}")
        action_text = _parse_action_sequence(action)
        if action_text:
            print(f"  -> {action_text}")
    elif speech:
        print(f"\n{character}: {speech}")
    elif action:
        action_text = _parse_action_sequence(action)
        if action_text:
            print(f"\n{character}: {action_text}")
        else:
            print(f"\n{character}")


def waiting_for_player():
    print("\n（等待你说话……）")


def narrator_text(content: str):
    if content:
        print(f"\n{content}")


def state_change(delta: Dict[str, int], current_values: Dict[str, int], hint: str = ""):
    display_map = {"tension": "⚡ 张力", "grace_comfort": "💔 Grace 舒适度",
                   "trip_comfort": "💔 Trip 舒适度"}
    nonzero = {k: v for k, v in delta.items() if v != 0}
    if not nonzero and not hint:
        return
    parts = []
    for key, val in nonzero.items():
        label = display_map.get(key, key)
        sign = "+" if val > 0 else ""
        current = current_values.get(key, 0)
        parts.append(f"{label} {sign}{val}  (当前: {current}/10)")
    if parts:
        print()
        print("    " + "  ".join(parts))
        if hint:
            print(f"    ─────────────────────")
            print(f"    {hint}")
    elif hint:
        print(f"    {hint}")


def system_message(msg: str):
    print(f"\n[系统] {msg}")


def debug_message(msg: str):
    print(f"  {msg}")


def reading_delay_info(char_count: int, delay: float):
    print(f"  [阅读延迟] {char_count}字 → {delay:.1f}秒")


def nudge_message(display_name: str, text: str = "你怎么不说话了？"):
    print(f"\n{display_name}: {text}")


def storylet_entered(title: str, narrative_goal: str):
    print(f"\n{'='*60}")
    print(f"[进入新场景: {title}]")
    print(f"叙事目标: {narrative_goal}")
    print(f"{'='*60}")


def storylet_ended(title: str):
    print(f"\n[场景结束: {title}]")


def landmark_entered(title: str):
    print(f"\n[系统] 进入新阶段: {title}")


def ending(landmark_title: str, description: str, ending_content: str,
           total_turns: int, tension: int, trip_confessed: bool, grace_exposed: bool, player_mediated: bool):
    print(f"\n{'='*60}")
    print(f"🏁 结局: {landmark_title}")
    print(f"{'='*60}")
    print(f"\n{description}\n")
    if ending_content:
        print(ending_content.strip())
    print(f"\n{'='*60}")
    print(f"\n[游戏结束 - 总回合数: {total_turns}]")
    print(f"[tension 最终值: {tension}]")
    print(f"[坦白路径: trip={trip_confessed}, grace={grace_exposed}]")
    print(f"[玩家调解: {player_mediated}]")
    print(f"{'='*60}\n")


def show_status(current_turn, landmark_id, landmark_title, landmark_desc,
                storylet_title, narrative_goal, beat_index, beat_plan_len,
                storylet_turn_count, qualities, flags):
    print("\n" + "=" * 60)
    print("当前世界状态")
    print("=" * 60)
    print(f"回合: {current_turn}")
    print(f"当前 Landmark: {landmark_id}")
    if landmark_title:
        print(f"  └─ {landmark_title}: {landmark_desc}")
    print(f"当前 Storylet: {storylet_title}")
    if narrative_goal:
        print(f"  └─ 叙事目标: {narrative_goal}")
    print(f"BeatPlan: beat {beat_index + 1}/{beat_plan_len}")
    print(f"Storylet 已进行: {storylet_turn_count} 回合")
    print("-" * 60)
    print("数值:")
    for key, val in qualities.items():
        print(f"  {key}: {val}")
    print("-" * 60)
    print("标记:")
    for flag, value in flags.items():
        status = "Y" if value else "-"
        print(f"  [{status}] {flag}")
    print("=" * 60)


def player_input_prompt() -> str:
    return input("你: ").strip()


def player_silence():
    print("  （你选择了沉默）")


def game_interrupted():
    print("\n\n游戏被中断。")


def game_over():
    print("\n游戏结束。")


def input_rejected(reason: str):
    print(f"  [系统] 你的输入不被接受：{reason}")
