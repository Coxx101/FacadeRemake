import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { QualityDef, FlagDef, RelationshipDef } from '../../types'

type Tab = 'qualities' | 'flags' | 'relationships'

// ── 90s 样式常量 ──
const COLORS: Record<Tab, { color: string; label: string }> = {
  qualities:     { color: '#0000FF', label: 'QUALITIES' },
  flags:         { color: '#FF00FF', label: 'FLAGS' },
  relationships: { color: '#FF0000', label: 'RELATIONS' },
}

// ── 主组件 ──
export default function WorldStatePanel() {
  const [tab, setTab] = useState<Tab>('qualities')
  const inspectorWidth = useStore((s) => s.inspectorWidth)
  const wsd = useStore((s) => s.worldStateDefinition)
  const updateWSD = useStore((s) => s.updateWorldStateDefinition)

  const totalCount = wsd.qualities.length + wsd.flags.length + wsd.relationships.length
  const data = tab === 'qualities' ? wsd.qualities : tab === 'flags' ? wsd.flags : wsd.relationships
  const tc = COLORS[tab]

  return (
    <div style={{ width: inspectorWidth, flexShrink: 0, background: '#C0C0C0', display: 'flex', flexDirection: 'column' }}>
      {/* panel-header */}
      <div className="panel-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>WorldState</span>
        <span style={{ marginLeft: 'auto', fontFamily: '"Courier New",monospace', fontSize: '10px', fontWeight: 400, opacity: 0.8 }}>
          {totalCount} vars
        </span>
      </div>

      {/* tab row — bevel buttons */}
      <div style={{ display: 'flex', padding: '4px 6px', gap: '3px', borderBottom: '2px solid #808080' }}>
        {(Object.keys(COLORS) as Tab[]).map(k => {
          const c = COLORS[k]
          const active = tab === k
          const cnt = k === 'qualities' ? wsd.qualities.length : k === 'flags' ? wsd.flags.length : wsd.relationships.length
          return (
            <button key={k} onClick={() => setTab(k)}
              className={active ? 'bevel-in' : 'bevel-out'}
              style={{
                flex: 1, padding: '4px 0',
                background: active ? '#ffffff' : '#C0C0C0',
                color: active ? c.color : '#000',
                fontSize: '11px', fontWeight: 600,
                fontFamily: '"MS Sans Serif", sans-serif',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
              }}>
              <span style={{ color: c.color }}>●</span>
              {c.label}
              <span style={{ fontSize: '10px', color: active ? c.color : '#808080', fontWeight: 700 }}>
                ({cnt})
              </span>
            </button>
          )
        })}
      </div>

      {/* content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {data.length === 0 && (
          <div style={{ padding: '24px 12px', textAlign: 'center', color: '#808080', fontSize: '11px', fontFamily: '"MS Sans Serif",sans-serif' }}>
            暂无变量 — 点击下方按钮添加
          </div>
        )}
        {tab === 'qualities' && data.map((q, i) => (
          <QualityRow key={(q as QualityDef).key} item={q as QualityDef} index={i}
            onChange={(v) => updateWSD({ qualities: data.map((x, idx) => idx === i ? v : x) as QualityDef[] })}
            onDelete={() => { if (confirm(`删除「${(q as QualityDef).label}」？`)) updateWSD({ qualities: (data as QualityDef[]).filter((_, idx) => idx !== i) }) }} />
        ))}
        {tab === 'flags' && data.map((f, i) => (
          <FlagRow key={(f as FlagDef).key} item={f as FlagDef} index={i}
            onChange={(v) => updateWSD({ flags: data.map((x, idx) => idx === i ? v : x) as FlagDef[] })}
            onDelete={() => { if (confirm(`删除「${(f as FlagDef).label}」？`)) updateWSD({ flags: (data as FlagDef[]).filter((_, idx) => idx !== i) }) }} />
        ))}
        {tab === 'relationships' && data.map((r, i) => (
          <RelationshipRow key={(r as RelationshipDef).key} item={r as RelationshipDef} index={i}
            onChange={(v) => updateWSD({ relationships: data.map((x, idx) => idx === i ? v : x) as RelationshipDef[] })}
            onDelete={() => { if (confirm(`删除「${(r as RelationshipDef).label}」？`)) updateWSD({ relationships: (data as RelationshipDef[]).filter((_, idx) => idx !== i) }) }} />
        ))}

        {/* add button */}
        <div style={{ padding: '6px 8px' }}>
          <button onClick={() => {
            if (tab === 'qualities') updateWSD({ qualities: [...(data as QualityDef[]), { key: `q_${data.length + 1}`, label: '新品质', initial: 0, min: 0, max: 10, description: '' }] })
            else if (tab === 'flags') updateWSD({ flags: [...(data as FlagDef[]), { key: `f_${data.length + 1}`, label: '新标记', initial: false, description: '' }] })
            else updateWSD({ relationships: [...(data as RelationshipDef[]), { key: `r_${data.length + 1}`, label: '新关系', initial: 5, min: 0, max: 10, description: '' }] })
          }} className="bevel-out" style={{
            width: '100%', padding: '4px 0', background: '#C0C0C0',
            color: tc.color, fontSize: '11px', fontWeight: 600, cursor: 'pointer',
            fontFamily: '"MS Sans Serif", sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
          }}>
            <Plus size={12} /> 添加{tc.label}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 通用 field 样式 ──
const FIELD: React.CSSProperties = {
  background: '#ffffff',
  border: '2px solid',
  borderColor: '#808080 #ffffff #ffffff #808080',
  boxShadow: 'inset 1px 1px 0 #404040, inset -1px -1px 0 #dfdfdf',
  borderRadius: '0',
  color: '#000',
  fontSize: '11px',
  padding: '3px 6px',
  outline: 'none',
  fontFamily: '"MS Sans Serif", sans-serif',
  boxSizing: 'border-box',
}

const LABEL: React.CSSProperties = {
  fontSize: '10px', color: '#000', fontFamily: '"MS Sans Serif", sans-serif', whiteSpace: 'nowrap' as const,
}

const ROW: React.CSSProperties = {
  padding: '6px 8px',
  borderBottom: '1px solid #d0d0d0',
  display: 'flex', flexDirection: 'column', gap: '4px',
}

// ── 删除按钮 ──
function DelBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="bevel-out"
      style={{ background: '#C0C0C0', color: '#FF0000', cursor: 'pointer', padding: '2px 4px', fontWeight: 700 }}>
      <Trash2 size={12} />
    </button>
  )
}

// ── Quality ──
function QualityRow({ item, index: _i, onChange, onDelete }: {
  item: QualityDef; index: number; onChange: (v: QualityDef) => void; onDelete: () => void
}) {
  const set = (patch: Partial<QualityDef>) => onChange({ ...item, ...patch })
  return (
    <div style={ROW}>
      <div style={{ display: 'flex', gap: '6px' }}>
        <input style={{ ...FIELD, flex: 1 }} value={item.key} placeholder="key"
          onChange={e => set({ key: e.target.value })} />
        <input style={{ ...FIELD, flex: 1 }} value={item.label} placeholder="显示名称"
          onChange={e => set({ label: e.target.value })} />
        <DelBtn onClick={onDelete} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={LABEL}>初始</span>
        <input type="number" style={{ ...FIELD, width: '56px' }} value={item.initial}
          onChange={e => set({ initial: parseFloat(e.target.value) || 0 })} />
        <span style={LABEL}>范围</span>
        <input type="number" style={{ ...FIELD, width: '50px' }} value={item.min ?? ''} placeholder="min"
          onChange={e => set({ min: e.target.value ? parseFloat(e.target.value) : undefined })} />
        <span style={{ ...LABEL, color: '#808080' }}>~</span>
        <input type="number" style={{ ...FIELD, width: '50px' }} value={item.max ?? ''} placeholder="max"
          onChange={e => set({ max: e.target.value ? parseFloat(e.target.value) : undefined })} />
      </div>
      <input style={{ ...FIELD }} value={item.description || ''} placeholder="描述（可选）"
        onChange={e => set({ description: e.target.value })} />
    </div>
  )
}

// ── Flag ──
function FlagRow({ item, index: _i, onChange, onDelete }: {
  item: FlagDef; index: number; onChange: (v: FlagDef) => void; onDelete: () => void
}) {
  const set = (patch: Partial<FlagDef>) => onChange({ ...item, ...patch })
  return (
    <div style={ROW}>
      <div style={{ display: 'flex', gap: '6px' }}>
        <input style={{ ...FIELD, flex: 1 }} value={item.key} placeholder="key"
          onChange={e => set({ key: e.target.value })} />
        <input style={{ ...FIELD, flex: 1 }} value={item.label} placeholder="显示名称"
          onChange={e => set({ label: e.target.value })} />
        <DelBtn onClick={onDelete} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={LABEL}>初始</span>
        <select style={{ ...FIELD, width: '80px' }} value={String(item.initial)}
          onChange={e => set({ initial: e.target.value === 'true' })}>
          <option value="false">false</option>
          <option value="true">true</option>
        </select>
      </div>
      <input style={{ ...FIELD }} value={item.description || ''} placeholder="描述（可选）"
        onChange={e => set({ description: e.target.value })} />
    </div>
  )
}

// ── Relationship ──
function RelationshipRow({ item, index: _i, onChange, onDelete }: {
  item: RelationshipDef; index: number; onChange: (v: RelationshipDef) => void; onDelete: () => void
}) {
  const set = (patch: Partial<RelationshipDef>) => onChange({ ...item, ...patch })
  return (
    <div style={ROW}>
      <div style={{ display: 'flex', gap: '6px' }}>
        <input style={{ ...FIELD, flex: 1 }} value={item.key} placeholder="key"
          onChange={e => set({ key: e.target.value })} />
        <input style={{ ...FIELD, flex: 1 }} value={item.label} placeholder="显示名称"
          onChange={e => set({ label: e.target.value })} />
        <DelBtn onClick={onDelete} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={LABEL}>初始</span>
        <input type="number" style={{ ...FIELD, width: '56px' }} value={item.initial}
          onChange={e => set({ initial: parseFloat(e.target.value) || 0 })} />
        <span style={LABEL}>范围</span>
        <input type="number" style={{ ...FIELD, width: '50px' }} value={item.min ?? ''} placeholder="min"
          onChange={e => set({ min: e.target.value ? parseFloat(e.target.value) : undefined })} />
        <span style={{ ...LABEL, color: '#808080' }}>~</span>
        <input type="number" style={{ ...FIELD, width: '50px' }} value={item.max ?? ''} placeholder="max"
          onChange={e => set({ max: e.target.value ? parseFloat(e.target.value) : undefined })} />
      </div>
      <input style={{ ...FIELD }} value={item.description || ''} placeholder="描述（可选）"
        onChange={e => set({ description: e.target.value })} />
    </div>
  )
}
