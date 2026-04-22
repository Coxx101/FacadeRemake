import { useState, useEffect, useCallback } from 'react'
import { Users, ChevronLeft, Pin } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { CharacterProfile, MonologueTemplate, BehaviorMeta } from '../../types'
import {
  inputStyle, selectStyle, addBtnStyle, removeBtnStyle,
} from '../inspector/Inspector'

// ── 主面板 ──────────────────────────────────────────────────────────────────

export default function CharactersPanel() {
  const characters = useStore((s) => s.characters)
  const selectedId = useStore((s) => s.selectedCharacterId)
  const selectCharacter = useStore((s) => s.selectCharacter)
  const addCharacter = useStore((s) => s.addCharacter)
  const deleteCharacter = useStore((s) => s.deleteCharacter)
  const inspectorWidth = useStore((s) => s.inspectorWidth)

  const selected = characters.find((c) => c.id === selectedId)

  const handleAdd = () => {
    const id = `char_${Date.now()}`
    addCharacter({
      id, name: '新角色', identity: '', personality: '',
      background: [], secret_knowledge: [], ng_words: [], monologues: [],
      behaviors: [], behavior_meta: {},
    })
    selectCharacter(id)
  }

  const handleDelete = (id: string) => {
    const ch = characters.find((c) => c.id === id)
    if (!ch) return
    if (window.confirm(`确认删除角色「${ch.name}」？`)) {
      deleteCharacter(id)
    }
  }

  return (
    <div style={{
      width: inspectorWidth, flexShrink: 0,
      borderLeft: '1px solid #2e3250',
      background: '#1a1d27',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', height: '100%',
    }}>
      {/* 标题栏 */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid #2e3250',
        background: '#1e2130',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}><Users size={16} color="#e8eaf0" /></span>
          <span style={{ color: '#e8eaf0', fontWeight: 700, fontSize: '14px' }}>
            角色设定
          </span>
        </div>
        <button onClick={handleAdd} style={addBtnStyle}>+ 新建角色</button>
      </div>

      {/* 内容区 */}
      {selected ? (
        <CharacterEditor character={selected} />
      ) : (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          overflow: 'auto', padding: '12px',
        }}>
          {characters.length === 0 ? (
            <div style={{ color: '#4a5070', fontSize: '13px', textAlign: 'center', marginTop: '40px' }}>
              暂无角色，点击上方按钮新建
            </div>
          ) : (
            characters.map((ch) => (
              <CharacterCard
                key={ch.id}
                character={ch}
                isSelected={ch.id === selectedId}
                onSelect={() => selectCharacter(ch.id)}
                onDelete={() => handleDelete(ch.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── 角色卡片 ────────────────────────────────────────────────────────────────

function CharacterCard({
  character,
  isSelected,
  onSelect,
  onDelete,
}: {
  character: CharacterProfile
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        padding: '12px', marginBottom: '8px', borderRadius: '8px',
        border: `1px solid ${isSelected ? '#4f6ef7' : '#2e3250'}`,
        background: isSelected ? '#1e2a4a' : '#131828',
        cursor: 'pointer', transition: 'all 0.15s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: '#e8eaf0', fontWeight: 600, fontSize: '13px' }}>
            {character.name || character.id}
          </div>
          <div style={{ color: '#4a5070', fontSize: '11px', fontFamily: 'monospace' }}>
            {character.id}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          style={{ ...removeBtnStyle, width: '20px', height: '20px', fontSize: '12px' }}
          title="删除角色"
        >×</button>
      </div>
      {character.personality && (
        <div style={{ color: '#8891b0', fontSize: '11px', marginTop: '6px', lineHeight: 1.4 }}>
          {character.personality.slice(0, 60)}{character.personality.length > 60 ? '...' : ''}
        </div>
      )}
      <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
        <span style={{ fontSize: '10px', color: '#4f6ef7', background: '#1e2a4a', padding: '1px 6px', borderRadius: '3px' }}>
          {character.secret_knowledge.length} 秘密
        </span>
        <span style={{ fontSize: '10px', color: '#f5a623', background: '#2a2518', padding: '1px 6px', borderRadius: '3px' }}>
          {character.monologues.length} 独白
        </span>
      </div>
    </div>
  )
}

// ── 角色编辑器 ──────────────────────────────────────────────────────────────

function CharacterEditor({ character }: { character: CharacterProfile }) {
  const updateCharacter = useStore((s) => s.updateCharacter)
  const selectCharacter = useStore((s) => s.selectCharacter)

  const undoCount = useStore((s) => s._undoCount)
  const redoCount = useStore((s) => s._redoCount)

  const [form, setForm] = useState({ ...character })

  // 切换角色 或 撤销/重做时 同步表单
  useEffect(() => { setForm({ ...character }) }, [character.id, character, undoCount, redoCount])

  const save = useCallback(() => {
    updateCharacter(character.id, form)
  }, [character.id, form, updateCharacter])

  const set = <K extends keyof CharacterProfile>(key: K, value: CharacterProfile[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    identity: true,
    personality: true,
    background: true,
    secrets: true,
    monologues: true,
    ng_words: false,
    behaviors: false,
  })

  const toggleSection = (key: string) => {
    setExpandedSections((s) => ({ ...s, [key]: !s[key] }))
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 返回按钮 + 角色名（固定高度） */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid #2e3250',
        display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0,
      }}>
        <button
          onClick={() => selectCharacter(null)}
          style={{
            background: 'none', border: '1px solid #2e3250', borderRadius: '4px',
            color: '#8891b1', fontSize: '12px', padding: '2px 8px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '4px',
          }}
        ><ChevronLeft size={14} /> 返回</button>
        <input
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          onBlur={save}
          placeholder="角色名称"
          style={{ ...inputStyle, flex: 1, fontWeight: 600 }}
        />
        <span style={{ color: '#4a5070', fontSize: '11px', fontFamily: 'monospace' }}>
          {form.id}
        </span>
      </div>

      {/* 编辑表单（flex 填满剩余空间，自然滚动） */}
      <div style={{
        flex: 1, minHeight: 0,
        overflowY: 'auto', padding: '12px 16px',
      }}>

        {/* 身份描述 */}
        <CollapsibleSection title="角色身份" subtitle="注入 system prompt" expanded={expandedSections.identity} onToggle={() => toggleSection('identity')}>
          <textarea
            value={form.identity}
            onChange={(e) => set('identity', e.target.value)}
            onBlur={save}
            rows={8}
            style={{ ...inputStyle, resize: 'vertical', fontSize: '12px', lineHeight: 1.6 }}
            placeholder="角色的身份、处境和内心状态描述..."
          />
        </CollapsibleSection>

        {/* 性格 */}
        <CollapsibleSection title="性格特征" expanded={expandedSections.personality} onToggle={() => toggleSection('personality')}>
          <input
            value={form.personality}
            onChange={(e) => set('personality', e.target.value)}
            onBlur={save}
            style={inputStyle}
            placeholder="简短描述角色性格..."
          />
        </CollapsibleSection>

        {/* 背景条目 */}
        <CollapsibleSection title={`背景 (${form.background.length})`} expanded={expandedSections.background} onToggle={() => toggleSection('background')}>
          <StringListEditor
            items={form.background}
            onChange={(items) => { set('background', items); setTimeout(save, 50) }}
            placeholder="输入背景信息..."
          />
        </CollapsibleSection>

        {/* 秘密知识 */}
        <CollapsibleSection title={`秘密知识 (${form.secret_knowledge.length})`} expanded={expandedSections.secrets} onToggle={() => toggleSection('secrets')}>
          <StringListEditor
            items={form.secret_knowledge}
            onChange={(items) => { set('secret_knowledge', items); setTimeout(save, 50) }}
            placeholder="如：只有系统知道：xxx / 他自己知道：xxx / 他不知道：xxx"
          />
        </CollapsibleSection>

        {/* 内心独白模板 */}
        <CollapsibleSection title={`内心独白 (${form.monologues.length})`} expanded={expandedSections.monologues} onToggle={() => toggleSection('monologues')}>
          <MonologueListEditor
            monologues={form.monologues}
            onChange={(monologues) => { set('monologues', monologues); setTimeout(save, 50) }}
          />
        </CollapsibleSection>

        {/* 禁用词 */}
        <CollapsibleSection title={`禁用词 (${form.ng_words.length})`} expanded={expandedSections.ng_words} onToggle={() => toggleSection('ng_words')}>
          <TagInput
            tags={form.ng_words}
            onChange={(tags) => { set('ng_words', tags); setTimeout(save, 50) }}
          />
        </CollapsibleSection>

        {/* 行为库 */}
        <CollapsibleSection title={`行为库 (${form.behaviors?.length ?? 0})`} expanded={expandedSections.behaviors ?? false} onToggle={() => toggleSection('behaviors')}>
          <BehaviorListEditor
            behaviorIds={form.behaviors ?? []}
            behaviorMeta={form.behavior_meta ?? {}}
            onChange={(behaviors, behavior_meta) => { set('behaviors', behaviors); set('behavior_meta', behavior_meta); setTimeout(save, 50) }}
          />
        </CollapsibleSection>

      </div>
    </div>
  )
}

// ── 独白列表编辑器 ──────────────────────────────────────────────────────────

function MonologueListEditor({
  monologues,
  onChange,
}: {
  monologues: MonologueTemplate[]
  onChange: (monologues: MonologueTemplate[]) => void
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const add = () => {
    onChange([...monologues, {
      id: `mon_${Date.now()}`,
      ref_secret: '',
      category: '',
      monologue: '',
      emotion_tags: [],
    }])
  }

  const update = (idx: number, patch: Partial<MonologueTemplate>) => {
    onChange(monologues.map((m, i) => i === idx ? { ...m, ...patch } : m))
  }

  const remove = (idx: number) => {
    onChange(monologues.filter((_, i) => i !== idx))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {monologues.map((m, i) => {
        const isExpanded = expanded[m.id] ?? false
        return (
          <div key={m.id} style={{
            border: '1px solid #2e3250', borderRadius: '6px', overflow: 'hidden',
          }}>
            {/* 独白头部（可折叠） */}
            <div
              onClick={() => setExpanded((s) => ({ ...s, [m.id]: !isExpanded }))}
              style={{
                padding: '8px 10px', cursor: 'pointer',
                background: isExpanded ? '#1e2a4a' : '#131828',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                <span style={{ color: '#8891b0', fontSize: '11px' }}>
                  {isExpanded ? '▼' : '▶'}
                </span>
                {m.category && (
                  <span style={{
                    fontSize: '10px', color: '#f5a623', background: '#2a2518',
                    padding: '1px 6px', borderRadius: '3px', flexShrink: 0,
                  }}>
                    {m.category}
                  </span>
                )}
                <span style={{
                  color: '#8891b0', fontSize: '11px',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {m.monologue.slice(0, 40) || '(空独白)'}
                </span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); remove(i) }}
                style={removeBtnStyle}
                title="删除独白"
              >×</button>
            </div>

            {/* 展开的编辑表单 */}
            {isExpanded && (
              <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #2e3250' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#4a5070', fontSize: '10px', marginBottom: '3px' }}>类别</div>
                    <input
                      value={m.category}
                      onChange={(e) => update(i, { category: e.target.value })}
                      style={{ ...inputStyle, fontSize: '11px' }}
                      placeholder="核心秘密 / 现实压力 ..."
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#4a5070', fontSize: '10px', marginBottom: '3px' }}>情绪标签</div>
                    <TagInput
                      tags={m.emotion_tags}
                      onChange={(tags) => update(i, { emotion_tags: tags })}
                    />
                  </div>
                </div>
                <div>
                  <div style={{ color: '#4a5070', fontSize: '10px', marginBottom: '3px' }}>关联秘密</div>
                  <input
                    value={m.ref_secret}
                    onChange={(e) => update(i, { ref_secret: e.target.value })}
                    style={{ ...inputStyle, fontSize: '11px' }}
                    placeholder="引用 secret_knowledge 中的条目"
                  />
                </div>
                <div>
                  <div style={{ color: '#4a5070', fontSize: '10px', marginBottom: '3px' }}>内心独白</div>
                  <textarea
                    value={m.monologue}
                    onChange={(e) => update(i, { monologue: e.target.value })}
                    rows={3}
                    style={{ ...inputStyle, fontSize: '11px', lineHeight: 1.5, resize: 'vertical' }}
                    placeholder="第一人称情感化内心独白..."
                  />
                </div>
              </div>
            )}
          </div>
        )
      })}
      <button onClick={add} style={addBtnStyle}>+ 添加独白</button>
    </div>
  )
}

// ── 字符串列表编辑器（用于 background、secret_knowledge） ──────────────────

function StringListEditor({
  items,
  onChange,
  placeholder,
}: {
  items: string[]
  onChange: (items: string[]) => void
  placeholder: string
}) {
  const [input, setInput] = useState('')
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')

  const addItem = () => {
    if (input.trim()) {
      onChange([...items, input.trim()])
      setInput('')
    }
  }

  const startEdit = (idx: number) => {
    setEditingIdx(idx)
    setEditValue(items[idx])
  }

  const confirmEdit = () => {
    if (editingIdx !== null) {
      const updated = items.map((item, i) => i === editingIdx ? editValue.trim() : item)
      onChange(updated)
      setEditingIdx(null)
    }
  }

  const cancelEdit = () => {
    setEditingIdx(null)
    setEditValue('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {editingIdx === i ? (
            <input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { confirmEdit(); e.preventDefault() }
                if (e.key === 'Escape') cancelEdit()
              }}
              onBlur={confirmEdit}
              autoFocus
              style={{ ...inputStyle, flex: 1, fontSize: '11px' }}
            />
          ) : (
            <span
              onDoubleClick={() => startEdit(i)}
              style={{
                flex: 1, fontSize: '11px', color: '#c0c8e0',
                background: '#131828', padding: '5px 8px', borderRadius: '4px',
                border: '1px solid #2e3250', wordBreak: 'break-all',
                cursor: 'text',
              }}
              title="双击编辑"
            >
              {item}
            </span>
          )}
          <button onClick={() => onChange(items.filter((_, idx) => idx !== i))} style={removeBtnStyle}>×</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && input.trim()) {
              addItem()
              e.preventDefault()
            }
          }}
          style={{ ...inputStyle, flex: 1, fontSize: '11px' }}
          placeholder={placeholder}
        />
        <button onClick={addItem} style={addBtnStyle}>+</button>
      </div>
    </div>
  )
}

// ── 标签输入（复用 Inspector 的 TagInput 简化版） ────────────────────────────

function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState('')
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
        {tags.map((tag) => (
          <span
            key={tag}
            style={{
              background: '#1e2a4a', border: '1px solid #2e3a60',
              borderRadius: '4px', padding: '2px 8px',
              fontSize: '11px', color: '#7090e0',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            {tag}
            <button
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              style={{ background: 'none', border: 'none', color: '#4a5070', cursor: 'pointer', fontSize: '12px', lineHeight: 1 }}
            >×</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
              onChange([...tags, input.trim()])
              setInput('')
              e.preventDefault()
            }
          }}
          style={{ ...inputStyle, flex: 1, fontSize: '11px' }}
          placeholder="输入后按 Enter 添加"
        />
        <button
          onClick={() => {
            if (input.trim()) { onChange([...tags, input.trim()]); setInput('') }
          }}
          style={addBtnStyle}
        >+</button>
      </div>
    </div>
  )
}

// ── 行为列表编辑器 ──────────────────────────────────────────────────────────

function BehaviorListEditor({
  behaviorIds,
  behaviorMeta,
  onChange,
}: {
  behaviorIds: string[]
  behaviorMeta: Record<string, BehaviorMeta>
  onChange: (ids: string[], meta: Record<string, BehaviorMeta>) => void
}) {
  const addBehavior = () => {
    const id = prompt('输入行为 ID（英文，如 deflect）：')
    if (!id || !id.trim()) return
    const trimmed = id.trim().toLowerCase().replace(/\s+/g, '_')
    if (behaviorIds.includes(trimmed)) return
    const newMeta: Record<string, BehaviorMeta> = {
      ...behaviorMeta,
      [trimmed]: { id: trimmed, label: trimmed, description: '', tone_hint: 'neutral', salience_boost: 0 },
    }
    onChange([...behaviorIds, trimmed], newMeta)
  }

  const removeBehavior = (id: string) => {
    const newMeta = { ...behaviorMeta }
    delete newMeta[id]
    onChange(behaviorIds.filter((b) => b !== id), newMeta)
  }

  const updateMeta = (id: string, patch: Partial<BehaviorMeta>) => {
    const meta = behaviorMeta[id]
    if (!meta) return
    onChange(behaviorIds, { ...behaviorMeta, [id]: { ...meta, ...patch } })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {behaviorIds.map((bid) => {
        const meta = behaviorMeta[bid]
        return (
          <div key={bid} style={{
            border: '1px solid #2e3250', borderRadius: '4px',
            padding: '6px 8px', background: '#131828',
            display: 'flex', flexDirection: 'column', gap: '4px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#7090e0', fontSize: '11px', fontFamily: 'monospace', fontWeight: 600 }}>
                {bid}
              </span>
              <button onClick={() => removeBehavior(bid)} style={removeBtnStyle} title="删除行为">×</button>
            </div>
            <input
              value={meta?.label ?? ''}
              onChange={(e) => updateMeta(bid, { label: e.target.value })}
              style={{ ...inputStyle, fontSize: '11px' }}
              placeholder="中文标签（如：转移话题）"
            />
            <input
              value={meta?.description ?? ''}
              onChange={(e) => updateMeta(bid, { description: e.target.value })}
              style={{ ...inputStyle, fontSize: '11px' }}
              placeholder="行为描述（供 LLM 参考）"
            />
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                value={meta?.tone_hint ?? ''}
                onChange={(e) => updateMeta(bid, { tone_hint: e.target.value })}
                style={{ ...inputStyle, fontSize: '11px', width: '50%' }}
                placeholder="tone_hint（如：guarded）"
              />
              <input
                type="number"
                value={meta?.salience_boost ?? 0}
                onChange={(e) => updateMeta(bid, { salience_boost: parseInt(e.target.value) || 0 })}
                style={{ ...inputStyle, fontSize: '11px', width: '50%' }}
                placeholder="salience_boost"
              />
            </div>
          </div>
        )
      })}
      <button onClick={addBehavior} style={addBtnStyle}>+ 添加行为</button>
    </div>
  )
}

// ── 折叠区块 ────────────────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  subtitle,
  expanded,
  onToggle,
  children,
}: {
  title: string
  subtitle?: string
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div style={{ border: '1px solid #2e3250', borderRadius: '6px', overflow: 'hidden' }}>
      <div
        onClick={onToggle}
        style={{
          padding: '8px 12px', cursor: 'pointer',
          background: expanded ? '#1e2130' : '#151828',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <span style={{ color: '#e8eaf0', fontSize: '12px', fontWeight: 600 }}>
          {expanded ? '▼ ' : '▶ '}{title}
        </span>
        {subtitle && <span style={{ color: '#4a5070', fontSize: '10px' }}>{subtitle}</span>}
      </div>
      {expanded && (
        <div style={{ padding: '10px 12px', borderTop: '1px solid #2e3250' }}>
          {children}
        </div>
      )}
    </div>
  )
}
