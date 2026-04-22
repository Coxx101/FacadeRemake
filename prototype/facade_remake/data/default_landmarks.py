"""
默认 Landmark 数据 — Facade 原版剧情 DAG

结构图：

    lm_1_arrive（做客）
         │
    lm_2_cracks（裂缝）
       ┌───┴───┐
       ↓       ↓
  lm_3a     lm_3b       ← DAG 分叉为两个 Landmark
  (Trip坦白) (Grace揭露)
       └───┬───┘
           ↓
    lm_4_resolve（摊牌）  ← 合并节点
       ┌───┴───┐
       ↓       ↓
  lm_5a     lm_5b       ← 两个结局
  (和解)    (破裂)

设计说明：
  - 7 个节点：4 阶段 + 2 分支 Landmark + 2 结局
  - lm_2_cracks 分叉为 lm_3a（Trip 坦白婚外情）和 lm_3b（Grace 揭露 Vince 的事）
  - 两条路径在 lm_4_resolve 合并
  - lm_4 分叉为两个结局：honest_conversation → 和解，否则 → 破裂
  - 每阶段最多 2 个 Storylet
"""

DEFAULT_LANDMARKS = [

    # ─────────────────────────────────────────
    # 第一阶段：做客
    # ─────────────────────────────────────────
    {
        "id": "lm_1_arrive",
        "title": "做客",
        "description": "玩家受邀来到 Trip 和 Grace 的公寓做客，表面寒暄，气氛尚可",
        "phase_tag": "act1",
        "max_storylets": 4,
        "narrative_constraints": {
            "allowed_storylet_tags": ["act1"],
            "forbidden_reveals": ["affair", "vince", "divorce"]
        },
        "transitions": [
            {
                "target_id": "lm_2_cracks",
                "label": "气氛出现裂痕",
                "conditions": [
                    {"type": "quality_check", "key": "tension", "op": ">=", "value": 1}
                ]
            },
            {
                "target_id": "lm_2_cracks",
                "label": "回合兜底",
                "turn_limit": 8,
                "is_fallback": True
            }
        ],
        "fallback_storylet": "sl_generic",
        "world_state_effects_on_enter": [
            {"key": "current_landmark", "op": "=", "value": "lm_1_arrive"}
        ]
    },

    # ─────────────────────────────────────────
    # 第二阶段：裂缝（分叉点）
    # ─────────────────────────────────────────
    {
        "id": "lm_2_cracks",
        "title": "裂缝",
        "description": "表面寒暄逐渐失控，Trip 和 Grace 开始互相指责，被动攻击不断升级",
        "phase_tag": "act2",
        "max_storylets": 4,
        "narrative_constraints": {
            "allowed_storylet_tags": ["act2"],
            "forbidden_reveals": []
        },
        "transitions": [
            {
                "target_id": "lm_3a_trip",
                "label": "Trip 承认秘密",
                "conditions": [
                    {"type": "flag_check", "key": "trip_confessed", "op": "==", "value": True}
                ]
            },
            {
                "target_id": "lm_3b_grace",
                "label": "Grace 揭露过去",
                "conditions": [
                    {"type": "flag_check", "key": "grace_exposed", "op": "==", "value": True}
                ]
            },
            {
                "target_id": "lm_3b_grace",
                "label": "回合兜底",
                "turn_limit": 12,
                "is_fallback": True
            }
        ],
        "fallback_storylet": "sl_generic",
        "world_state_effects_on_enter": [
            {"key": "current_landmark", "op": "=", "value": "lm_2_cracks"}
        ]
    },

    # ─────────────────────────────────────────
    # 第三阶段 A：Trip 的坦白（分支 Landmark）
    # ─────────────────────────────────────────
    {
        "id": "lm_3a_trip",
        "title": "Trip 的坦白",
        "description": "Trip 承认了自己的婚外情，以及他一直无法接受 Grace 作为艺术家这件事",
        "phase_tag": "act3",
        "max_storylets": 2,
        "narrative_constraints": {
            "allowed_storylet_tags": ["act3", "trip_path"],
            "forbidden_reveals": []
        },
        "transitions": [
            {
                "target_id": "lm_4_resolve",
                "label": "进入摊牌",
                "conditions": [
                    {"type": "quality_check", "key": "tension", "op": ">=", "value": 3}
                ]
            },
            {
                "target_id": "lm_4_resolve",
                "label": "回合兜底",
                "turn_limit": 10,
                "is_fallback": True
            }
        ],
        "fallback_storylet": "sl_generic",
        "world_state_effects_on_enter": [
            {"key": "current_landmark", "op": "=", "value": "lm_3a_trip"},
            {"key": "secrets_revealed", "op": "=", "value": True}
        ]
    },

    # ─────────────────────────────────────────
    # 第三阶段 B：Grace 的揭露（分支 Landmark）
    # ─────────────────────────────────────────
    {
        "id": "lm_3b_grace",
        "title": "Grace 的揭露",
        "description": "Grace 说出了与 Vince 的事，以及她觉得被婚姻扼杀了艺术才华的痛苦",
        "phase_tag": "act3",
        "max_storylets": 2,
        "narrative_constraints": {
            "allowed_storylet_tags": ["act3", "grace_path"],
            "forbidden_reveals": []
        },
        "transitions": [
            {
                "target_id": "lm_4_resolve",
                "label": "进入摊牌",
                "conditions": [
                    {"type": "quality_check", "key": "tension", "op": ">=", "value": 3}
                ]
            },
            {
                "target_id": "lm_4_resolve",
                "label": "回合兜底",
                "turn_limit": 10,
                "is_fallback": True
            }
        ],
        "fallback_storylet": "sl_generic",
        "world_state_effects_on_enter": [
            {"key": "current_landmark", "op": "=", "value": "lm_3b_grace"},
            {"key": "secrets_revealed", "op": "=", "value": True}
        ]
    },

    # ─────────────────────────────────────────
    # 第四阶段：摊牌（合并节点）
    # ─────────────────────────────────────────
    {
        "id": "lm_4_resolve",
        "title": "摊牌",
        "description": "秘密已经摊开，三个人必须面对这段关系的真实状况",
        "phase_tag": "act4",
        "max_storylets": 2,
        "narrative_constraints": {
            "allowed_storylet_tags": ["act4"],
            "forbidden_reveals": []
        },
        "transitions": [
            {
                "target_id": "lm_5a_reconcile",
                "label": "双方愿意坦诚面对",
                "conditions": [
                    {"type": "flag_check", "key": "honest_conversation", "op": "==", "value": True}
                ]
            },
            {
                "target_id": "lm_5b_breakup",
                "label": "兜底：未达成和解",
                "storylet_count": 3,
                "is_fallback": True
            },
            {
                "target_id": "lm_5b_breakup",
                "label": "回合兜底",
                "turn_limit": 15,
                "is_fallback": True
            }
        ],
        "fallback_storylet": "sl_generic",
        "world_state_effects_on_enter": [
            {"key": "current_landmark", "op": "=", "value": "lm_4_resolve"}
        ]
    },

    # ─────────────────────────────────────────
    # 结局 A：和解
    # ─────────────────────────────────────────
    {
        "id": "lm_5a_reconcile",
        "title": "和解",
        "description": "Trip 和 Grace 同意不再逃避，至少愿意尝试面对彼此的真实想法。",
        "phase_tag": "ending",
        "is_ending": True,
        "narrative_constraints": {"allowed_storylet_tags": []},
        "transitions": [],
        "ending_content": """Trip 坐在沙发扶手上，双手交叉放在膝盖上。
Grace 站在窗边，手指无意识地摩挲着窗台的边缘。
很久的沉默之后，Grace 转过身来："我不指望一切都能变好。但我不想再假装了。"
Trip 点了点头，没有说话。
你站起来，走向门口。他们没有送你。
但走廊里传来的声音不再是争吵——是他们终于开始说话了。"""
    },

    # ─────────────────────────────────────────
    # 结局 B：破裂
    # ─────────────────────────────────────────
    {
        "id": "lm_5b_breakup",
        "title": "破裂",
        "description": "这个晚上没有解决任何问题。婚姻继续维持着表面的体面。",
        "phase_tag": "ending",
        "is_ending": True,
        "narrative_constraints": {"allowed_storylet_tags": []},
        "transitions": [],
        "ending_content": """Grace 把酒杯放在吧台上，发出一声清脆的响。
"我觉得你该走了。"她对你说。
Trip 站在卧室门口，背对着你们，一言不发。
你拿起外套，穿过那间精心装修的客厅。
关上门的瞬间，你听到 Grace 的声音："我们明天再谈吧，Trip。"
一如既往。明天再谈。永远明天再谈。"""
    }
]
