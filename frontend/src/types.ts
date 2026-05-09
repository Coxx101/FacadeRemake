// ─── 核心数据类型（与 Python 后端数据结构一一对应）───────────────────────

export interface Condition {
  type: 'flag_check' | 'quality_check' | 'player_input_keyword'
  key: string
  op: '==' | '!=' | '>' | '>=' | '<' | '<='
  value: string | number | boolean
}

export interface WorldStateEffect {
  type: 'set_flag' | 'set_quality' | 'increment_quality' | 'decrement_quality'
  key: string
  value?: string | number | boolean
  amount?: number
}

export interface LandmarkTransition {
  target_id: string
  conditions: Condition[]
  turn_limit?: number
  storylet_count?: number
  is_fallback: boolean
  label: string
}

export interface NarrativeConstraints {
  allowed_storylet_tags?: string[]
  forbidden_reveals?: string[]
}

export interface Landmark {
  id: string
  title: string
  description: string
  phase_tag: string
  is_ending: boolean
  ending_content: string
  transitions: LandmarkTransition[]
  max_storylets?: number
  narrative_constraints: NarrativeConstraints
  world_state_effects_on_enter: WorldStateEffect[]
  fallback_storylet?: string
  // 布局信息（仅前端使用，不导出到 Python）
  position?: { x: number; y: number }
}

// ─── Storylet ────────────────────────────────────────────────────────────────

export interface SalienceModifier {
  key: string
  threshold: number
  bonus: number
  penalty: number
}

export interface Salience {
  base: number
  modifiers: SalienceModifier[]
}

export interface ConditionalEffect {
  condition: Condition
  effects: WorldStateEffect[]
}

export interface CompletionTrigger {
  type: 'turn_count' | 'flag_check' | 'quality_check'
  value?: number | string | boolean
  key?: string
  op?: string
}

export interface Storylet {
  id: string
  title: string
  phase_tags: string[]
  narrative_goal: string
  // 前置条件
  conditions: Condition[]
  llm_trigger?: string
  // 内容
  content: Record<string, unknown>
  // 后置效果
  effects: WorldStateEffect[]
  conditional_effects: ConditionalEffect[]
  // 调度
  repeatability: 'never' | 'unlimited' | 'cooldown'
  cooldown?: number
  sticky: boolean
  priority_override?: number
  // Salience
  salience: Salience
  // 演出
  on_interrupt: 'pause' | 'abort' | 'continue'
  // 结束触发
  completion_trigger?: CompletionTrigger
  force_wrap_up?: CompletionTrigger
}

// ─── 角色设定 ──────────────────────────────────────────────────────────────────

export interface MonologueTemplate {
  id: string
  ref_secret: string
  category: string
  monologue: string
  emotion_tags: string[]
}

export interface CharacterProfile {
  id: string            // 'trip', 'grace', 'player' …
  name: string          // 显示名
  identity: string      // 角色身份描述（注入 system prompt）
  personality: string   // 性格描述
  background: string[]  // 背景条目列表
  secret_knowledge: string[]  // 秘密知识条目
  ng_words: string[]    // 禁用词
  monologues: MonologueTemplate[]  // 内心独白模板
}

export interface SharedContext {
  marriage_secret: {
    grace_affair_with_vince?: boolean
    vince_is_college_friend?: boolean
    grace_slept_with_vince_before_proposal?: boolean
    trip_also_had_affair?: boolean
    grace_doesnt_know_trip_affair?: boolean
    trip_cant_stand_grace_being_artist?: boolean
    class_difference?: boolean
  }
  key_events: Record<string, string>
}

// ─── WorldState 定义（前端编辑器预定义的变量模板）────────────────────
// 供 Play 模式初始化 WorldState 使用，也供 Design 模式中的
// Condition / WorldStateEffect 编辑器自动补全。

export interface QualityDef {
  key: string
  label: string
  initial: number
  min?: number
  max?: number
  description: string
}

export interface FlagDef {
  key: string
  label: string
  initial: string | number | boolean
  description: string
}

export interface RelationshipDef {
  key: string        // 格式 'charA_charB'，如 'father_mother'
  label: string      // 如 '赵建国 ↔ 林美华'
  initial: number
  min?: number
  max?: number
  description: string
}

export interface WorldStateDefinition {
  qualities: QualityDef[]
  flags: FlagDef[]
  relationships: RelationshipDef[]
}

// ─── 库定义（Design 模式可编辑）───────────────────────────────────────────────

export interface ActionEntry {
  id: string
  label: string
  description: string
  parameters: string[]
}

export interface ExpressionEntry {
  id: string
  label: string
  animation_name: string
}

export interface PropEntry {
  id: string
  label: string
}

export interface LocationEntry {
  id: string
  label: string
  adjacent?: string[]
}

// ─── 应用状态类型 ─────────────────────────────────────────────────────────────

export type AppMode = 'home' | 'design' | 'play'
export type RightPanel = 'inspector' | 'characters' | 'worldstate'

// ─── 故事项目（localStorage 持久化）───────────────────────────────────

export interface StoryProjectMeta {
  id: string
  name: string
  description: string
  createdAt: string   // ISO 8601
  updatedAt: string   // ISO 8601
  /** 编辑器数据快照 */
  snapshot: {
    landmarks: Landmark[]
    storylets: Storylet[]
    characters: CharacterProfile[]
    sharedContext: SharedContext
    worldStateDefinition: WorldStateDefinition
    actionLibrary: ActionEntry[]
    expressionLibrary: ExpressionEntry[]
    propLibrary: PropEntry[]
    locationLibrary: LocationEntry[]
  }
}
