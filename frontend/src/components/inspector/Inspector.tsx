import { useState, useEffect } from 'react'
import { Box, Flag, Layers } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { Landmark, WorldStateEffect } from '../../types'
import KeyInput from '../shared/KeyInput'
import TransitionsTab from './TransitionsTab'
import StoryletPool from './StoryletPool'

export default function Inspector() {
  const selectedId = useStore((s) => s.selectedLandmarkId)
  const selectedIds = useStore((s) => s.selectedLandmarkIds)
  const landmarks = useStore((s) => s.landmarks)
  const updateLandmark = useStore((s) => s.updateLandmark)
  const inspectorTab = useStore((s) => s.inspectorTab)
  const setInspectorTab = useStore((s) => s.setInspectorTab)
  const inspectorWidth = useStore((s) => s.inspectorWidth)

  const landmark = landmarks.find((l) => l.id === selectedId)

  // 多选时显示批量提示
  if (selectedIds.length > 1) {
    const selectedLandmarks = selectedIds
      .map((id) => landmarks.find((l) => l.id === id))
      .filter(Boolean) as Landmark[]
    return (
      <div className="bevel-out" style={{
        width: inspectorWidth, flexShrink: 0,
        borderLeft: '2px solid #808080',
        background: '#C0C0C0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '12px', padding: '24px',
      }}>
        <div style={{ fontSize: '32px', opacity: 0.4 }}><Layers size={32} color="#000080" /></div>
        <div style={{ color: '#000', fontSize: '14px', fontWeight: 600 }}>
          已选中 {selectedIds.length} 个节点
        </div>
        <div style={{ color: '#444', fontSize: '12px', textAlign: 'center', lineHeight: 1.6 }}>
          可拖拽移动全部选中节点<br />按 Delete 键批量删除
        </div>
        <div style={{ color: '#808080', fontSize: '11px', textAlign: 'center', lineHeight: 1.5, marginTop: '8px' }}>
          {selectedLandmarks.map((l) => l.title || l.id).join('、')}
        </div>
      </div>
    )
  }

  if (!selectedId || !landmark) {
    return (
      <div className="bevel-out" style={{
        width: inspectorWidth, flexShrink: 0,
        background: '#C0C0C0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '12px', padding: '24px',
      }}>
        <div style={{ fontSize: '32px', opacity: 0.3 }}><Box size={32} color="#808080" /></div>
        <div style={{ color: '#808080', fontSize: '13px', textAlign: 'center' }}>
          点击蓝图中的节点<br />查看并编辑属性
        </div>
      </div>
    )
  }

  return (
    <div className="bevel-out" style={{
      width: inspectorWidth, flexShrink: 0,
      background: '#C0C0C0',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', height: '100%',
    }}>
      {/* 节点标题栏 — 90s */}
      <div className="panel-header" style={{ padding: '4px 10px' }}>
        {landmark.is_ending ? <Flag size={16} color="#800080" /> : <Box size={16} color="#000080" />}
        <span style={{ fontWeight: 700, fontSize: '12px' }}>{landmark.title}</span>
        <span style={{ fontSize: '10px', marginLeft: 'auto', fontFamily: '"Courier New",monospace', opacity: 0.7 }}>
          id:{landmark.id}
        </span>
      </div>

      {/* Tabs — 90s */}
      <div className="bevel-out" style={{
        display: 'flex', margin: '3px', overflow: 'hidden',
      }}>
        {(['properties', 'transitions'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setInspectorTab(tab)}
            style={{
              flex: 1, padding: '3px 0', fontSize: '11px', fontWeight: 600,
              background: inspectorTab === tab ? '#000080' : '#C0C0C0',
              border: 'none', cursor: 'pointer',
              color: inspectorTab === tab ? '#fff' : '#000',
              fontFamily: '"MS Sans Serif", sans-serif',
              transition: 'background 0.1s',
            }}
          >
            {tab === 'properties' ? '属性' : `出边 (${landmark.transitions.length})`}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {inspectorTab === 'properties'
          ? <PropertiesTab landmark={landmark} onUpdate={updateLandmark} />
          : <TransitionsTab landmark={landmark} onUpdate={updateLandmark} landmarks={landmarks} />
        }
      </div>

      {/* Storylet Pool（始终显示在 Inspector 底部） */}
      <StoryletPool landmark={landmark} />
    </div>
  )
}

// ── 属性 Tab ─────────────────────────────────────────────────────────────────

function PropertiesTab({
  landmark,
  onUpdate,
}: {
  landmark: Landmark
  onUpdate: (id: string, patch: Partial<Landmark>) => void
}) {
  const [form, setForm] = useState({ ...landmark })

  useEffect(() => { setForm({ ...landmark }) }, [landmark.id])

  const save = () => onUpdate(landmark.id, form)

  const set = (key: keyof Landmark, value: unknown) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Field label="ID">
        <input
          value={form.id} readOnly
          style={{ ...inputStyle, background: '#d0d0d0', cursor: 'not-allowed' }}
        />
      </Field>

      <Field label="标题">
        <input
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          onBlur={save}
          style={inputStyle}
        />
      </Field>

      <Field label="描述">
        <textarea
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          onBlur={save}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </Field>

      <Field label="Phase Tag">
        <input
          value={form.phase_tag}
          onChange={(e) => set('phase_tag', e.target.value)}
          onBlur={save}
          style={inputStyle}
          placeholder="act1, act2, ending ..."
        />
      </Field>

      <div style={{ display: 'flex', gap: '10px' }}>
        <Field label="是否结局" style={{ flex: 1 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.is_ending}
              onChange={(e) => { set('is_ending', e.target.checked); setTimeout(save, 50) }}
              style={{ width: '16px', height: '16px', accentColor: '#0000FF' }}
            />
            <span style={{ color: '#444', fontSize: '12px' }}>is_ending</span>
          </label>
        </Field>
      </div>

      {form.is_ending && (
        <Field label="结局文本">
          <textarea
            value={form.ending_content}
            onChange={(e) => set('ending_content', e.target.value)}
            onBlur={save}
            rows={4}
            style={{ ...inputStyle, resize: 'vertical' }}
            placeholder="结局叙事文本..."
          />
        </Field>
      )}

      <SectionTitle>叙事约束</SectionTitle>

      <Field label="禁止揭露的信息">
        <TagInput
          tags={form.narrative_constraints?.forbidden_reveals ?? []}
          onChange={(tags) => {
            set('narrative_constraints', { ...form.narrative_constraints, forbidden_reveals: tags })
            setTimeout(save, 50)
          }}
        />
      </Field>
    </div>
  )
}

// ── 小型子组件 ────────────────────────────────────────────────────────────────

function Field({
  label, children, style,
}: {
  label: string
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div style={style}>
      <div style={{ color: '#444', fontSize: '11px', marginBottom: '4px', fontWeight: 600 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      color: '#000', fontSize: '11px', fontWeight: 700,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      paddingTop: '4px', paddingBottom: '2px',
      borderTop: '2px solid #808080',
    }}>
      {children}
    </div>
  )
}

function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState('')
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
        {tags.map((tag) => (
          <span
            key={tag}
            className="bevel-out"
            style={{
              background: '#d0d0ff',
              padding: '1px 6px',
              fontSize: '11px', color: '#000080',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            {tag}
            <button
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              style={{ background: 'none', border: 'none', color: '#808080', cursor: 'pointer', fontSize: '12px', lineHeight: 1 }}
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
          style={{ ...inputStyle, flex: 1 }}
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

function EffectListEditor({
  effects,
  onChange,
}: {
  effects: WorldStateEffect[]
  onChange: (effects: WorldStateEffect[]) => void
}) {
  const addEffect = () =>
    onChange([...effects, { type: 'set_flag', key: '', value: true }])

  const updateEffect = (i: number, patch: Partial<WorldStateEffect>) => {
    const next = effects.map((e, idx) => idx === i ? { ...e, ...patch } : e)
    onChange(next)
  }

  const removeEffect = (i: number) => onChange(effects.filter((_, idx) => idx !== i))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {effects.map((effect, i) => (
        <div key={i} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <select
            value={effect.type}
            onChange={(e) => updateEffect(i, { type: e.target.value as WorldStateEffect['type'] })}
            style={{ ...selectStyle, width: '120px' }}
          >
            <option value="set_flag">set_flag</option>
            <option value="set_quality">set_quality</option>
            <option value="increment_quality">increment</option>
            <option value="decrement_quality">decrement</option>
          </select>
          <KeyInput
            value={effect.key}
            onChange={(key) => updateEffect(i, { key })}
            filter={effect.type.includes('flag') ? 'flag' : 'quality'}
            style={{ fontSize: '11px' }}
            placeholder="key"
          />
          {(effect.type === 'set_flag' || effect.type === 'set_quality') ? (
            <input
              value={String(effect.value ?? '')}
              onChange={(e) => updateEffect(i, { value: e.target.value })}
              style={{ ...inputStyle, width: '60px', fontSize: '11px' }}
              placeholder="val"
            />
          ) : (
            <input
              type="number"
              value={effect.amount ?? 1}
              onChange={(e) => updateEffect(i, { amount: Number(e.target.value) })}
              style={{ ...inputStyle, width: '50px', fontSize: '11px' }}
            />
          )}
          <button onClick={() => removeEffect(i)} style={removeBtnStyle}>×</button>
        </div>
      ))}
      <button onClick={addEffect} style={addBtnStyle}>+ 添加效果</button>
    </div>
  )
}

// ── 共用样式 ──────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '3px 6px',
  background: '#ffffff', border: '2px solid',
  borderColor: '#808080 #ffffff #ffffff #808080',
  boxShadow: 'inset 1px 1px 0 #404040, inset -1px -1px 0 #dfdfdf',
  borderRadius: '0', color: '#000', fontSize: '11px',
  outline: 'none', fontFamily: '"MS Sans Serif", sans-serif',
}

const selectStyle: React.CSSProperties = {
  padding: '3px 4px',
  background: '#ffffff', border: '2px solid',
  borderColor: '#808080 #ffffff #ffffff #808080',
  borderRadius: '0', color: '#000', fontSize: '11px',
  outline: 'none', cursor: 'pointer',
  fontFamily: '"MS Sans Serif", sans-serif',
}

const addBtnStyle: React.CSSProperties = {
  padding: '3px 10px',
  background: '#C0C0C0', border: '2px solid',
  borderColor: '#ffffff #808080 #808080 #ffffff',
  borderRadius: '0', color: '#0000FF', fontSize: '12px',
  cursor: 'pointer', whiteSpace: 'nowrap',
  fontFamily: '"MS Sans Serif", sans-serif',
  fontWeight: 600,
}

const removeBtnStyle: React.CSSProperties = {
  width: '24px', height: '24px', flexShrink: 0,
  background: '#C0C0C0', border: '2px solid',
  borderColor: '#ffffff #808080 #808080 #ffffff',
  borderRadius: '0', color: '#FF0000', fontSize: '14px',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}

export { inputStyle, selectStyle, addBtnStyle, removeBtnStyle }
