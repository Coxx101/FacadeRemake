import type { Landmark, Storylet, CharacterProfile, SharedContext, WorldStateDefinition, ActionEntry, ExpressionEntry, PropEntry, LocationEntry } from '../types'

// ── 默认 WorldState 定义（与 Python 后端 _init_world_state 对齐）─────────────

export const defaultWorldStateDefinition: WorldStateDefinition = {
  qualities: [
    { key: 'tension', label: '紧张度', initial: 0, min: 0, max: 5, description: '聚会氛围紧张程度，0=正常社交，5=彻底爆发' },
  ],
  flags: [
    { key: 'arrived', label: '玩家已到达', initial: false, description: '玩家是否已进入 Trip 和 Grace 的公寓' },
    { key: 'drinks_started', label: '酒与寒暄', initial: false, description: '三人开始喝酒聊天' },
    { key: 'renovation_fight', label: '装修争执', initial: false, description: '装修话题引发 Trip 和 Grace 的争执' },
    { key: 'trip_confessed', label: 'Trip 坦白', initial: false, description: 'Trip 承认了自己的婚外情' },
    { key: 'grace_exposed', label: 'Grace 揭露', initial: false, description: 'Grace 说出了与 Vince 的事' },
    { key: 'secrets_revealed', label: '秘密已揭露', initial: false, description: '任一坦白路径触发，进入摊牌阶段' },
    { key: 'trip_detail_revealed', label: 'Trip 细节', initial: false, description: 'Trip 说出完整的婚外情和对 Grace 的不满' },
    { key: 'grace_detail_revealed', label: 'Grace 细节', initial: false, description: 'Grace 说出 Vince 的名字和八年来的内疚' },
    { key: 'honest_conversation', label: '坦诚对话', initial: false, description: '双方开始真正面对彼此' },
    { key: 'final_decision_made', label: '最终决定', initial: false, description: 'Grace 做出了关于婚姻的决定' },
    { key: 'player_mediated', label: '玩家调停', initial: false, description: '玩家主动调解 Trip 和 Grace 的关系' },
  ],
  relationships: [],
}

// ── 默认 SharedContext（与 Python config/characters.py 对齐）─────────────────

export const defaultSharedContext: SharedContext = {
  marriage_secret: {
    grace_affair_with_vince: true,
    vince_is_college_friend: true,
    grace_slept_with_vince_before_proposal: true,
    trip_also_had_affair: true,
    grace_doesnt_know_trip_affair: true,
    trip_cant_stand_grace_being_artist: true,
    class_difference: true,
  },
  key_events: {},
}

// ── 默认角色设定 ──────────────────────────────────────────────────────────

export const defaultCharacters: CharacterProfile[] = [
  {
    id: 'trip',
    name: 'Trip',
    identity: 'Trip 全名 Travis，30岁，出身普通家庭，从事金融行业。Grace 的丈夫，大学时期和玩家相识。他主动邀请老友来家里做客，但婚姻已经千疮百孔。',
    personality: '表面热情好客、幽默健谈，实际防御性强，习惯用被动攻击表达不满。对自己出身的自卑转化为控制欲。',
    background: ['出身普通家庭，对父母感到羞耻', '从事金融工作，追求物质成功'],
    secret_knowledge: [
      '只有系统知道：他也有婚外情，但 Grace 不知道',
      '他一直无法接受 Grace 作为艺术家的身份',
    ],
    ng_words: ['亲爱的', '宝贝', '语言模型', 'AI', '助手', '作为你的'],
    monologues: [
      {
        id: 'mon_trip_affair',
        ref_secret: '只有系统知道：他也有婚外情',
        category: '核心秘密',
        monologue: '那次的事...我只是需要有人听我说话。Grace 永远在搞她的画、她的装修。她什么时候关心过我的感受？但这事绝对不能让她知道。',
        emotion_tags: ['愧疚', '自我辩护'],
      },
      {
        id: 'mon_trip_class_shame',
        ref_secret: '他对自己的贫困家庭出身感到羞耻',
        category: '深层创伤',
        monologue: 'Grace 的父母...他们那种眼神。嫌我买不起好的、穿不起体面的。我不怪他们，我确实配不上。但我不想让 Grace 知道我心里有多在意。',
        emotion_tags: ['自卑', '不甘'],
      },
    ],
  },
  {
    id: 'grace',
    name: 'Grace',
    identity: 'Grace，30岁，出身纽约富裕家庭，有才华的艺术家。Trip 的妻子，大学时期和玩家相识。她对装修有近乎偏执的痴迷——这是她仅存的创作出口。',
    personality: '表面友好优雅，但内心积压了大量不满。被娇生惯养长大，情绪容易爆发。爆发方式不是大吵，而是冷冰冰地直击要害。',
    background: ['出身富裕家庭，从小被娇惯', '有艺术天赋，修过多门艺术课程'],
    secret_knowledge: [
      '只有系统知道：她与 Vince 在 Trip 求婚前一晚发生了关系',
      '她觉得自己的艺术才华被婚姻扼杀了',
    ],
    ng_words: ['我好生气啊', '气死我了', '语言模型', 'AI', '助手', '让我来帮你'],
    monologues: [
      {
        id: 'mon_grace_vince',
        ref_secret: '只有系统知道：她与 Vince 在 Trip 求婚前一晚发生了关系',
        category: '核心秘密',
        monologue: 'Vince...那晚只是个错误。但每次 Trip 看着我的眼睛说"我信任你"，我就觉得自己在撒谎。我毁了这段婚姻，从第一天起就毁了。',
        emotion_tags: ['内疚', '恐惧'],
      },
      {
        id: 'mon_grace_smothered',
        ref_secret: '她觉得自己的艺术才华被婚姻扼杀了',
        category: '心理压抑',
        monologue: '我以前画画。真正地画画。现在呢？这间公寓就是我的全部作品。装修、配色、窗帘——我把所有的创造力都花在了这些上面。因为我已经没有别的地方可以用了。',
        emotion_tags: ['失落', '压抑的愤怒'],
      },
    ],
  },
]

// ── 默认 Landmark（DAG 分叉 + 双结局）──────────────────────────────────
// 结构：lm_1 → lm_2 → (lm_3a / lm_3b) → lm_4 → (lm_5a / lm_5b)

export const defaultLandmarks: Landmark[] = [
  {
    id: 'lm_1_arrive',
    title: '做客',
    description: '玩家受邀来到 Trip 和 Grace 的公寓，表面寒暄，气氛尚可',
    phase_tag: 'act1',
    is_ending: false,
    ending_content: '',
    transitions: [
      {
        target_id: 'lm_2_cracks',
        conditions: [{ type: 'quality_check', key: 'tension', op: '>=', value: 1 }],
        turn_limit: undefined,
        storylet_count: undefined,
        is_fallback: false,
        label: '气氛出现裂痕',
      },
      {
        target_id: 'lm_2_cracks',
        conditions: [],
        turn_limit: 8,
        storylet_count: undefined,
        is_fallback: true,
        label: '回合兜底',
      },
    ],
    max_storylets: 4,
    narrative_constraints: {
      allowed_storylet_tags: ['act1'],
      forbidden_reveals: ['affair', 'vince', 'divorce'],
    },
    world_state_effects_on_enter: [],
    fallback_storylet: 'sl_generic',
    position: { x: 80, y: 200 },
  },
  {
    id: 'lm_2_cracks',
    title: '裂缝',
    description: '表面寒暄逐渐失控，Trip 和 Grace 开始互相指责',
    phase_tag: 'act2',
    is_ending: false,
    ending_content: '',
    transitions: [
      {
        target_id: 'lm_3a_trip',
        conditions: [{ type: 'flag_check', key: 'trip_confessed', op: '==', value: true }],
        turn_limit: undefined,
        storylet_count: undefined,
        is_fallback: false,
        label: 'Trip 承认秘密',
      },
      {
        target_id: 'lm_3b_grace',
        conditions: [{ type: 'flag_check', key: 'grace_exposed', op: '==', value: true }],
        turn_limit: undefined,
        storylet_count: undefined,
        is_fallback: false,
        label: 'Grace 揭露过去',
      },
      {
        target_id: 'lm_3b_grace',
        conditions: [],
        turn_limit: 12,
        storylet_count: undefined,
        is_fallback: true,
        label: '回合兜底',
      },
    ],
    max_storylets: 4,
    narrative_constraints: {
      allowed_storylet_tags: ['act2'],
      forbidden_reveals: [],
    },
    world_state_effects_on_enter: [],
    fallback_storylet: 'sl_generic',
    position: { x: 330, y: 200 },
  },
  {
    id: 'lm_3a_trip',
    title: 'Trip 的坦白',
    description: 'Trip 承认了自己的婚外情，以及他对 Grace 艺术追求的不满',
    phase_tag: 'act3',
    is_ending: false,
    ending_content: '',
    transitions: [
      {
        target_id: 'lm_4_resolve',
        conditions: [{ type: 'quality_check', key: 'tension', op: '>=', value: 3 }],
        turn_limit: undefined,
        storylet_count: undefined,
        is_fallback: false,
        label: '进入摊牌',
      },
      {
        target_id: 'lm_4_resolve',
        conditions: [],
        turn_limit: 10,
        storylet_count: undefined,
        is_fallback: true,
        label: '回合兜底',
      },
    ],
    max_storylets: 2,
    narrative_constraints: {
      allowed_storylet_tags: ['act3', 'trip_path'],
      forbidden_reveals: [],
    },
    world_state_effects_on_enter: [],
    fallback_storylet: 'sl_generic',
    position: { x: 600, y: 100 },
  },
  {
    id: 'lm_3b_grace',
    title: 'Grace 的揭露',
    description: 'Grace 说出了与 Vince 的事，以及被婚姻扼杀的痛苦',
    phase_tag: 'act3',
    is_ending: false,
    ending_content: '',
    transitions: [
      {
        target_id: 'lm_4_resolve',
        conditions: [{ type: 'quality_check', key: 'tension', op: '>=', value: 3 }],
        turn_limit: undefined,
        storylet_count: undefined,
        is_fallback: false,
        label: '进入摊牌',
      },
      {
        target_id: 'lm_4_resolve',
        conditions: [],
        turn_limit: 10,
        storylet_count: undefined,
        is_fallback: true,
        label: '回合兜底',
      },
    ],
    max_storylets: 2,
    narrative_constraints: {
      allowed_storylet_tags: ['act3', 'grace_path'],
      forbidden_reveals: [],
    },
    world_state_effects_on_enter: [],
    fallback_storylet: 'sl_generic',
    position: { x: 600, y: 300 },
  },
  {
    id: 'lm_4_resolve',
    title: '摊牌',
    description: '秘密已经摊开，三个人必须面对这段关系的真实状况',
    phase_tag: 'act4',
    is_ending: false,
    ending_content: '',
    transitions: [
      {
        target_id: 'lm_5a_reconcile',
        conditions: [{ type: 'flag_check', key: 'honest_conversation', op: '==', value: true }],
        turn_limit: undefined,
        storylet_count: undefined,
        is_fallback: false,
        label: '坦诚面对',
      },
      {
        target_id: 'lm_5b_breakup',
        conditions: [],
        turn_limit: 15,
        storylet_count: 3,
        is_fallback: true,
        label: '兜底',
      },
    ],
    max_storylets: 2,
    narrative_constraints: {
      allowed_storylet_tags: ['act4'],
      forbidden_reveals: [],
    },
    world_state_effects_on_enter: [],
    fallback_storylet: 'sl_generic',
    position: { x: 870, y: 200 },
  },
  {
    id: 'lm_5a_reconcile',
    title: '和解',
    description: 'Trip 和 Grace 同意不再逃避，至少愿意尝试面对彼此的真实想法。',
    phase_tag: 'ending',
    is_ending: true,
    ending_content: 'Trip 坐在沙发扶手上，双手交叉放在膝盖上。\nGrace 站在窗边，手指无意识地摩挲着窗台的边缘。\n很久的沉默之后，Grace 转过身来："我不指望一切都能变好。但我不想再假装了。"\nTrip 点了点头，没有说话。\n你站起来，走向门口。他们没有送你。\n但走廊里传来的声音不再是争吵——是他们终于开始说话了。',
    transitions: [],
    max_storylets: undefined,
    narrative_constraints: {},
    world_state_effects_on_enter: [],
    fallback_storylet: undefined,
    position: { x: 1100, y: 120 },
  },
  {
    id: 'lm_5b_breakup',
    title: '破裂',
    description: '这个晚上没有解决任何问题。婚姻继续维持着表面的体面。',
    phase_tag: 'ending',
    is_ending: true,
    ending_content: 'Grace 把酒杯放在吧台上，发出一声清脆的响。\n"我觉得你该走了。" 她对你说。\nTrip 站在卧室门口，背对着你们，一言不发。\n你拿起外套，穿过那间精心装修的客厅。\n关上门的瞬间，你听到 Grace 的声音："我们明天再谈吧，Trip。"\n一如既往。明天再谈。永远明天再谈。',
    transitions: [],
    max_storylets: undefined,
    narrative_constraints: {},
    world_state_effects_on_enter: [],
    fallback_storylet: undefined,
    position: { x: 1100, y: 300 },
  },
]

// ── 默认 Storylet（与 Python 后端 default_storylets.py 对齐）────────────────

export const defaultStorylets: Storylet[] = [
  // ─── act1: 做客 ───
  {
    id: 'sl_welcome',
    title: '进门',
    phase_tags: ['act1'],
    narrative_goal: '玩家按门铃，Trip 开门迎接。公寓装修精美，但氛围中有一丝不自然。',
    conditions: [{ type: 'flag_check', key: 'arrived', op: '==', value: false }],
    llm_trigger: undefined,
    content: {
      director_note: 'Trip 打开门，热情地拥抱你。客厅里 Grace 正在整理一幅画的位置，看到你来了，放下锤子走过来。公寓装修得很精致——深色木地板、米白墙壁、意大利进口的窗帘。Trip 走到吧台后面，开始调酒。',
      tone: '热情但略显刻意的友好',
    },
    effects: [{ type: 'set_flag', key: 'arrived', value: true }],
    conditional_effects: [],
    repeatability: 'never',
    cooldown: undefined,
    sticky: false,
    priority_override: undefined,
    salience: { base: 15, modifiers: [] },
    on_interrupt: 'pause',
    completion_trigger: undefined,
    force_wrap_up: undefined,
  },
  {
    id: 'sl_drinks_chat',
    title: '酒与寒暄',
    phase_tags: ['act1'],
    narrative_goal: '三人喝酒聊天，聊装修、旅行、工作等表面话题，但暗流涌动。',
    conditions: [
      { type: 'flag_check', key: 'arrived', op: '==', value: true },
      { type: 'flag_check', key: 'drinks_started', op: '==', value: false },
    ],
    llm_trigger: undefined,
    content: {
      director_note: 'Trip 递给你一杯鸡尾酒，自己也端了一杯。Grace 坐在沙发上，腿蜷在身下，端着一杯红酒。聊天的话题从你的工作开始，转到他们最近重新装修公寓的事。Grace 说她花了好几个星期选窗帘的颜色，Trip 插了一句"她把所有的颜色都试了一遍"，语气里有一丝不易察觉的讽刺。',
      tone: '表面轻松，细节处有刺',
    },
    effects: [
      { type: 'set_flag', key: 'drinks_started', value: true },
      { type: 'increment_quality', key: 'tension', amount: 0.5 },
    ],
    conditional_effects: [],
    repeatability: 'never',
    cooldown: undefined,
    sticky: false,
    priority_override: undefined,
    salience: { base: 12, modifiers: [] },
    on_interrupt: 'pause',
    completion_trigger: undefined,
    force_wrap_up: undefined,
  },

  // ─── act2: 裂缝（分叉触发点） ───
  {
    id: 'sl_renovation_tension',
    title: '装修战争',
    phase_tags: ['act2'],
    narrative_goal: '装修话题成为导火索，暴露出 Trip 和 Grace 对生活方式的根本分歧。',
    conditions: [
      { type: 'quality_check', key: 'tension', op: '>=', value: 0.5 },
      { type: 'flag_check', key: 'renovation_fight', op: '==', value: false },
    ],
    llm_trigger: undefined,
    content: {
      director_note: 'Grace 指着角落里一幅画说想换一幅新的，Trip 说"你的画已经够多了"。Grace 的笑容僵了一下："你是在说我的品味有问题？" Trip 端起酒杯喝了一口，说"我说的是客厅，不是你的品味"。空气突然凝固了。Grace 放下酒杯，声音变得很轻："你知道这间公寓对我来说意味着什么。"',
      tone: '一杯酒里的地雷',
    },
    effects: [
      { type: 'set_flag', key: 'renovation_fight', value: true },
      { type: 'increment_quality', key: 'tension', amount: 1 },
    ],
    conditional_effects: [],
    repeatability: 'never',
    cooldown: undefined,
    sticky: false,
    priority_override: undefined,
    salience: { base: 12, modifiers: [] },
    on_interrupt: 'pause',
    completion_trigger: undefined,
    force_wrap_up: undefined,
  },
  {
    id: 'sl_push_trip',
    title: '逼问 Trip',
    phase_tags: ['act2'],
    narrative_goal: '玩家追问 Trip，Trip 终于承认了自己的婚外情和对 Grace 的不满。',
    conditions: [
      { type: 'flag_check', key: 'renovation_fight', op: '==', value: true },
      { type: 'flag_check', key: 'trip_confessed', op: '==', value: false },
      { type: 'flag_check', key: 'grace_exposed', op: '==', value: false },
    ],
    llm_trigger: '玩家追问 Trip、问 Trip 你到底怎么想的、对 Trip 说你有什么没说的、问你们之间到底怎么了',
    content: {
      director_note: '你把 Trip 拉到一边。他先是装作没事，然后叹了口气，说"你不懂，Grace 她……她总是活在自己的世界里。画画、装修、布置——她把所有精力都花在这些东西上面，从来不问我过得怎么样。" 他停顿了一下，欲言又止。Grace 在客厅里没有跟过来，但你能感觉到她在听。',
      tone: '一个男人防线松动时的自言自语',
    },
    effects: [
      { type: 'set_flag', key: 'trip_confessed', value: true },
      { type: 'increment_quality', key: 'tension', amount: 1 },
    ],
    conditional_effects: [],
    repeatability: 'never',
    cooldown: undefined,
    sticky: false,
    priority_override: undefined,
    salience: { base: 13, modifiers: [] },
    on_interrupt: 'pause',
    completion_trigger: undefined,
    force_wrap_up: undefined,
  },
  {
    id: 'sl_ask_grace',
    title: '私下问 Grace',
    phase_tags: ['act2'],
    narrative_goal: '玩家私下问 Grace，Grace 揭露了她与 Vince 的往事以及被婚姻扼杀的痛苦。',
    conditions: [
      { type: 'flag_check', key: 'renovation_fight', op: '==', value: true },
      { type: 'flag_check', key: 'grace_exposed', op: '==', value: false },
      { type: 'flag_check', key: 'trip_confessed', op: '==', value: false },
    ],
    llm_trigger: '玩家私下问 Grace、问 Grace 你怎么了、对 Grace 说你能跟我说吗、问你和 Trip 之间出什么事了',
    content: {
      director_note: '你趁机跟 Grace 在阳台上聊了几句。她的手指一直在摩挲着酒杯的边缘。她说"你知道我最讨厌什么吗？不是他不欣赏我的画。是他从来不想了解画画对我来说意味着什么。" 她顿了顿，压低了声音，像是在做一个决定："有件事我从没告诉过任何人。"',
      tone: '一个人终于决定说出那个秘密之前的一秒',
    },
    effects: [
      { type: 'set_flag', key: 'grace_exposed', value: true },
      { type: 'increment_quality', key: 'tension', amount: 1.5 },
    ],
    conditional_effects: [],
    repeatability: 'never',
    cooldown: undefined,
    sticky: false,
    priority_override: undefined,
    salience: { base: 13, modifiers: [] },
    on_interrupt: 'pause',
    completion_trigger: undefined,
    force_wrap_up: undefined,
  },

  // ─── act3: 分支 Landmark 专属 ───
  {
    id: 'sl_trip_affair_detail',
    title: 'Trip 的秘密',
    phase_tags: ['act3', 'trip_path'],
    narrative_goal: 'Trip 说出自己的婚外情，以及他无法接受和一个"艺术家"结婚。',
    conditions: [
      { type: 'flag_check', key: 'trip_confessed', op: '==', value: true },
      { type: 'flag_check', key: 'trip_detail_revealed', op: '==', value: false },
    ],
    llm_trigger: undefined,
    content: {
      director_note: 'Trip 终于说出来了。他说他遇见了一个人，一个"能听他说话的人"。他承认这不对，但他说 Grace 从来不关心他的感受，只关心她的画和窗帘。然后他说了一句更重的话："我没办法和一个艺术家结婚。她活在幻想里，我活在现实里。" Grace 从卧室门口听到了这句话，整个人僵住了。',
      tone: '一句把所有伪装都撕碎的话',
    },
    effects: [
      { type: 'set_flag', key: 'trip_detail_revealed', value: true },
      { type: 'increment_quality', key: 'tension', amount: 1.5 },
    ],
    conditional_effects: [],
    repeatability: 'never',
    cooldown: undefined,
    sticky: false,
    priority_override: undefined,
    salience: { base: 14, modifiers: [] },
    on_interrupt: 'pause',
    completion_trigger: undefined,
    force_wrap_up: undefined,
  },
  {
    id: 'sl_grace_vince_detail',
    title: 'Vince',
    phase_tags: ['act3', 'grace_path'],
    narrative_goal: 'Grace 说出与 Vince 的事，以及她八年来一直背着这份内疚生活的痛苦。',
    conditions: [
      { type: 'flag_check', key: 'grace_exposed', op: '==', value: true },
      { type: 'flag_check', key: 'grace_detail_revealed', op: '==', value: false },
    ],
    llm_trigger: undefined,
    content: {
      director_note: 'Grace 说出了名字。Vince。大学同学，学艺术的。在 Trip 求婚的前一天晚上，她和 Vince 在一起。她说她不知道为什么，也许是害怕，也许是迷茫。"从那天起我就觉得这段婚姻是被诅咒的。" 她的声音在发抖，但表情很平静，像排练过无数次。Trip 站在客厅里，酒杯从手里滑落，碎在地上。',
      tone: '八年积压在一句话里',
    },
    effects: [
      { type: 'set_flag', key: 'grace_detail_revealed', value: true },
      { type: 'increment_quality', key: 'tension', amount: 1.5 },
    ],
    conditional_effects: [],
    repeatability: 'never',
    cooldown: undefined,
    sticky: false,
    priority_override: undefined,
    salience: { base: 14, modifiers: [] },
    on_interrupt: 'pause',
    completion_trigger: undefined,
    force_wrap_up: undefined,
  },

  // ─── act4: 摊牌（合并） ───
  {
    id: 'sl_honest_moment',
    title: '坦诚的瞬间',
    phase_tags: ['act4'],
    narrative_goal: '秘密已经全部摊开。Trip 和 Grace 需要面对真实的彼此。',
    conditions: [
      { type: 'flag_check', key: 'secrets_revealed', op: '==', value: true },
      { type: 'flag_check', key: 'honest_conversation', op: '==', value: false },
    ],
    llm_trigger: '玩家劝他们好好谈、对 Trip 说你好好听 Grace 说、对 Grace 说你给 Trip 一个机会、说你们都有错',
    content: {
      director_note: '客厅里只剩下三个人和一地的碎酒杯。Trip 坐在沙发边缘，Grace 靠着墙。长久的沉默之后，Trip 先开口了，声音比平时轻了很多："我也许……不该说那些话。" Grace 没有看他，但她没有走。这是今晚第一次，两个人没有在互相攻击。',
      tone: '暴风雨之后最安静的一分钟',
    },
    effects: [
      { type: 'set_flag', key: 'honest_conversation', value: true },
      { type: 'decrement_quality', key: 'tension', amount: 1 },
    ],
    conditional_effects: [],
    repeatability: 'never',
    cooldown: undefined,
    sticky: false,
    priority_override: undefined,
    salience: {
      base: 14,
      modifiers: [{ key: 'player_mediated', threshold: 1, bonus: 3, penalty: 0 }],
    },
    on_interrupt: 'pause',
    completion_trigger: undefined,
    force_wrap_up: undefined,
  },
  {
    id: 'sl_final_decision',
    title: '最终决定',
    phase_tags: ['act4'],
    narrative_goal: 'Grace 和 Trip 必须做出选择——这段婚姻还要不要继续。',
    conditions: [
      { type: 'flag_check', key: 'honest_conversation', op: '==', value: true },
      { type: 'flag_check', key: 'final_decision_made', op: '==', value: false },
    ],
    llm_trigger: undefined,
    content: {
      director_note: 'Trip 看着 Grace，问了一个他们结婚以来从没问过的问题："你想让我留下吗？" Grace 沉默了很久。她看向窗外，又看向那面她花了几个星期刷白的墙，最后看向你。她在等你的反应，好像你的回答会影响她的决定。',
      tone: '所有的体面都剥落了，只剩下最真实的问题',
    },
    effects: [],
    conditional_effects: [
      {
        condition: { type: 'flag_check', key: 'player_mediated', op: '==', value: true },
        effects: [
          { type: 'set_flag', key: 'final_decision_made', value: true },
          { type: 'decrement_quality', key: 'tension', amount: 0.5 },
        ],
      },
    ],
    repeatability: 'never',
    cooldown: undefined,
    sticky: false,
    priority_override: undefined,
    salience: { base: 14, modifiers: [] },
    on_interrupt: 'pause',
    completion_trigger: undefined,
    force_wrap_up: undefined,
  },

  // ─── 通用兜底 ───
  {
    id: 'sl_generic',
    title: '日常回应',
    phase_tags: ['act1', 'act2', 'act3', 'act4', 'trip_path', 'grace_path'],
    narrative_goal: '一般性回应。Trip 和 Grace 的反应带着各自的情绪底色。',
    conditions: [],
    llm_trigger: undefined,
    content: {
      director_note: 'Trip 和 Grace 的反应是社交性的，但总有什么地方不对。Trip 的话比平时多了一点或少了一点，Grace 的笑容比平时浅了一点。你作为老朋友，能感觉到他们之间的空气是紧绷的。',
      tone: '表面社交，暗流涌动',
    },
    effects: [],
    conditional_effects: [],
    repeatability: 'unlimited',
    cooldown: undefined,
    sticky: false,
    priority_override: undefined,
    salience: { base: 1, modifiers: [] },
    on_interrupt: 'continue',
    completion_trigger: undefined,
    force_wrap_up: undefined,
  },
]

// ─── 默认库数据（Design 模式可编辑）───────────────────────────────────

export const defaultActionLibrary: ActionEntry[] = [
  { id: 'walk_to', label: '走到', description: '移动到目标地点', parameters: ['target_location'] },
  { id: 'pick_up', label: '拿起', description: '拾取物品', parameters: ['prop'] },
  { id: 'put_down', label: '放下', description: '放下物品', parameters: ['prop'] },
  { id: 'give', label: '递给', description: '将物品递给某人', parameters: ['prop', 'target'] },
  { id: 'gesture', label: '手势', description: '做出手势', parameters: ['gesture_type'] },
  { id: 'look_at', label: '看向', description: '注视目标', parameters: ['target'] },
  { id: 'sit_down', label: '坐下', description: '坐下', parameters: [] },
  { id: 'stand_up', label: '站起来', description: '站立', parameters: [] },
  { id: 'pour', label: '倒', description: '倒饮料', parameters: ['prop'] },
  { id: 'sigh', label: '叹气', description: '叹气', parameters: [] },
  { id: 'laugh', label: '笑', description: '笑', parameters: [] },
  { id: 'say', label: '说话', description: '说出对话内容，触发唇形动画', parameters: ['dialogue'] },
  { id: 'pause', label: '停顿', description: '停顿思考', parameters: [] },
]

export const defaultExpressionLibrary: ExpressionEntry[] = [
  { id: 'neutral', label: '中性', animation_name: 'neutral' },
  { id: 'happy', label: '开心', animation_name: 'smile' },
  { id: 'sad', label: '难过', animation_name: 'sad' },
  { id: 'angry', label: '生气', animation_name: 'angry' },
  { id: 'thinking', label: '思考', animation_name: 'thinking' },
  { id: 'embarrassed', label: '尴尬', animation_name: 'embarrassed' },
  { id: 'smirk', label: '得意', animation_name: 'smirk' },
  { id: 'confused', label: '困惑', animation_name: 'confused' },
]

export const defaultPropLibrary: PropEntry[] = [
  { id: 'wine_glass', label: '酒杯' },
  { id: 'bottle', label: '酒瓶' },
  { id: 'plate', label: '盘子' },
  { id: 'napkin', label: '餐巾' },
  { id: 'cushion', label: '靠垫' },
]

export const defaultLocationLibrary: LocationEntry[] = [
  { id: 'living_room', label: '客厅', adjacent: ['kitchen', 'dining_room'] },
  { id: 'kitchen', label: '厨房', adjacent: ['living_room'] },
  { id: 'dining_room', label: '餐厅', adjacent: ['living_room'] },
  { id: 'balcony', label: '阳台', adjacent: ['living_room'] },
]
