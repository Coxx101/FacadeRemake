import { useState, useEffect } from 'react'
import {
  ClipboardList, Lock, Zap, Timer, BarChart3, CheckCircle2,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { Storylet, Condition, WorldStateEffect, SalienceModifier } from '../../types'
import { inputStyle, selectStyle, addBtnStyle, removeBtnStyle } from '../inspector/Inspector'
import KeyInput from '../shared/KeyInput'

const TABS = [
  { key: 'basic',      icon: <ClipboardList size={15} />, label: '基础' },
  { key: 'conditions', icon: <Lock size={15} />,         label: '条件' },
  { key: 'effects',    icon: <Zap size={15} />,          label: '效果' },
  { key: 'schedule',   icon: <Timer size={15} />,        label: '调度' },
  { key: 'salience',   icon: <BarChart3 size={15} />,    label: 'Salience' },
  { key: 'completion', icon: <CheckCircle2 size={15} />, label: '完成' },
] as const

type TabKey = typeof TABS[number]['key']

export default function StoryletModal() {
  const isOpen = useStore((s) => s.isStoryletModalOpen)
  const selectedId = useStore((s) => s.selectedStoryletId)
  const storylets = useStore((s) => s.storylets)
  const saveStorylet = useStore((s) => s.saveStorylet)
  const closeModal = useStore((s) => s.closeStoryletModal)

  const original = storylets.find((sl) => sl.id === selectedId)
  const [form, setForm] = useState<Storylet | null>(original ?? null)
  const [tab, setTab] = useState<TabKey>('basic')

  useEffect(() => {
    if (original) {
      setForm({ ...original })
      setTab('basic')
    }
  }, [selectedId])

  if (!isOpen || !form) return null

  const set = <K extends keyof Storylet>(key: K, value: Storylet[K]) => {
    setForm((f) => f ? { ...f, [key]: value } : f)
  }

  const handleSave = () => {
    if (form) { saveStorylet(form); closeModal() }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
    >
      <div
        className="fade-in"
        style={{
          width: '720px', maxHeight: '85vh',
          background: '#1a1d27', border: '1px solid #2e3250',
          borderRadius: '12px', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
        }}
      >
        {/* 头部 */}
        <div style={{
          padding: '16px 20px', background: '#1e2130',
          borderBottom: '1px solid #2e3250',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ color: '#4a5070', fontSize: '11px', fontFamily: 'monospace' }}>
              Storylet
            </div>
            <div style={{ color: '#e8eaf0', fontWeight: 700, fontSize: '16px' }}>
              {form.title || form.id}
            </div>
          </div>
          <button
            onClick={closeModal}
            style={{
              width: '32px', height: '32px', background: 'rgba(255,255,255,0.05)',
              border: '1px solid #2e3250', borderRadius: '8px',
              color: '#8891b0', fontSize: '18px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </div>

        {/* 主体：左侧 Tab + 右侧内容 */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* 左侧 Tab 列 */}
          <div style={{
            width: '120px', flexShrink: 0, borderRight: '1px solid #2e3250',
            background: '#131828', padding: '8px 0',
          }}>
            {TABS.map(({ key, icon, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  width: '100%', padding: '10px 14px',
                  background: tab === key ? '#1e2a4a' : 'none',
                  border: 'none', borderLeft: `2px solid ${tab === key ? '#4f6ef7' : 'transparent'}`,
                  color: tab === key ? '#4f6ef7' : '#8891b0',
                  fontSize: '12px', fontWeight: tab === key ? 600 : 400,
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                  gap: '8px', textAlign: 'left',
                  transition: 'all 0.15s',
                }}
              >
                <span>{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* 右侧内容区 */}
          <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
            {tab === 'basic'      && <BasicTab form={form} set={set} />}
            {tab === 'conditions' && <ConditionsTab form={form} set={set} />}
            {tab === 'effects'    && <EffectsTab form={form} set={set} />}
            {tab === 'schedule'   && <ScheduleTab form={form} set={set} />}
            {tab === 'salience'   && <SalienceTab form={form} set={set} />}
            {tab === 'completion' && <CompletionTab form={form} set={set} />}
          </div>
        </div>

        {/* 底部按钮 */}
        <div style={{
          padding: '14px 20px', borderTop: '1px solid #2e3250',
          display: 'flex', justifyContent: 'flex-end', gap: '10px',
          background: '#1e2130',
        }}>
          <button onClick={closeModal} style={{
            padding: '8px 20px', background: 'none',
            border: '1px solid #2e3250', borderRadius: '8px',
            color: '#8891b0', fontSize: '13px', cursor: 'pointer',
          }}>
            取消
          </button>
          <button onClick={handleSave} style={{
            padding: '8px 24px',
            background: 'linear-gradient(135deg, #4f6ef7 0%, #3a56d4 100%)',
            border: 'none', borderRadius: '8px',
            color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(79,110,247,0.4)',
          }}>
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 各 Tab 内容 ───────────────────────────────────────────────────────────────

type SetFn = <K extends keyof Storylet>(key: K, value: Storylet[K]) => void

function BasicTab({ form, set }: { form: Storylet; set: SetFn }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Row>
        <Field label="ID">
          <input value={form.id} readOnly style={{ ...inputStyle, background: '#0f1117', cursor: 'not-allowed' }} />
        </Field>
      </Row>
      <Row>
        <Field label="标题">
          <input value={form.title} onChange={(e) => set('title', e.target.value)} style={inputStyle} />
        </Field>
      </Row>
      <Row>
        <Field label="叙事目标 (narrative_goal)">
          <textarea
            value={form.narrative_goal}
            onChange={(e) => set('narrative_goal', e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
            placeholder="此 Storylet 要推进什么叙事目标？"
          />
        </Field>
      </Row>
      <Row>
        <Field label="Phase Tags">
          <TagInput
            tags={form.phase_tags}
            onChange={(t) => set('phase_tags', t)}
          />
        </Field>
      </Row>
      <Row>
        <Field label="LLM Trigger（自然语言触发条件）">
          <textarea
            value={form.llm_trigger ?? ''}
            onChange={(e) => set('llm_trigger', e.target.value || undefined)}
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' }}
            placeholder="如：玩家提到了手机、催收、借钱相关话题"
          />
        </Field>
      </Row>
    </div>
  )
}

function ConditionsTab({ form, set }: { form: Storylet; set: SetFn }) {
  const updateCond = (i: number, patch: Partial<Condition>) =>
    set('conditions', form.conditions.map((c, idx) => idx === i ? { ...c, ...patch } : c))
  const addCond = () =>
    set('conditions', [...form.conditions, { type: 'flag_check', key: '', op: '==', value: true }])
  const removeCond = (i: number) =>
    set('conditions', form.conditions.filter((_, idx) => idx !== i))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <SectionHint>前置条件（AND 关系，全部满足才可触发）</SectionHint>

      {form.conditions.length === 0 && (
        <div style={emptyHint}>无前置条件，始终可触发</div>
      )}

      {form.conditions.map((c, i) => (
        <div key={i} style={{
          background: '#131828', border: '1px solid #2e3250',
          borderRadius: '8px', padding: '10px',
        }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              value={c.type}
              onChange={(e) => updateCond(i, { type: e.target.value as Condition['type'] })}
              style={{ ...selectStyle, width: '130px' }}
            >
              <option value="flag_check">flag_check</option>
              <option value="quality_check">quality_check</option>
              <option value="player_input_keyword">keyword</option>
            </select>
            <KeyInput
              value={c.key}
              onChange={(key) => updateCond(i, { key })}
              filter={c.type === 'flag_check' ? 'flag' : c.type === 'quality_check' ? 'quality' : undefined}
              style={{ fontSize: '12px' }}
              placeholder="world state key"
            />
            <select
              value={c.op}
              onChange={(e) => updateCond(i, { op: e.target.value as Condition['op'] })}
              style={{ ...selectStyle }}
            >
              {['==', '!=', '>', '>=', '<', '<='].map((op) => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
            <input
              value={String(c.value ?? '')}
              onChange={(e) => updateCond(i, { value: e.target.value })}
              style={{ ...inputStyle, width: '80px' }}
              placeholder="value"
            />
            <button onClick={() => removeCond(i)} style={removeBtnStyle}>×</button>
          </div>
        </div>
      ))}

      <button onClick={addCond} style={addBtnStyle}>+ 添加条件</button>

      <div style={{ marginTop: '8px', paddingTop: '12px', borderTop: '1px solid #2e3250' }}>
        <div style={{ color: '#8891b0', fontSize: '11px', marginBottom: '4px', fontWeight: 500 }}>
          重复性 (repeatability)
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            value={form.repeatability}
            onChange={(e) => set('repeatability', e.target.value as Storylet['repeatability'])}
            style={{ ...selectStyle }}
          >
            <option value="never">never（触发一次）</option>
            <option value="unlimited">unlimited（无限重复）</option>
            <option value="cooldown">cooldown（冷却期）</option>
          </select>
          {form.repeatability === 'cooldown' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: '#8891b0', fontSize: '12px' }}>Cooldown 回合数：</span>
              <input
                type="number" min={1}
                value={form.cooldown ?? 5}
                onChange={(e) => set('cooldown', Number(e.target.value))}
                style={{ ...inputStyle, width: '70px' }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EffectsTab({ form, set }: { form: Storylet; set: SetFn }) {
  const updateEffect = (i: number, patch: Partial<WorldStateEffect>) =>
    set('effects', form.effects.map((e, idx) => idx === i ? { ...e, ...patch } : e))
  const addEffect = () =>
    set('effects', [...form.effects, { type: 'set_flag', key: '', value: true }])
  const removeEffect = (i: number) =>
    set('effects', form.effects.filter((_, idx) => idx !== i))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <SectionHint>后置效果（Storylet 首次触发时执行一次）</SectionHint>

      {form.effects.length === 0 && <div style={emptyHint}>无后置效果</div>}

      {form.effects.map((e, i) => (
        <div key={i} style={{
          display: 'flex', gap: '8px', alignItems: 'center',
          background: '#131828', border: '1px solid #2e3250',
          borderRadius: '8px', padding: '10px',
        }}>
          <select
            value={e.type}
            onChange={(ev) => updateEffect(i, { type: ev.target.value as WorldStateEffect['type'] })}
            style={{ ...selectStyle, width: '150px' }}
          >
            <option value="set_flag">set_flag</option>
            <option value="set_quality">set_quality</option>
            <option value="increment_quality">increment_quality</option>
            <option value="decrement_quality">decrement_quality</option>
          </select>
          <KeyInput
            value={e.key}
            onChange={(key) => updateEffect(i, { key })}
            filter={e.type.includes('flag') ? 'flag' : e.type.includes('quality') || e.type.includes('increment') || e.type.includes('decrement') ? 'quality' : undefined}
            placeholder="key"
          />
          {(e.type === 'set_flag' || e.type === 'set_quality') ? (
            <input
              value={String(e.value ?? '')}
              onChange={(ev) => updateEffect(i, { value: ev.target.value })}
              style={{ ...inputStyle, width: '90px' }}
              placeholder="value"
            />
          ) : (
            <input
              type="number"
              value={e.amount ?? 1}
              onChange={(ev) => updateEffect(i, { amount: Number(ev.target.value) })}
              style={{ ...inputStyle, width: '70px' }}
            />
          )}
          <button onClick={() => removeEffect(i)} style={removeBtnStyle}>×</button>
        </div>
      ))}

      <button onClick={addEffect} style={addBtnStyle}>+ 添加效果</button>
    </div>
  )
}

function ScheduleTab({ form, set }: { form: Storylet; set: SetFn }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', gap: '12px' }}>
        <Field label="粘性 (sticky)" style={{ flex: 1 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox" checked={form.sticky}
              onChange={(e) => set('sticky', e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: '#f5a623' }}
            />
            <span style={{ color: '#8891b0', fontSize: '12px' }}>一旦触发持续置顶</span>
          </label>
        </Field>
        <Field label="优先级覆盖 (priority_override)" style={{ flex: 1 }}>
          <input
            type="number"
            value={form.priority_override ?? ''}
            onChange={(e) => set('priority_override', e.target.value ? Number(e.target.value) : undefined)}
            style={inputStyle}
            placeholder="默认（无覆盖）"
          />
        </Field>
      </div>

      <Field label="被打断时行为 (on_interrupt)">
        <select
          value={form.on_interrupt}
          onChange={(e) => set('on_interrupt', e.target.value as Storylet['on_interrupt'])}
          style={{ ...selectStyle, width: '100%' }}
        >
          <option value="pause">pause — 暂停，待下次继续</option>
          <option value="abort">abort — 中止，不再触发</option>
          <option value="continue">continue — 忽略打断继续</option>
        </select>
      </Field>

      <Field label="选项提示 (choices_hint)">
        <SectionHint>给 LLM 的备选行动提示（不强制）</SectionHint>
        <TagInput
          tags={form.choices_hint}
          onChange={(t) => set('choices_hint', t)}
          placeholder="如：追问、转移话题、安慰..."
        />
      </Field>
    </div>
  )
}

function SalienceTab({ form, set }: { form: Storylet; set: SetFn }) {
  const base = form.salience.base
  const mods = form.salience.modifiers

  const setBase = (v: number) => set('salience', { ...form.salience, base: v })
  const updateMod = (i: number, patch: Partial<SalienceModifier>) =>
    set('salience', {
      ...form.salience,
      modifiers: mods.map((m, idx) => idx === i ? { ...m, ...patch } : m),
    })
  const addMod = () =>
    set('salience', {
      ...form.salience,
      modifiers: [...mods, { key: '', threshold: 0, bonus: 0, penalty: 0 }],
    })
  const removeMod = (i: number) =>
    set('salience', { ...form.salience, modifiers: mods.filter((_, idx) => idx !== i) })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Field label="基础分 (base)">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input
            type="range" min={0} max={20} value={base}
            onChange={(e) => setBase(Number(e.target.value))}
            style={{ flex: 1, accentColor: '#4f6ef7' }}
          />
          <span style={{ color: '#4f6ef7', fontWeight: 700, fontSize: '18px', minWidth: '30px' }}>
            {base}
          </span>
        </div>
      </Field>

      <div>
        <div style={{
          color: '#8891b0', fontSize: '11px', marginBottom: '10px', fontWeight: 500,
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>修正器 (modifiers)</span>
          <span style={{ color: '#4a5070' }}>world_state_key ≥ threshold → +bonus / -penalty</span>
        </div>

        {mods.length === 0 && <div style={emptyHint}>无修正器（使用固定基础分）</div>}

        {mods.map((m, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '1fr 70px 60px 60px 24px',
            gap: '6px', marginBottom: '8px', alignItems: 'center',
          }}>
            <KeyInput
              value={m.key} onChange={(key) => updateMod(i, { key })}
              filter="quality"
              style={{ fontSize: '11px' }}
              placeholder="quality key"
            />
            <input
              type="number" value={m.threshold}
              onChange={(e) => updateMod(i, { threshold: Number(e.target.value) })}
              style={{ ...inputStyle, fontSize: '11px' }} placeholder="≥"
            />
            <input
              type="number" value={m.bonus}
              onChange={(e) => updateMod(i, { bonus: Number(e.target.value) })}
              style={{ ...inputStyle, fontSize: '11px', color: '#2ecc71' }} placeholder="+bonus"
            />
            <input
              type="number" value={m.penalty}
              onChange={(e) => updateMod(i, { penalty: Number(e.target.value) })}
              style={{ ...inputStyle, fontSize: '11px', color: '#e74c3c' }} placeholder="-penalty"
            />
            <button onClick={() => removeMod(i)} style={removeBtnStyle}>×</button>
          </div>
        ))}
        <button onClick={addMod} style={addBtnStyle}>+ 修正器</button>
      </div>
    </div>
  )
}

function CompletionTab({ form, set }: { form: Storylet; set: SetFn }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <SectionHint>completion_trigger：满足条件时自动完成 Storylet</SectionHint>
      <TriggerEditor
        label="完成触发 (completion_trigger)"
        value={form.completion_trigger ?? null}
        onChange={(v) => set('completion_trigger', v ?? undefined)}
      />

      <div style={{ paddingTop: '8px', borderTop: '1px solid #2e3250' }}>
        <SectionHint>force_wrap_up：满足条件时强制结束并切换到下一个 Storylet</SectionHint>
        <div style={{ marginTop: '8px' }}>
          <TriggerEditor
            label="强制收尾 (force_wrap_up)"
            value={form.force_wrap_up ?? null}
            onChange={(v) => set('force_wrap_up', v ?? undefined)}
          />
        </div>
      </div>
    </div>
  )
}

function TriggerEditor({
  label, value, onChange,
}: {
  label: string
  value: Storylet['completion_trigger'] | null
  onChange: (v: Storylet['completion_trigger'] | null) => void
}) {
  const enabled = value !== null && value !== undefined
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <span style={{ color: '#8891b0', fontSize: '12px', fontWeight: 500 }}>{label}</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
          <input
            type="checkbox" checked={enabled}
            onChange={(e) => onChange(e.target.checked ? { type: 'turn_count', value: 5 } : null)}
            style={{ accentColor: '#2ecc71' }}
          />
          <span style={{ color: '#4a5070', fontSize: '11px' }}>启用</span>
        </label>
      </div>

      {enabled && value && (
        <div style={{ display: 'flex', gap: '8px', padding: '10px', background: '#131828', borderRadius: '8px', border: '1px solid #2e3250' }}>
          <select
            value={value.type}
            onChange={(e) => onChange({ ...value, type: e.target.value as 'turn_count' | 'flag_check' | 'quality_check' })}
            style={selectStyle}
          >
            <option value="turn_count">turn_count</option>
            <option value="flag_check">flag_check</option>
            <option value="quality_check">quality_check</option>
          </select>
          {value.type === 'turn_count' ? (
            <input
              type="number" min={1}
              value={Number(value.value ?? 5)}
              onChange={(e) => onChange({ ...value, value: Number(e.target.value) })}
              style={{ ...inputStyle, width: '80px' }}
              placeholder="回合数"
            />
          ) : (
            <>
              <KeyInput
                value={value.key ?? ''} onChange={(key) => onChange({ ...value, key })}
                filter={value.type === 'flag_check' ? 'flag' : value.type === 'quality_check' ? 'quality' : undefined}
                placeholder="key"
              />
              <select
                value={value.op ?? '=='} onChange={(e) => onChange({ ...value, op: e.target.value })}
                style={selectStyle}
              >
                {['==', '!=', '>', '>=', '<', '<='].map((op) => <option key={op} value={op}>{op}</option>)}
              </select>
              <input
                value={String(value.value ?? '')} onChange={(e) => onChange({ ...value, value: e.target.value })}
                style={{ ...inputStyle, width: '80px' }} placeholder="value"
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── 小工具组件 ────────────────────────────────────────────────────────────────

function Row({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <div style={{ color: '#8891b0', fontSize: '11px', marginBottom: '5px', fontWeight: 500 }}>{label}</div>
      {children}
    </div>
  )
}

function SectionHint({ children }: { children: React.ReactNode }) {
  return <div style={{ color: '#4a5070', fontSize: '11px', lineHeight: 1.5 }}>{children}</div>
}

function TagInput({ tags, onChange, placeholder }: { tags: string[]; onChange: (t: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState('')
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '6px' }}>
        {tags.map((t) => (
          <span key={t} style={{
            background: '#1e2a4a', border: '1px solid #2e3a60',
            borderRadius: '4px', padding: '2px 8px',
            fontSize: '11px', color: '#7090e0',
            display: 'flex', alignItems: 'center', gap: '4px',
          }}>
            {t}
            <button onClick={() => onChange(tags.filter((x) => x !== t))}
              style={{ background: 'none', border: 'none', color: '#4a5070', cursor: 'pointer', fontSize: '13px' }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
              onChange([...tags, input.trim()]); setInput(''); e.preventDefault()
            }
          }}
          style={{ ...inputStyle, flex: 1 }}
          placeholder={placeholder ?? '输入后按 Enter 添加'}
        />
        <button onClick={() => { if (input.trim()) { onChange([...tags, input.trim()]); setInput('') } }} style={addBtnStyle}>+</button>
      </div>
    </div>
  )
}

const emptyHint: React.CSSProperties = {
  color: '#4a5070', fontSize: '12px', textAlign: 'center',
  padding: '16px', border: '1px dashed #2e3250', borderRadius: '6px',
}
