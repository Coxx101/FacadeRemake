"""晚餐派对演示场景"""
from config.scenario_schema import (
    ScenarioConfig, ActionEntry, ExpressionEntry, PropEntry, LocationEntry,
    CharacterConfig, NarrativeGoal, SceneConstraints, WorldStateDisplayConfig
)


DINNER_PARTY_SCENARIO = ScenarioConfig(
    id="dinner_party",
    name="晚餐派对的秘密",
    setting_name="Trip & Grace 的晚餐派对",
    setting_description="老朋友 Vince 来家里做客，但这顿饭暗流涌动...",
    conflict_summary="Trip 和 Grace 因装修问题出现裂痕，表面和谐下危机四伏",
    
    action_library=[
        ActionEntry("walk_to", "走到", "移动到目标地点", ["target_location"]),
        ActionEntry("pick_up", "拿起", "拾取物品", ["prop"]),
        ActionEntry("put_down", "放下", "放下物品", ["prop"]),
        ActionEntry("give", "递给", "将物品递给某人", ["prop", "target"]),
        ActionEntry("gesture", "手势", "做出手势", ["gesture_type"]),
        ActionEntry("look_at", "看向", "注视目标", ["target"]),
        ActionEntry("sit_down", "坐下", "坐下", []),
        ActionEntry("stand_up", "站起来", "站立", []),
        ActionEntry("pour", "倒", "倒饮料", ["prop"]),
        ActionEntry("sigh", "叹气", "叹气", []),
        ActionEntry("laugh", "笑", "笑", []),
        ActionEntry("say", "说话", "说出对话内容，触发唇形动画", ["dialogue"]),
        ActionEntry("pause", "停顿", "停顿思考", []),
    ],
    
    expression_library=[
        ExpressionEntry("neutral", "中性", "neutral"),
        ExpressionEntry("happy", "开心", "smile"),
        ExpressionEntry("sad", "难过", "sad"),
        ExpressionEntry("angry", "生气", "angry"),
        ExpressionEntry("thinking", "思考", "thinking"),
        ExpressionEntry("embarrassed", "尴尬", "embarrassed"),
        ExpressionEntry("smirk", "得意", "smirk"),
        ExpressionEntry("confused", "困惑", "confused"),
    ],
    
    prop_library=[
        PropEntry("wine_glass", "酒杯"),
        PropEntry("bottle", "酒瓶"),
        PropEntry("plate", "盘子"),
        PropEntry("napkin", "餐巾"),
        PropEntry("cushion", "靠垫"),
    ],
    
    location_library=[
        LocationEntry("living_room", "客厅", adjacent=["kitchen", "dining_room"]),
        LocationEntry("kitchen", "厨房", adjacent=["living_room"]),
        LocationEntry("dining_room", "餐厅", adjacent=["living_room"]),
        LocationEntry("balcony", "阳台", adjacent=["living_room"]),
    ],
    
    characters=[
        CharacterConfig(
            id="trip",
            name="Trip",
            identity="32岁建筑承包商",
            personality="外向、有魅力、逃避责任",
            background=["与 Grace 结婚8年", "因装修问题频繁争吵"],
            secret_knowledge=["争吵的真实原因", "对婚姻的动摇"],
            default_location="living_room",
        ),
        CharacterConfig(
            id="grace",
            name="Grace",
            identity="30岁室内设计师",
            personality="敏感、追求完美、压抑情绪",
            background=["与 Trip 结婚8年", "装修问题让两人关系紧张"],
            secret_knowledge=["争吵的真实原因", "对婚姻的失望"],
            default_location="kitchen",
        ),
    ],
    
    narrative_goals=[
        NarrativeGoal(
            id="ng_1",
            name="开场寒暄",
            description="角色们进行开场寒暄，营造表面和谐的氛围",
            beats=[],
        ),
        NarrativeGoal(
            id="ng_2",
            name="冲突铺垫",
            description="通过对话逐渐揭示角色间的紧张关系",
            beats=[],
        ),
        NarrativeGoal(
            id="ng_3",
            name="秘密揭露",
            description="关键秘密被揭露，冲突升级",
            beats=[],
        ),
    ],
    
    world_state_schema={
        "qualities": ["tension", "grace_comfort", "trip_comfort"],
        "flags": [
            "arrived", "drinks_started", "renovation_fight",
            "trip_confessed", "grace_exposed", "secrets_revealed",
            "player_mediated"
        ]
    },
    
    scene_constraints=SceneConstraints(
        location_description="公寓客厅，三个大学好友（Trip、Grace、玩家）在做客聊天",
        forbidden_actions=["离开", "暴力", "亲密行为"],
        forbidden_targets=[],
        can_leave_location=False,
        allowed_props=["wine_glass", "bottle", "plate", "napkin"]
    ),
    
    world_state_display=WorldStateDisplayConfig(
        quality_displays=[
            {"key": "tension", "label": "张力"},
            {"key": "grace_comfort", "label": "Grace 舒适度"},
            {"key": "trip_comfort", "label": "Trip 舒适度"},
        ],
        flag_displays=[
            {"key": "secrets_revealed", "label": "秘密揭露"},
            {"key": "trip_confessed", "label": "Trip 坦白"},
            {"key": "grace_exposed", "label": "Grace 暴露"},
            {"key": "player_mediated", "label": "玩家调解"},
        ]
    ),

    # ============================================================
    # Storylets 数据（从 default_storylets.py 迁移）
    # ============================================================
    storylets=[
        {
            "id": "sl_welcome",
            "title": "进门",
            "phase_tags": ["act1"],
            "narrative_goal": "玩家按门铃，Trip 开门迎接。公寓装修精美，但氛围中有一丝不自然。",
            "conditions": [
                {"type": "flag_check", "key": "arrived", "op": "==", "value": False}
            ],
            "content": {
                "type": "llm_prompt",
                "director_note": "Trip 打开门，热情地拥抱你。Grace 正在整理一幅画的位置，看到你来了，放下锤子走过来。公寓装修得很精致——深色木地板、米白墙壁、意大利进口的窗帘。Trip 走到吧台后面，开始调酒。",
                "tone": "热情但略显刻意的友好"
            },
            "effects": [
                {"key": "arrived", "op": "=", "value": True}
            ],
            "repeatability": "never",
            "salience": {"base": 15, "modifiers": []}
        },
        {
            "id": "sl_drinks_chat",
            "title": "酒与寒暄",
            "phase_tags": ["act1"],
            "narrative_goal": "三人喝酒聊天，聊装修、旅行、工作等表面话题，但暗流涌动。",
            "conditions": [
                {"type": "flag_check", "key": "arrived", "op": "==", "value": True},
                {"type": "flag_check", "key": "drinks_started", "op": "==", "value": False}
            ],
            "content": {
                "type": "llm_prompt",
                "director_note": "Trip 递给你一杯鸡尾酒，自己也端了一杯。Grace 坐在沙发上，腿蜷在身下，端着一杯红酒。聊天的话题从你的工作开始，转到他们最近重新装修公寓的事。Grace 说她花了好几个星期选窗帘的颜色，Trip 插了一句'她把所有的颜色都试了一遍'，语气里有一丝不易察觉的讽刺。",
                "tone": "表面轻松，细节处有刺"
            },
            "effects": [
                {"key": "drinks_started", "op": "=", "value": True},
                {"key": "tension", "op": "+", "value": 0.5}
            ],
            "repeatability": "never",
            "salience": {"base": 12, "modifiers": []}
        },
        {
            "id": "sl_renovation_tension",
            "title": "装修战争",
            "phase_tags": ["act2"],
            "narrative_goal": "装修话题成为导火索，暴露出 Trip 和 Grace 对生活方式的根本分歧。",
            "conditions": [
                {"type": "quality_check", "key": "tension", "op": ">=", "value": 0.5},
                {"type": "flag_check", "key": "renovation_fight", "op": "==", "value": False}
            ],
            "content": {
                "type": "llm_prompt",
                "director_note": "Grace 指着角落里一幅画说想换一幅新的，Trip 说'你的画已经够多了'。Grace 的笑容僵了一下：'你是在说我的品味有问题？' Trip 端起酒杯喝了一口，说'我说的是客厅，不是你的品味'。空气突然凝固了。Grace 放下酒杯，声音变得很轻：'你知道这间公寓对我来说意味着什么。'",
                "tone": "一杯酒里的地雷"
            },
            "effects": [
                {"key": "renovation_fight", "op": "=", "value": True},
                {"key": "tension", "op": "+", "value": 1}
            ],
            "repeatability": "never",
            "salience": {"base": 12, "modifiers": []}
        },
        {
            "id": "sl_push_trip",
            "title": "逼问 Trip",
            "phase_tags": ["act2"],
            "narrative_goal": "玩家追问 Trip，Trip 终于承认了自己的婚外情和对 Grace 艺术追求的压抑。",
            "llm_trigger": "玩家追问 Trip、问 Trip 你到底怎么想的、对 Trip 说你有什么没说的",
            "conditions": [
                {"type": "flag_check", "key": "renovation_fight", "op": "==", "value": True},
                {"type": "flag_check", "key": "trip_confessed", "op": "==", "value": False},
                {"type": "flag_check", "key": "grace_exposed", "op": "==", "value": False}
            ],
            "content": {
                "type": "llm_prompt",
                "director_note": "你把 Trip 拉到一边。他先是装作没事，然后叹了口气，说'你不懂，Grace 她……她总是活在自己的世界里。画画、装修、布置——她把所有精力都花在这些东西上面，从来不问我过得怎么样。'",
                "tone": "一个男人防线松动时的自言自语"
            },
            "effects": [
                {"key": "trip_confessed", "op": "=", "value": True},
                {"key": "tension", "op": "+", "value": 1}
            ],
            "repeatability": "never",
            "salience": {"base": 13, "modifiers": []}
        },
        {
            "id": "sl_ask_grace",
            "title": "私下问 Grace",
            "phase_tags": ["act2"],
            "narrative_goal": "玩家私下问 Grace，Grace 揭露了她与 Vince 的往事以及被婚姻扼杀的痛苦。",
            "llm_trigger": "玩家私下问 Grace、问 Grace 你怎么了、对 Grace 说你能跟我说吗",
            "conditions": [
                {"type": "flag_check", "key": "renovation_fight", "op": "==", "value": True},
                {"type": "flag_check", "key": "grace_exposed", "op": "==", "value": False},
                {"type": "flag_check", "key": "trip_confessed", "op": "==", "value": False}
            ],
            "content": {
                "type": "llm_prompt",
                "director_note": "你趁机跟 Grace 在阳台上聊了几句。她的手指一直在摩挲着酒杯的边缘。她说'你知道我最讨厌什么吗？不是他不欣赏我的画。是他从来不想了解画画对我来说意味着什么。' 她顿了顿，压低了声音，像是在做一个决定：'有件事我从没告诉过任何人。'",
                "tone": "一个人终于决定说出那个秘密之前的一秒"
            },
            "effects": [
                {"key": "grace_exposed", "op": "=", "value": True},
                {"key": "tension", "op": "+", "value": 1.5}
            ],
            "repeatability": "never",
            "salience": {"base": 13, "modifiers": []}
        },
        {
            "id": "sl_trip_affair_detail",
            "title": "Trip 的秘密",
            "phase_tags": ["act3", "trip_path"],
            "narrative_goal": "Trip 说出自己的婚外情，以及他对 Grace 不满的深层原因。",
            "conditions": [
                {"type": "flag_check", "key": "trip_confessed", "op": "==", "value": True},
                {"type": "flag_check", "key": "trip_detail_revealed", "op": "==", "value": False}
            ],
            "content": {
                "type": "llm_prompt",
                "director_note": "Trip 终于说出来了。他说他遇见了一个人，一个'能听他说话的人'。他承认这不对，但他说 Grace 从来不关心他的感受，只关心她的画和窗帘。然后他说了一句更重的话：'我没办法和一个艺术家结婚。她活在幻想里，我活在现实里。' Grace 从卧室门口听到了这句话，整个人僵住了。",
                "tone": "一句把所有伪装都撕碎的话"
            },
            "effects": [
                {"key": "trip_detail_revealed", "op": "=", "value": True},
                {"key": "tension", "op": "+", "value": 1.5}
            ],
            "repeatability": "never",
            "salience": {"base": 14, "modifiers": []}
        },
        {
            "id": "sl_grace_vince_detail",
            "title": "Vince",
            "phase_tags": ["act3", "grace_path"],
            "narrative_goal": "Grace 说出与 Vince 的事，以及她八年来一直背着这份内疚生活的痛苦。",
            "conditions": [
                {"type": "flag_check", "key": "grace_exposed", "op": "==", "value": True},
                {"type": "flag_check", "key": "grace_detail_revealed", "op": "==", "value": False}
            ],
            "content": {
                "type": "llm_prompt",
                "director_note": "Grace 说出了名字。Vince。大学同学，学艺术的。在 Trip 求婚的前一天晚上，她和 Vince 在一起。她说：'从那天起我就觉得这段婚姻是被诅咒的。' Trip 站在客厅里，酒杯从手里滑落，碎在地上。",
                "tone": "八年积压在一句话里"
            },
            "effects": [
                {"key": "grace_detail_revealed", "op": "=", "value": True},
                {"key": "tension", "op": "+", "value": 1.5}
            ],
            "repeatability": "never",
            "salience": {"base": 14, "modifiers": []}
        },
        {
            "id": "sl_honest_moment",
            "title": "坦诚的瞬间",
            "phase_tags": ["act4"],
            "narrative_goal": "秘密已经全部摊开。Trip 和 Grace 需要面对真实的彼此。",
            "conditions": [
                {"type": "flag_check", "key": "secrets_revealed", "op": "==", "value": True},
                {"type": "flag_check", "key": "honest_conversation", "op": "==", "value": False}
            ],
            "content": {
                "type": "llm_prompt",
                "director_note": "客厅里只剩下三个人和一地的碎酒杯。Trip 坐在沙发边缘，Grace 靠着墙。长久的沉默之后，Trip 先开口了，声音比平时轻了很多：'我也许……不该说那些话。' Grace 没有看他，但她没有走。",
                "tone": "暴风雨之后最安静的一分钟"
            },
            "effects": [
                {"key": "honest_conversation", "op": "=", "value": True},
                {"key": "tension", "op": "-", "value": 1}
            ],
            "repeatability": "never",
            "salience": {"base": 14, "modifiers": []}
        },
        {
            "id": "sl_final_decision",
            "title": "最终决定",
            "phase_tags": ["act4"],
            "narrative_goal": "Grace 和 Trip 必须做出选择——这段婚姻还要不要继续。",
            "conditions": [
                {"type": "flag_check", "key": "honest_conversation", "op": "==", "value": True},
                {"type": "flag_check", "key": "final_decision_made", "op": "==", "value": False}
            ],
            "content": {
                "type": "llm_prompt",
                "director_note": "Trip 看着 Grace，问了一个他们结婚以来从没问过的问题：'你想让我留下吗？' Grace 沉默了很久。她看向窗外，又看向那面她花了几个星期刷白的墙，最后看向你。",
                "tone": "所有的体面都剥落了，只剩下最真实的问题"
            },
            "effects": [
                {"key": "final_decision_made", "op": "=", "value": True}
            ],
            "repeatability": "never",
            "salience": {"base": 14, "modifiers": []}
        },
        {
            "id": "sl_generic",
            "title": "日常回应",
            "phase_tags": ["act1", "act2", "act3", "act4", "trip_path", "grace_path"],
            "narrative_goal": "一般性回应。Trip 和 Grace 的反应带着各自的情绪底色。",
            "conditions": [],
            "content": {
                "type": "llm_prompt",
                "director_note": "Trip 和 Grace 的反应是社交性的，但总有什么地方不对。Trip 的话比平时多了一点或少了一点，Grace 的笑容比平时浅了一点。你作为老朋友，能感觉到他们之间的空气是紧绷的。",
                "tone": "表面社交，暗流涌动"
            },
            "effects": [],
            "repeatability": "unlimited",
            "salience": {"base": 1, "modifiers": []}
        }
    ],

    # ============================================================
    # Landmarks 数据（从 default_landmarks.py 迁移）
    # ============================================================
    landmarks=[
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
        {
            "id": "lm_2_cracks",
            "title": "裂缝",
            "description": "表面寒暄逐渐失控，Trip 和 Grace 开始互相指责",
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
        {
            "id": "lm_3a_trip",
            "title": "Trip 的坦白",
            "description": "Trip 承认了自己的婚外情，以及他无法接受 Grace 作为艺术家",
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
        {
            "id": "lm_3b_grace",
            "title": "Grace 的揭露",
            "description": "Grace 说出了与 Vince 的事，以及被婚姻扼杀了艺术才华的痛苦",
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
                }
            ],
            "fallback_storylet": "sl_generic",
            "world_state_effects_on_enter": [
                {"key": "current_landmark", "op": "=", "value": "lm_4_resolve"}
            ]
        },
        {
            "id": "lm_5a_reconcile",
            "title": "和解",
            "description": "Trip 和 Grace 同意不再逃避，愿意尝试面对彼此的真实想法。",
            "phase_tag": "ending",
            "is_ending": True,
            "narrative_constraints": {"allowed_storylet_tags": []},
            "transitions": [],
            "ending_content": """Trip 坐在沙发扶手上，双手交叉放在膝盖上。
Grace 站在窗边，手指无意识地摩挲着窗台的边缘。
很久的沉默之后，Grace 转过身来："我不指望一切都能变好。但我不想再假装了。"
Trip 点了点头，没有说话。"""
        },
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
一如既往。明天再谈。永远明天再谈。"""
        }
    ]
)