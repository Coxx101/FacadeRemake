/**
 * WorldState 变量变更的级联同步工具。
 *
 * 当 WorldStateDefinition 中的变量被删除或重命名时，
 * 需要级联清理 / 替换所有 Landmark 和 Storylet 中引用了这些 key 的
 * Condition、WorldStateEffect、SalienceModifier、CompletionTrigger。
 */

import type {
  Landmark,
  Storylet,
  WorldStateDefinition,
  Condition,
  WorldStateEffect,
  SalienceModifier,
  CompletionTrigger,
} from '../types'

// ── 收集所有有效 key ──

function allValidKeys(wsd: WorldStateDefinition): Set<string> {
  const keys = new Set<string>()
  for (const q of wsd.qualities) keys.add(q.key)
  for (const f of wsd.flags) keys.add(f.key)
  for (const r of wsd.relationships) keys.add(r.key)
  return keys
}

// ── 清理单条 Condition：移除无效 key，替换改名 key ──

function cleanCondition(c: Condition, validKeys: Set<string>, renameMap: Map<string, string>): Condition | null {
  const resolved = renameMap.get(c.key) ?? c.key
  if (!validKeys.has(resolved)) return null
  return c.key === resolved ? c : { ...c, key: resolved }
}

// ── 清理单条 WorldStateEffect ──

function cleanEffect(e: WorldStateEffect, validKeys: Set<string>, renameMap: Map<string, string>): WorldStateEffect | null {
  const resolved = renameMap.get(e.key) ?? e.key
  if (!validKeys.has(resolved)) return null
  return e.key === resolved ? e : { ...e, key: resolved }
}

// ── 清理 SalienceModifier ──

function cleanModifier(m: SalienceModifier, validKeys: Set<string>, renameMap: Map<string, string>): SalienceModifier | null {
  const resolved = renameMap.get(m.key) ?? m.key
  if (!validKeys.has(resolved)) return null
  return m.key === resolved ? m : { ...m, key: resolved }
}

// ── 清理 CompletionTrigger ──

function cleanTrigger(t: CompletionTrigger, validKeys: Set<string>, renameMap: Map<string, string>): CompletionTrigger | null {
  if (!t.key) return t  // turn_count 类型没有 key
  const resolved = renameMap.get(t.key) ?? t.key
  if (!validKeys.has(resolved)) return null
  return t.key === resolved ? t : { ...t, key: resolved }
}

// ── 清理 Condition 数组 ──

function cleanConditions(conds: Condition[], validKeys: Set<string>, renameMap: Map<string, string>): Condition[] {
  return conds.map((c) => cleanCondition(c, validKeys, renameMap)).filter((c): c is Condition => c !== null)
}

// ── 清理 WorldStateEffect 数组 ──

function cleanEffects(effs: WorldStateEffect[], validKeys: Set<string>, renameMap: Map<string, string>): WorldStateEffect[] {
  return effs.map((e) => cleanEffect(e, validKeys, renameMap)).filter((e): e is WorldStateEffect => e !== null)
}

// ── 清理 Landmark ──

function cleanLandmark(lm: Landmark, validKeys: Set<string>, renameMap: Map<string, string>): Landmark {
  return {
    ...lm,
    transitions: lm.transitions.map((tr) => ({
      ...tr,
      conditions: cleanConditions(tr.conditions, validKeys, renameMap),
    })),
    world_state_effects_on_enter: cleanEffects(lm.world_state_effects_on_enter, validKeys, renameMap),
  }
}

// ── 清理 Storylet ──

function cleanStorylet(st: Storylet, validKeys: Set<string>, renameMap: Map<string, string>): Storylet {
  return {
    ...st,
    conditions: cleanConditions(st.conditions, validKeys, renameMap),
    effects: cleanEffects(st.effects, validKeys, renameMap),
    conditional_effects: st.conditional_effects
      .map((ce) => {
        const cond = cleanCondition(ce.condition, validKeys, renameMap)
        const effs = cleanEffects(ce.effects, validKeys, renameMap)
        if (!cond && effs.length === 0) return null
        return {
          condition: cond ?? { type: 'flag_check', key: '__always_true__', op: '==', value: true },
          effects: effs,
        }
      })
      .filter((ce): ce is NonNullable<typeof ce> => ce !== null),
    salience: {
      ...st.salience,
      modifiers: st.salience.modifiers
        .map((m) => cleanModifier(m, validKeys, renameMap))
        .filter((m): m is SalienceModifier => m !== null),
    },
    completion_trigger: st.completion_trigger
      ? cleanTrigger(st.completion_trigger, validKeys, renameMap) ?? undefined
      : undefined,
    force_wrap_up: st.force_wrap_up
      ? cleanTrigger(st.force_wrap_up, validKeys, renameMap) ?? undefined
      : undefined,
  }
}

// ── 构建重命名映射（旧 key → 新 key）──

function buildRenameMap(oldWSD: WorldStateDefinition, newWSD: WorldStateDefinition): Map<string, string> {
  const map = new Map<string, string>()

  // 合并所有旧 key → 新 key
  const oldEntries: Array<{ key: string; kind: string }> = [
    ...oldWSD.qualities.map((q) => ({ key: q.key, kind: 'q' })),
    ...oldWSD.flags.map((f) => ({ key: f.key, kind: 'f' })),
    ...oldWSD.relationships.map((r) => ({ key: r.key, kind: 'r' })),
  ]
  const newEntries: Array<{ key: string; kind: string }> = [
    ...newWSD.qualities.map((q) => ({ key: q.key, kind: 'q' })),
    ...newWSD.flags.map((f) => ({ key: f.key, kind: 'f' })),
    ...newWSD.relationships.map((r) => ({ key: r.key, kind: 'r' })),
  ]

  // 按位置匹配：同一类型数组中相同索引位置的就是同一条变量
  const maxLen = Math.max(oldEntries.length, newEntries.length)
  for (let i = 0; i < maxLen; i++) {
    const oldE = oldEntries[i]
    const newE = newEntries[i]
    // 只在同类同位置匹配时才视为改名
    if (oldE && newE && oldE.kind === newE.kind && oldE.key !== newE.key) {
      map.set(oldE.key, newE.key)
    }
  }

  return map
}

// ── 主函数 ──

/**
 * 根据 WorldStateDefinition 的变更，级联清理所有 landmark 和 storylet。
 *
 * - 被删除的变量 key：移除所有引用该 key 的 condition / effect / modifier / trigger
 * - 被重命名的变量 key：替换为新的 key
 */
export function cascadeWorldStateChange(
  oldWSD: WorldStateDefinition,
  newWSD: WorldStateDefinition,
  landmarks: Landmark[],
  storylets: Storylet[],
): { landmarks: Landmark[]; storylets: Storylet[] } {
  const validKeys = allValidKeys(newWSD)
  const renameMap = buildRenameMap(oldWSD, newWSD)

  return {
    landmarks: landmarks.map((lm) => cleanLandmark(lm, validKeys, renameMap)),
    storylets: storylets.map((st) => cleanStorylet(st, validKeys, renameMap)),
  }
}
