import { useState } from 'react'
import { Plus, Trash2, Hash, ToggleLeft, Heart, ChevronRight } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { QualityDef, FlagDef, RelationshipDef } from '../../types'

type Tab = 'qualities' | 'flags' | 'relationships'

const TAB_CONFIG: { key: Tab; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'qualities', label: '品质', icon: <Hash size={13} />, color: '#4f6ef7' },
  { key: 'flags', label: '标记', icon: <ToggleLeft size={13} />, color: '#2ecc71' },
  { key: 'relationships', label: '关系', icon: <Heart size={13} />, color: '#e67e22' },
]

// ── 通用样式常量 ──
const S = {
  panel: {
    background: '#1a1d27',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  header: {
    padding: '14px 16px',
    borderBottom: '1px solid #2e3250',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  tabRow: {
    display: 'flex',
    gap: '2px',
    padding: '8px 12px',
    borderBottom: '1px solid #2e3250',
  },
  list: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '8px 0',
  },
  item: {
    padding: '10px 16px',
    borderBottom: '1px solid #1e2130',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    transition: 'background 0.1s',
    cursor: 'default',
  },
  input: {
    background: '#131828',
    border: '1px solid #2e3250',
    borderRadius: '6px',
    color: '#e8eaf0',
    fontSize: '12px',
    padding: '6px 10px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  btn: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '4px',
    padding: '5px 12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid #2e3250',
    borderRadius: '6px',
    color: '#8891b0',
    fontSize: '12px',
    fontWeight: 500 as const,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
}

export default function WorldStatePanel() {
  const [tab, setTab] = useState<Tab>('qualities')
  const inspectorWidth = useStore((s) => s.inspectorWidth)
  const wsd = useStore((s) => s.worldStateDefinition)
  const updateWSD = useStore((s) => s.updateWorldStateDefinition)

  const tabConf = TAB_CONFIG.find((t) => t.key === tab)!

  return (
    <div style={{ ...S.panel, width: inspectorWidth, flexShrink: 0 }}>
      {/* Header */}
      <div style={S.header}>
        <ChevronRight size={14} color={tabConf.color} />
        <span style={{ color: '#e8eaf0', fontSize: '14px', fontWeight: 700 }}>WorldState</span>
        <span style={{ color: '#4a5070', fontSize: '11px', marginLeft: 'auto' }}>
          {wsd.qualities.length + wsd.flags.length + wsd.relationships.length} 个变量
        </span>
      </div>

      {/* Tab Row */}
      <div style={S.tabRow}>
        {TAB_CONFIG.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: '6px 0', background: tab === t.key ? t.color + '20' : 'none',
            border: 'none', borderBottom: tab === t.key ? `2px solid ${t.color}` : '2px solid transparent',
            color: tab === t.key ? t.color : '#4a5070',
            fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
            transition: 'all 0.15s',
          }}>
            {t.icon} {t.label}
            <span style={{
              fontSize: '10px', padding: '1px 6px', borderRadius: '10px',
              background: tab === t.key ? t.color + '30' : '#1e2130',
              color: tab === t.key ? t.color : '#4a5070',
            }}>
              {t.key === 'qualities' ? wsd.qualities.length : t.key === 'flags' ? wsd.flags.length : wsd.relationships.length}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={S.list}>
        {tab === 'qualities' && <QualitySection items={wsd.qualities} onChange={(q) => updateWSD({ qualities: q })} />}
        {tab === 'flags' && <FlagSection items={wsd.flags} onChange={(f) => updateWSD({ flags: f })} />}
        {tab === 'relationships' && <RelationshipSection items={wsd.relationships} onChange={(r) => updateWSD({ relationships: r })} />}
      </div>
    </div>
  )
}

// ── Quality Section ──

function QualitySection({ items, onChange }: { items: QualityDef[]; onChange: (items: QualityDef[]) => void }) {
  const add = () => {
    onChange([...items, { key: `quality_${items.length + 1}`, label: '新品质', initial: 0, min: 0, max: 10, description: '' }])
  }
  const remove = (i: number) => {
    if (window.confirm(`确认删除「${items[i].label}」？`)) onChange(items.filter((_, idx) => idx !== i))
  }
  const update = (i: number, patch: Partial<QualityDef>) => {
    const next = items.map((it, idx) => (idx === i ? { ...it, ...patch } : it))
    onChange(next)
  }

  return (
    <>
      {items.length === 0 && <EmptyHint text="暂无品质变量" onAdd={add} />}
      {items.map((q, i) => (
        <div key={q.key} style={S.item}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#1e2130' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input style={{ ...S.input, flex: 1 }} value={q.key} placeholder="变量 key"
              onChange={(e) => update(i, { key: e.target.value })} />
            <button onClick={() => remove(i)} title="删除" style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
              color: '#4a5070', borderRadius: '4px', transition: 'color 0.15s',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#e74c3c' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#4a5070' }}>
              <Trash2 size={14} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input style={{ ...S.input, flex: 1 }} value={q.label} placeholder="显示名称"
              onChange={(e) => update(i, { label: e.target.value })} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ color: '#4a5070', fontSize: '11px', whiteSpace: 'nowrap' }}>初始值</label>
            <input type="number" style={{ ...S.input, width: '70px' }} value={q.initial}
              onChange={(e) => update(i, { initial: parseFloat(e.target.value) || 0 })} />
            <label style={{ color: '#4a5070', fontSize: '11px', whiteSpace: 'nowrap' }}>范围</label>
            <input type="number" style={{ ...S.input, width: '60px' }} value={q.min ?? ''}
              placeholder="min" onChange={(e) => update(i, { min: e.target.value ? parseFloat(e.target.value) : undefined })} />
            <span style={{ color: '#2e3250' }}>~</span>
            <input type="number" style={{ ...S.input, width: '60px' }} value={q.max ?? ''}
              placeholder="max" onChange={(e) => update(i, { max: e.target.value ? parseFloat(e.target.value) : undefined })} />
          </div>
          <input style={{ ...S.input }} value={q.description} placeholder="描述（可选）"
            onChange={(e) => update(i, { description: e.target.value })} />
        </div>
      ))}
      {items.length > 0 && (
        <div style={{ padding: '8px 16px' }}>
          <button onClick={add} style={{ ...S.btn, color: '#4f6ef7', borderColor: '#4f6ef740' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#4f6ef710' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}>
            <Plus size={13} /> 添加品质
          </button>
        </div>
      )}
    </>
  )
}

// ── Flag Section ──

function FlagSection({ items, onChange }: { items: FlagDef[]; onChange: (items: FlagDef[]) => void }) {
  const add = () => {
    onChange([...items, { key: `flag_${items.length + 1}`, label: '新标记', initial: false, description: '' }])
  }
  const remove = (i: number) => {
    if (window.confirm(`确认删除「${items[i].label}」？`)) onChange(items.filter((_, idx) => idx !== i))
  }
  const update = (i: number, patch: Partial<FlagDef>) => {
    const next = items.map((it, idx) => (idx === i ? { ...it, ...patch } : it))
    onChange(next)
  }

  return (
    <>
      {items.length === 0 && <EmptyHint text="暂无标记变量" onAdd={add} />}
      {items.map((f, i) => (
        <div key={f.key} style={S.item}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#1e2130' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input style={{ ...S.input, flex: 1 }} value={f.key} placeholder="变量 key"
              onChange={(e) => update(i, { key: e.target.value })} />
            <button onClick={() => remove(i)} title="删除" style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
              color: '#4a5070', borderRadius: '4px', transition: 'color 0.15s',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#e74c3c' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#4a5070' }}>
              <Trash2 size={14} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input style={{ ...S.input, flex: 1 }} value={f.label} placeholder="显示名称"
              onChange={(e) => update(i, { label: e.target.value })} />
            <label style={{ color: '#4a5070', fontSize: '11px', whiteSpace: 'nowrap' }}>初始值</label>
            <select style={{ ...S.input, width: '80px' }} value={String(f.initial)}
              onChange={(e) => {
                const v = e.target.value
                update(i, { initial: v === 'true' ? true : v === 'false' ? false : isNaN(Number(v)) ? v : Number(v) })
              }}>
              <option value="false">false</option>
              <option value="true">true</option>
            </select>
          </div>
          <input style={{ ...S.input }} value={f.description} placeholder="描述（可选）"
            onChange={(e) => update(i, { description: e.target.value })} />
        </div>
      ))}
      {items.length > 0 && (
        <div style={{ padding: '8px 16px' }}>
          <button onClick={add} style={{ ...S.btn, color: '#2ecc71', borderColor: '#2ecc7140' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#2ecc7110' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}>
            <Plus size={13} /> 添加标记
          </button>
        </div>
      )}
    </>
  )
}

// ── Relationship Section ──

function RelationshipSection({ items, onChange }: { items: RelationshipDef[]; onChange: (items: RelationshipDef[]) => void }) {
  const add = () => {
    onChange([...items, { key: `rel_${items.length + 1}`, label: '新关系', initial: 5, min: 0, max: 10, description: '' }])
  }
  const remove = (i: number) => {
    if (window.confirm(`确认删除「${items[i].label}」？`)) onChange(items.filter((_, idx) => idx !== i))
  }
  const update = (i: number, patch: Partial<RelationshipDef>) => {
    const next = items.map((it, idx) => (idx === i ? { ...it, ...patch } : it))
    onChange(next)
  }

  return (
    <>
      {items.length === 0 && <EmptyHint text="暂无关系变量" onAdd={add} />}
      {items.map((r, i) => (
        <div key={r.key} style={S.item}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#1e2130' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input style={{ ...S.input, flex: 1 }} value={r.key} placeholder="变量 key（如 father_mother）"
              onChange={(e) => update(i, { key: e.target.value })} />
            <button onClick={() => remove(i)} title="删除" style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
              color: '#4a5070', borderRadius: '4px', transition: 'color 0.15s',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#e74c3c' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#4a5070' }}>
              <Trash2 size={14} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input style={{ ...S.input, flex: 1 }} value={r.label} placeholder="显示名称（如 赵建国 ↔ 林美华）"
              onChange={(e) => update(i, { label: e.target.value })} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ color: '#4a5070', fontSize: '11px', whiteSpace: 'nowrap' }}>初始值</label>
            <input type="number" style={{ ...S.input, width: '70px' }} value={r.initial}
              onChange={(e) => update(i, { initial: parseFloat(e.target.value) || 0 })} />
            <label style={{ color: '#4a5070', fontSize: '11px', whiteSpace: 'nowrap' }}>范围</label>
            <input type="number" style={{ ...S.input, width: '60px' }} value={r.min ?? ''}
              placeholder="min" onChange={(e) => update(i, { min: e.target.value ? parseFloat(e.target.value) : undefined })} />
            <span style={{ color: '#2e3250' }}>~</span>
            <input type="number" style={{ ...S.input, width: '60px' }} value={r.max ?? ''}
              placeholder="max" onChange={(e) => update(i, { max: e.target.value ? parseFloat(e.target.value) : undefined })} />
          </div>
          <input style={{ ...S.input }} value={r.description} placeholder="描述（可选）"
            onChange={(e) => update(i, { description: e.target.value })} />
        </div>
      ))}
      {items.length > 0 && (
        <div style={{ padding: '8px 16px' }}>
          <button onClick={add} style={{ ...S.btn, color: '#e67e22', borderColor: '#e67e2240' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#e67e2210' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}>
            <Plus size={13} /> 添加关系
          </button>
        </div>
      )}
    </>
  )
}

// ── Empty Hint ──

function EmptyHint({ text, onAdd }: { text: string; onAdd: () => void }) {
  return (
    <div style={{ padding: '32px 16px', textAlign: 'center' }}>
      <div style={{ color: '#4a5070', fontSize: '12px', marginBottom: '12px' }}>{text}</div>
      <button onClick={onAdd} style={{ ...S.btn, margin: '0 auto', color: '#8891b0' }}>
        <Plus size={13} /> 添加
      </button>
    </div>
  )
}
