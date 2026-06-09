"""输出工具 v2.0 — CLI 格式化打印，无硬编码场景数据

  所有标签/名称从 scenario_config 读取，通过 init_labels() 初始化。
  若未初始化则使用默认空映射（key→key）。
"""
import re
from typing import Dict, Any, List, Optional

# ── 由 init_labels() 填充的映射表 ────────────────────────────────────
_action_labels: Dict[str, str] = {}
_expression_labels: Dict[str, str] = {}
_location_labels: Dict[str, str] = {}
_prop_labels: Dict[str, str] = {}
_character_labels: Dict[str, str] = {}
_quality_labels: Dict[str, str] = {}


def init_labels(config: Optional[Any] = None):
    """从 scenario_config 初始化所有标签映射。

    调用时机: 引擎启动后、CLI 循环进入前。
    若 config 为 None 则清空所有映射（回退到 key→key 显示）。
    """
    global _action_labels, _expression_labels, _location_labels
    global _prop_labels, _character_labels, _quality_labels

    if config is None:
        _action_labels = {}
        _expression_labels = {}
        _location_labels = {}
        _prop_labels = {}
        _character_labels = {}
        _quality_labels = {}
        return

    _action_labels = {a.id: getattr(a, 'label', a.id) for a in getattr(config, 'action_library', [])}
    _expression_labels = {e.id: getattr(e, 'label', e.id) for e in getattr(config, 'expression_library', [])}
    _location_labels = {l.id: getattr(l, 'label', l.id) for l in getattr(config, 'location_library', [])}
    _prop_labels = {p.id: getattr(p, 'label', p.id) for p in getattr(config, 'prop_library', [])}
    _character_labels = {}
    for c in getattr(config, 'characters', []):
        name = getattr(c, 'display_name', '') or getattr(c, 'name', '') or c.id
        _character_labels[c.id] = name
    _quality_labels = {}
    wsd = getattr(config, 'world_state_schema', {}) or {}
    for q in wsd.get('qualities', []):
        _quality_labels[q.get('key', '')] = q.get('label', q.get('key', ''))


# ── 公共输出函数 ─────────────────────────────────────────────────────

def game_banner(config: Optional[Any] = None):
    """打印游戏启动横幅（从 config 读取场景描述）"""
    print("=" * 60)
    print("FacadeRemake 原型")
    if config and hasattr(config, 'scene_name'):
        print(f"  {config.scene_name}")
    else:
        print("  基于 LLM + Storylet + BeatPlan 架构的互动叙事系统")
    print("=" * 60)
    print()
    print("输入 'quit' 退出，'status' 查看状态")
    print("-" * 60)
    print()


def character_speaking_hint(display_name: str):
    print(f"\n（{display_name} 似乎想说什么……）")


def _label(key: str, mapping: Dict[str, str]) -> str:
    return mapping.get(key, key)


def _parse_action_sequence(actions: str) -> str:
    """将结构化动作序列转为可读中文描述。

    格式: walk_to[living_room]come_here[]happy
    - 动作/表情/地点/物品/角色均从 init_labels() 填充的映射表读取
    """
    if not actions:
        return ""
    result: list[str] = []
    pattern = r'([a-z_]+)\[([^\]]*)\]'
    matches = re.findall(pattern, actions.lower())

    last_bracket_pos = actions.rfind(']')
    suffix = actions[last_bracket_pos + 1:].strip().lower() if last_bracket_pos >= 0 else actions.lower()

    for action_id, param in matches:
        if action_id in _expression_labels:
            result.append(f"（{_label(action_id, _expression_labels)}）")
            continue
        if action_id not in _action_labels or action_id in ("say", "gesture"):
            continue

        action_desc = _label(action_id, _action_labels)
        param = param.strip().lower()

        if action_id == "walk_to":
            result.append(f"{action_desc}{_label(param, _location_labels)}")
        elif action_id in ("pick_up", "pour"):
            result.append(f"{action_desc}{_label(param, _prop_labels)}")
        elif action_id == "look_at":
            target = _location_labels.get(param, _prop_labels.get(param, param))
            result.append(f"{action_desc}{target}")
        elif param:
            if param in _character_labels:
                result.append(f"给{_label(param, _character_labels)}")
            else:
                result.append(f"{action_desc} {param}")
        else:
            result.append(action_desc)

    suffix = suffix.strip().lower()
    if suffix and suffix in _expression_labels:
        expr = f"（{_label(suffix, _expression_labels)}）"
        if expr not in result:
            result.append(expr)

    return "".join(result)


def character_line(character: str, speech: str, action: str = "",
                   thought: str = "", debug: bool = False):
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
    nonzero = {k: v for k, v in delta.items() if v != 0}
    if not nonzero and not hint:
        return
    parts = []
    for key, val in nonzero.items():
        label = _label(key, _quality_labels)
        sign = "+" if val > 0 else ""
        current = current_values.get(key, 0)
        parts.append(f"{label} {sign}{val}  (当前: {current}/10)")
    if parts:
        print()
        print("    " + "  ".join(parts))
        if hint:
            print(f"    {'─' * 30}")
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
    print(f"\n{'=' * 60}")
    print(f"[进入新场景: {title}]")
    print(f"叙事目标: {narrative_goal}")
    print(f"{'=' * 60}")


def storylet_ended(title: str):
    print(f"\n[场景结束: {title}]")


def landmark_entered(title: str):
    print(f"\n[系统] 进入新阶段: {title}")


def ending(landmark_title: str, description: str, ending_content: str,
           total_turns: int, qualities: Dict[str, float], flags: Dict[str, Any]):
    """泛化结局打印 — 不再硬编码特定 flag 名称"""
    print(f"\n{'=' * 60}")
    print(f"🏁 结局: {landmark_title}")
    print(f"{'=' * 60}")
    print(f"\n{description}\n")
    if ending_content:
        print(ending_content.strip())
    print(f"\n{'=' * 60}")
    print(f"\n[游戏结束 - 总回合数: {total_turns}]")
    for key, val in qualities.items():
        label = _label(key, _quality_labels)
        print(f"[{label}: {val}]")
    true_flags = [k for k, v in flags.items() if v]
    if true_flags:
        print(f"[关键事件: {', '.join(true_flags)}]")
    print(f"{'=' * 60}\n")


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
        label = _label(key, _quality_labels)
        print(f"  {label}: {val}")
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
