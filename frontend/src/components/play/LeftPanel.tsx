/**
 * LeftPanel — 左栏组件（白底风格）
 * 包含：实时时钟、场景位置（LocationPanel）、世界状态
 */
import { useState, useEffect } from 'react'
import { usePlayStore } from '../../store/usePlayStore'
import { useStore } from '../../store/useStore'
import LocationPanel from './LocationPanel'

// ── 实时时钟组件 ────────────────────────────────────────────────────────────────
function LiveClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  
  const hhmm = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  const date = now.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.')
  const weekday = ['SUN','MON','TUE','WED','THU','FRI','SAT'][now.getDay()]
  
  return (
    <div style={{ padding: '16px 14px', borderBottom: '1px solid var(--border)', textAlign: 'center', background: 'var(--bg-surface)' }}>
      <div style={{ fontFamily: "'Special Elite','Courier New',monospace", fontSize: '2.5rem', lineHeight: 1, letterSpacing: '-1px', color: 'var(--text)' }}>
        {hhmm}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '6px', letterSpacing: '0.08em' }}>
        {date} {weekday}
      </div>
    </div>
  )
}

// ── 世界状态定义类型 ────────────────────────────────────────────────────────────
interface QualityDef {
  key: string
  label: string
  min: number
  max: number
  icon?: string
}

interface FlagDef {
  key: string
  label: string
  type: 'boolean' | 'string' | 'number'
}

interface RelationshipDef {
  key: string
  label: string
  min: number
  max: number
}

// ── 质量值进度条组件 ────────────────────────────────────────────────────────────
function NumberBar({ label, value, min = 0, max = 10, onChange }: {
  label: string
  value: number
  min?: number
  max?: number
  onChange?: (value: number) => void
}) {
  const percentage = ((value - min) / (max - min)) * 100
  
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ fontSize: '12px', color: 'var(--text)' }}>{value}/{max}</span>
      </div>
      <div style={{ 
        height: '8px', 
        background: 'var(--bg-surface)', 
        borderRadius: '4px',
        cursor: onChange ? 'pointer' : 'default',
        overflow: 'hidden',
      }}>
        <div 
          style={{ 
            height: '100%', 
            width: `${percentage}%`,
            background: 'var(--accent)',
            borderRadius: '4px',
            transition: 'width 0.3s',
          }}
          onClick={onChange ? (e) => {
            const rect = e.currentTarget.parentElement?.getBoundingClientRect()
            if (rect) {
              const x = e.clientX - rect.left
              const newValue = Math.round(min + (x / rect.width) * (max - min))
              onChange(Math.max(min, Math.min(max, newValue)))
            }
          } : undefined}
        />
      </div>
    </div>
  )
}

// ── 标记开关组件 ────────────────────────────────────────────────────────────────
function FlagToggle({ label, value, onChange }: {
  label: string
  value: boolean | string | number
  onChange?: (value: boolean) => void
}) {
  const isTrue = !!value
  
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{label}</span>
      <button
        onClick={onChange ? () => onChange(!isTrue) : undefined}
        style={{
          width: '32px',
          height: '18px',
          background: isTrue ? 'var(--good)' : 'var(--bg-surface)',
          borderRadius: '9px',
          position: 'relative',
          cursor: onChange ? 'pointer' : 'not-allowed',
          transition: 'background 0.2s',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: '2px',
            left: isTrue ? '16px' : '2px',
            width: '14px',
            height: '14px',
            background: 'white',
            borderRadius: '50%',
            transition: 'left 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}
        />
      </button>
    </div>
  )
}

// ── LeftPanel 主体 ─────────────────────────────────────────────────────────────
export default function LeftPanel() {
  const currentLandmark = usePlayStore((s) => s.currentLandmark)
  const currentStorylet = usePlayStore((s) => s.currentStorylet)
  const turn = usePlayStore((s) => s.turn)
  const worldState = usePlayStore((s) => s.worldState)
  const setQuality = usePlayStore((s) => s.setQuality)
  const setFlag = usePlayStore((s) => s.setFlag)
  const setRelationship = usePlayStore((s) => s.setRelationship)
  
  const worldStateDefinition = useStore((s) => s.worldStateDefinition)
  
  // 提取质量值定义
  const qualities: QualityDef[] = worldStateDefinition?.qualities?.map(q => ({
    key: q.key,
    label: q.label,
    min: q.min ?? 0,
    max: q.max ?? 10,
  })) ?? []
  
  // 提取标记定义
  const flags: FlagDef[] = worldStateDefinition?.flags?.map(f => ({
    key: f.key,
    label: f.label,
    type: f.type as FlagDef['type'],
  })) ?? []
  
  // 提取关系定义
  const relationships: RelationshipDef[] = worldStateDefinition?.relationships?.map(r => ({
    key: r.key,
    label: r.label,
    min: r.min ?? 0,
    max: r.max ?? 10,
  })) ?? []

  return (
    <div style={{
      width: '260px',
      background: 'var(--bg-panel)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      {/* 实时时钟 */}
      <LiveClock />

      {/* 场景位置 - 叙事阶段 */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
        {/* Panel Header */}
        <div style={{
          background: 'var(--text)', color: 'var(--bg-panel)',
          padding: '4px 10px', fontSize: '11px', fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          marginBottom: '10px',
        }}>
          SCENE
        </div>

        {/* 当前场景 */}
        <div style={{ fontSize: '14px', color: 'var(--text)', fontWeight: 500 }}>
          {currentLandmark?.title || '—'}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Turn {turn}
        </div>
        {currentStorylet?.title && (
          <div style={{
            fontSize: '11px',
            color: 'var(--storylet-tag)',
            padding: '2px 8px',
            background: '#f5f0fc',
            borderRadius: '10px',
            marginTop: '6px',
            display: 'inline-block',
          }}>
            {currentStorylet.title}
          </div>
        )}
      </div>

      {/* 位置面板 - RPG地点系统 */}
      <LocationPanel />

      {/* 世界状态 */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', flex: 1, overflowY: 'auto' }}>
        {/* Panel Header */}
        <div style={{
          background: 'var(--text)', color: 'var(--bg-panel)',
          padding: '4px 10px', fontSize: '11px', fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          marginBottom: '10px',
        }}>
          WORLD STATE
        </div>

        {/* 质量值 */}
        {qualities.map(q => (
          <NumberBar
            key={q.key}
            label={q.label}
            value={worldState.qualities[q.key] ?? q.min}
            min={q.min}
            max={q.max}
            onChange={(value) => setQuality(q.key, value)}
          />
        ))}

        {/* 关系 */}
        {relationships.length > 0 && (
          <>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '10px 0 6px', fontWeight: 500 }}>
              RELATIONSHIPS
            </div>
            {relationships.map(r => (
              <NumberBar
                key={r.key}
                label={r.label}
                value={worldState.relationships[r.key] ?? r.min}
                min={r.min}
                max={r.max}
                onChange={(value) => setRelationship(r.key, value)}
              />
            ))}
          </>
        )}

        {/* 标记 */}
        {flags.length > 0 && (
          <>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '10px 0 6px', fontWeight: 500 }}>
              FLAGS
            </div>
            {flags.map(f => (
              <FlagToggle
                key={f.key}
                label={f.label}
                value={worldState.flags[f.key] ?? false}
                onChange={(value) => setFlag(f.key, value)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}