import { useState, useEffect } from 'react'
import type { Landmark, LandmarkTransition, Condition } from '../../types'
import { inputStyle, selectStyle, addBtnStyle, removeBtnStyle } from './Inspector'
import KeyInput from '../shared/KeyInput'

const EDGE_COLORS = {
  condition: '#00AA00',
  count: '#FF8000',
  fallback: '#FF0000',
  turnlimit: '#0000FF',
}

export default function TransitionsTab({
  landmark,
  onUpdate,
  landmarks,
}: {
  landmark: Landmark
  onUpdate: (id: string, patch: Partial<Landmark>) => void
  landmarks: Landmark[]
}) {
  const [transitions, setTransitions] = useState<LandmarkTransition[]>(landmark.transitions)

  // 同步外部变化（切换节点 / 撤销重做 / 导入等）
  useEffect(() => { setTransitions(landmark.transitions) }, [landmark.id, landmark.transitions])

  const save = (newTransitions: LandmarkTransition[]) => {
    setTransitions(newTransitions)
    onUpdate(landmark.id, { transitions: newTransitions })
  }

  const addTransition = () => save([
    ...transitions,
    { target_id: '', conditions: [], is_fallback: false, label: '' },
  ])

  const updateTransition = (i: number, patch: Partial<LandmarkTransition>) => {
    save(transitions.map((t, idx) => idx === i ? { ...t, ...patch } : t))
  }

  const removeTransition = (i: number) => save(transitions.filter((_, idx) => idx !== i))

  const getEdgeType = (t: LandmarkTransition) => {
    if (t.is_fallback) return 'fallback'
    if (t.storylet_count != null) return 'count'
    if (t.turn_limit != null) return 'turnlimit'
    return 'condition'
  }

  const otherLandmarks = landmarks.filter((l) => l.id !== landmark.id)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ color: '#444', fontSize: '11px', fontFamily: '"MS Sans Serif", sans-serif' }}>
        出边按声明顺序检查，第一个满足条件的触发跳转
      </div>

      {transitions.map((t, i) => {
        const type = getEdgeType(t)
        const color = EDGE_COLORS[type]
        return (
          <div key={i} className="bevel-out" style={{
            background: '#C0C0C0',
            padding: '10px',
          }}>
            {/* 头部：标签 + 目标 + 删除 */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', alignItems: 'center' }}>
              <span className="bevel-out" style={{
                background: '#d0d0ff', color, fontSize: '10px',
                padding: '1px 5px', fontWeight: 600,
                flexShrink: 0,
              }}>
                {type}
              </span>
              <input
                value={t.label}
                onChange={(e) => updateTransition(i, { label: e.target.value })}
                style={{ ...inputStyle, flex: 1, fontSize: '11px' }}
                placeholder="标签（可选）"
              />
              <button onClick={() => removeTransition(i)} style={removeBtnStyle}>×</button>
            </div>

            {/* 目标节点 */}
            <div style={{ marginBottom: '8px' }}>
              <div style={{ color: '#444', fontSize: '11px', marginBottom: '3px' }}>目标节点</div>
              <select
                value={t.target_id}
                onChange={(e) => updateTransition(i, { target_id: e.target.value })}
                style={{ ...selectStyle, width: '100%' }}
              >
                <option value="">-- 选择目标 --</option>
                {otherLandmarks.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.is_ending ? '🏁 ' : ''}{l.title}
                  </option>
                ))}
              </select>
            </div>

            {/* 限制条件行 */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#444', fontSize: '11px', marginBottom: '3px' }}>Turn Limit</div>
                <input
                  type="number" min={1}
                  value={t.turn_limit ?? ''}
                  onChange={(e) => updateTransition(i, { turn_limit: e.target.value ? Number(e.target.value) : undefined })}
                  style={{ ...inputStyle, fontSize: '11px' }}
                  placeholder="无"
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#444', fontSize: '11px', marginBottom: '3px' }}>Storylet Count</div>
                <input
                  type="number" min={1}
                  value={t.storylet_count ?? ''}
                  onChange={(e) => updateTransition(i, { storylet_count: e.target.value ? Number(e.target.value) : undefined })}
                  style={{ ...inputStyle, fontSize: '11px' }}
                  placeholder="无"
                />
              </div>
            </div>

            {/* 兜底开关 */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '8px' }}>
              <input
                type="checkbox"
                checked={t.is_fallback}
                onChange={(e) => updateTransition(i, { is_fallback: e.target.checked })}
                style={{ width: '14px', height: '14px', accentColor: '#FF0000' }}
              />
              <span style={{ color: '#444', fontSize: '11px' }}>兜底分支（is_fallback）</span>
            </label>

            {/* Conditions 列表 */}
            <ConditionListEditor
              conditions={t.conditions}
              onChange={(conditions) => updateTransition(i, { conditions })}
            />
          </div>
        )
      })}

      <button onClick={addTransition} style={addBtnStyle}>+ 新增出边</button>
    </div>
  )
}

function ConditionListEditor({
  conditions,
  onChange,
}: {
  conditions: Condition[]
  onChange: (c: Condition[]) => void
}) {
  const add = () => onChange([...conditions, { type: 'flag_check', key: '', op: '==', value: true }])
  const update = (i: number, patch: Partial<Condition>) =>
    onChange(conditions.map((c, idx) => idx === i ? { ...c, ...patch } : c))
  const remove = (i: number) => onChange(conditions.filter((_, idx) => idx !== i))

  return (
    <div>
      <div style={{ color: '#4a5070', fontSize: '11px', marginBottom: '6px', fontWeight: 600 }}>
        CONDITIONS （AND）
      </div>
      {conditions.map((c, i) => (
        <div key={i} style={{ display: 'flex', gap: '4px', marginBottom: '4px', alignItems: 'center' }}>
          <select
            value={c.type}
            onChange={(e) => update(i, { type: e.target.value as Condition['type'] })}
            style={{ ...selectStyle, fontSize: '10px', padding: '4px 5px' }}
          >
            <option value="flag_check">flag</option>
            <option value="quality_check">quality</option>
            <option value="player_input_keyword">keyword</option>
          </select>
          <KeyInput
            value={c.key}
            onChange={(key) => update(i, { key })}
            filter={c.type === 'flag_check' ? 'flag' : c.type === 'quality_check' ? 'quality' : undefined}
            style={{ fontSize: '11px', padding: '4px 7px' }}
            placeholder="key"
          />
          <select
            value={c.op}
            onChange={(e) => update(i, { op: e.target.value as Condition['op'] })}
            style={{ ...selectStyle, fontSize: '11px', padding: '4px 5px' }}
          >
            {['==', '!=', '>', '>=', '<', '<='].map((op) => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>
          <input
            value={String(c.value ?? '')}
            onChange={(e) => update(i, { value: e.target.value })}
            style={{ ...inputStyle, width: '55px', fontSize: '11px', padding: '4px 6px' }}
            placeholder="val"
          />
          <button onClick={() => remove(i)} style={{ ...removeBtnStyle, width: '20px', height: '20px' }}>×</button>
        </div>
      ))}
      <button onClick={add} style={{ ...addBtnStyle, padding: '4px 10px', fontSize: '11px' }}>
        + 条件
      </button>
    </div>
  )
}
