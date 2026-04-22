"""
默认 Storylets — Facade 原版剧情 DAG

Landmark 结构：lm_1 → lm_2 → (lm_3a / lm_3b) → lm_4 → lm_5
  - lm_2_cracks 分叉为 lm_3a_trip 和 lm_3b_grace
  - 两条路径在 lm_4_resolve 合并
  - 每阶段最多 2 个专用 Storylet + 1 个通用兜底
"""

DEFAULT_STORYLETS = [
    # ==================== lm_1_arrive：做客 ====================
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
            "director_note": "Trip 打开门，热情地拥抱你。客厅里 Grace 正在整理一幅画的位置，看到你来了，放下锤子走过来。公寓装修得很精致——深色木地板、米白墙壁、意大利进口的窗帘。Trip 走到吧台后面，开始调酒。",
            "tone": "热情但略显刻意的友好",
            "character_focus": "trip"
        },
        "effects": [
            {"key": "arrived", "op": "=", "value": True}
        ],
        "repeatability": "never",
        "salience": {"base": 15, "modifiers": []},
        "choices_hint": ["夸装修好看", "问最近怎么样", "接酒"]
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
            "tone": "表面轻松，细节处有刺",
            "character_focus": "both"
        },
        "effects": [
            {"key": "drinks_started", "op": "=", "value": True},
            {"key": "tension", "op": "+", "value": 0.5}
        ],
        "repeatability": "never",
        "salience": {"base": 12, "modifiers": []},
        "choices_hint": ["夸 Grace 的品味", "问他们最近忙什么", "聊大学时候的事"]
    },

    # ==================== lm_2_cracks：裂缝（分叉触发点） ====================
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
            "tone": "一杯酒里的地雷",
            "character_focus": "both"
        },
        "effects": [
            {"key": "renovation_fight", "op": "=", "value": True},
            {"key": "tension", "op": "+", "value": 1}
        ],
        "repeatability": "never",
        "salience": {"base": 12, "modifiers": []},
        "choices_hint": ["打圆场", "问 Grace 什么意思", "不说话"]
    },

    # ── 分支触发器：追问 Trip → 设置 trip_confessed → 过渡到 lm_3a ──
    {
        "id": "sl_push_trip",
        "title": "逼问 Trip",
        "phase_tags": ["act2"],
        "narrative_goal": "玩家追问 Trip，Trip 终于承认了自己的婚外情和对 Grace 艺术追求的压抑。",
        "llm_trigger": "玩家追问 Trip、问 Trip 你到底怎么想的、对 Trip 说你有什么没说的、问你们之间到底怎么了",
        "conditions": [
            {"type": "flag_check", "key": "renovation_fight", "op": "==", "value": True},
            {"type": "flag_check", "key": "trip_confessed", "op": "==", "value": False},
            {"type": "flag_check", "key": "grace_exposed", "op": "==", "value": False}
        ],
        "content": {
            "type": "llm_prompt",
            "director_note": "你把 Trip 拉到一边。他先是装作没事，然后叹了口气，说'你不懂，Grace 她……她总是活在自己的世界里。画画、装修、布置——她把所有精力都花在这些东西上面，从来不问我过得怎么样。'他停顿了一下，欲言又止。Grace 在客厅里没有跟过来，但你能感觉到她在听。",
            "tone": "一个男人防线松动时的自言自语",
            "character_focus": "trip",
            "allowed_behaviors": ["deflect", "hesitate", "admit"]
        },
        "effects": [
            {"key": "trip_confessed", "op": "=", "value": True},
            {"key": "tension", "op": "+", "value": 1}
        ],
        "repeatability": "never",
        "salience": {"base": 13, "modifiers": []},
        "choices_hint": ["继续追问", "给他空间", "回去找 Grace"]
    },

    # ── 分支触发器：私下问 Grace → 设置 grace_exposed → 过渡到 lm_3b ──
    {
        "id": "sl_ask_grace",
        "title": "私下问 Grace",
        "phase_tags": ["act2"],
        "narrative_goal": "玩家私下问 Grace，Grace 揭露了她与 Vince 的往事以及被婚姻扼杀的痛苦。",
        "llm_trigger": "玩家私下问 Grace、问 Grace 你怎么了、对 Grace 说你能跟我说吗、问你和 Trip 之间出什么事了",
        "conditions": [
            {"type": "flag_check", "key": "renovation_fight", "op": "==", "value": True},
            {"type": "flag_check", "key": "grace_exposed", "op": "==", "value": False},
            {"type": "flag_check", "key": "trip_confessed", "op": "==", "value": False}
        ],
        "content": {
            "type": "llm_prompt",
            "director_note": "你趁机跟 Grace 在阳台上聊了几句。她的手指一直在摩挲着酒杯的边缘。她说'你知道我最讨厌什么吗？不是他不欣赏我的画。是他从来不想了解画画对我来说意味着什么。' 她顿了顿，压低了声音，像是在做一个决定：'有件事我从没告诉过任何人。'",
            "tone": "一个人终于决定说出那个秘密之前的一秒",
            "character_focus": "grace",
            "allowed_behaviors": ["cold_truth", "subtle_hint", "go_quiet"]
        },
        "effects": [
            {"key": "grace_exposed", "op": "=", "value": True},
            {"key": "tension", "op": "+", "value": 1.5}
        ],
        "repeatability": "never",
        "salience": {"base": 13, "modifiers": []},
        "choices_hint": ["我在听", "别逼自己", "Trip 在里面等"]
    },

    # ==================== lm_3a_trip：Trip 的坦白 ====================
    {
        "id": "sl_trip_affair_detail",
        "title": "Trip 的秘密",
        "phase_tags": ["act3", "trip_path"],
        "narrative_goal": "Trip 说出自己的婚外情，以及他对 Grace 不满的深层原因——他无法接受和一个'艺术家'结婚。",
        "conditions": [
            {"type": "flag_check", "key": "trip_confessed", "op": "==", "value": True},
            {"type": "flag_check", "key": "trip_detail_revealed", "op": "==", "value": False}
        ],
        "content": {
            "type": "llm_prompt",
            "director_note": "Trip 终于说出来了。他说他遇见了一个人，一个'能听他说话的人'。他承认这不对，但他说 Grace 从来不关心他的感受，只关心她的画和窗帘。然后他说了一句更重的话：'我没办法和一个艺术家结婚。她活在幻想里，我活在现实里。' Grace 从卧室门口听到了这句话，整个人僵住了。",
            "tone": "一句把所有伪装都撕碎的话",
            "character_focus": "trip",
            "allowed_behaviors": ["apologize", "admit", "go_quiet"]
        },
        "effects": [
            {"key": "trip_detail_revealed", "op": "=", "value": True},
            {"key": "tension", "op": "+", "value": 1.5}
        ],
        "repeatability": "never",
        "salience": {"base": 14, "modifiers": []},
        "choices_hint": ["你怎么能这么说", "问 Grace 你还好吗", "沉默"]
    },

    # ==================== lm_3b_grace：Grace 的揭露 ====================
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
            "director_note": "Grace 说出了名字。Vince。大学同学，学艺术的。在 Trip 求婚的前一天晚上，她和 Vince 在一起。她说她不知道为什么，也许是害怕，也许是迷茫。'从那天起我就觉得这段婚姻是被诅咒的。' 她的声音在发抖，但表情很平静，像排练过无数次。Trip 站在客厅里，酒杯从手里滑落，碎在地上。",
            "tone": "八年积压在一句话里",
            "character_focus": "grace",
            "allowed_behaviors": ["cold_truth", "break_down", "go_quiet"]
        },
        "effects": [
            {"key": "grace_detail_revealed", "op": "=", "value": True},
            {"key": "tension", "op": "+", "value": 1.5}
        ],
        "repeatability": "never",
        "salience": {"base": 14, "modifiers": []},
        "choices_hint": ["问 Trip 你听到了吗", "什么都不说", "Grace 你为什么现在才说"]
    },

    # ==================== lm_4_resolve：摊牌（合并） ====================
    {
        "id": "sl_honest_moment",
        "title": "坦诚的瞬间",
        "phase_tags": ["act4"],
        "narrative_goal": "秘密已经全部摊开。Trip 和 Grace 需要面对真实的彼此，玩家的调解可能改变走向。",
        "conditions": [
            {"type": "flag_check", "key": "secrets_revealed", "op": "==", "value": True},
            {"type": "flag_check", "key": "honest_conversation", "op": "==", "value": False}
        ],
        "llm_trigger": "玩家劝他们好好谈、对 Trip 说你好好听 Grace 说、对 Grace 说你给 Trip 一个机会、说你们都有错",
        "content": {
            "type": "llm_prompt",
            "director_note": "客厅里只剩下三个人和一地的碎酒杯。Trip 坐在沙发边缘，Grace 靠着墙。长久的沉默之后，Trip 先开口了，声音比平时轻了很多：'我也许……不该说那些话。' Grace 没有看他，但她没有走。这是今晚第一次，两个人没有在互相攻击。",
            "tone": "暴风雨之后最安静的一分钟",
            "character_focus": "both",
            "allowed_behaviors": ["apologize", "admit", "go_quiet"]
        },
        "effects": [
            {"key": "honest_conversation", "op": "=", "value": True},
            {"key": "tension", "op": "-", "value": 1}
        ],
        "repeatability": "never",
        "salience": {"base": 14, "modifiers": [
            {
                "key": "player_mediated",
                "threshold": 1,
                "bonus": 3,
                "penalty": 0
            }
        ]},
        "choices_hint": ["你们需要一个真正的谈话", "这是你们之间的事", "保持沉默"]
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
            "director_note": "Trip 看着 Grace，问了一个他们结婚以来从没问过的问题：'你想让我留下吗？' Grace 沉默了很久。她看向窗外，又看向那面她花了几个星期刷白的墙，最后看向你。她在等你的反应，好像你的回答会影响她的决定。",
            "tone": "所有的体面都剥落了，只剩下最真实的问题",
            "character_focus": "grace"
        },
        "conditional_effects": [
            {
                "conditions": [
                    {"type": "flag_check", "key": "player_mediated", "op": "==", "value": True}
                ],
                "effects": [
                    {"key": "final_decision_made", "op": "=", "value": True},
                    {"key": "tension", "op": "-", "value": 0.5}
                ]
            }
        ],
        "repeatability": "never",
        "salience": {"base": 14, "modifiers": []},
        "choices_hint": ["说不关我的事", "说这是你们的选择", "对 Grace 说你想怎样"]
    },

    # ==================== 通用兜底 ====================
    {
        "id": "sl_generic",
        "title": "日常回应",
        "phase_tags": ["act1", "act2", "act3", "act4", "trip_path", "grace_path"],
        "narrative_goal": "一般性回应。Trip 和 Grace 的反应带着各自的情绪底色。",
        "conditions": [],
        "content": {
            "type": "llm_prompt",
            "director_note": "Trip 和 Grace 的反应是社交性的，但总有什么地方不对。Trip 的话比平时多了一点或少了一点，Grace 的笑容比平时浅了一点。你作为老朋友，能感觉到他们之间的空气是紧绷的。",
            "tone": "表面社交，暗流涌动",
            "character_focus": "both"
        },
        "effects": [],
        "repeatability": "unlimited",
        "salience": {"base": 1, "modifiers": []}
    }
]
