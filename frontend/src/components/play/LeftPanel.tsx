/**
 * LeftPanel — 90s Retro 左栏（mockup 精确还原）
 * 三层 panel-header + clock-block + location-block + ws-group
 */
import { useState, useEffect } from 'react'
import { usePlayStore } from '../../store/usePlayStore'
import { useStore } from '../../store/useStore'
import LocationPanel from './LocationPanel'

// ── Clock（Windows 95 面板时钟）──
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
    <>
      <div className="panel-header">⌚ SYSTEM CLOCK</div>
      <div className="bevel-out" style={{ margin: '4px 6px', background: '#C0C0C0', padding: '3px' }}>
        <div className="bevel-in" style={{
          background: '#ffffff', textAlign: 'center',
          padding: '8px 6px 6px',
        }}>
          <div style={{
            fontFamily: '"Courier New", monospace',
            fontSize: '1.8rem', fontWeight: 700, color: '#000',
            letterSpacing: '2px', lineHeight: 1,
          }}>
            {hhmm}
          </div>
          <div style={{
            fontFamily: '"Courier New", monospace',
            fontSize: '10px', color: '#808080', marginTop: '4px',
            letterSpacing: '0.08em',
          }}>
            {date} · {weekday}
          </div>
        </div>
      </div>
    </>
  )
}

// ── 类型 ────────────────────────────────────
interface QualityDef { key: string; label: string; min: number; max: number }
interface FlagDef    { key: string; label: string; type: 'boolean'|'string'|'number' }
interface RelationshipDef { key: string; label: string; min: number; max: number }

// ── NumberBar（mockup bevel-in 进度条 + 交替行）──
function NumberBar({ label, value, min = 0, max = 10, color = '#0000FF' }: {
  label: string; value: number; min?: number; max?: number; color?: string
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="ws-item">
      <div className="ws-label">{label}</div>
      <div data-bar style={{ width:'70px', height:'10px', border:'2px solid', borderColor:'#808080 #ffffff #ffffff #808080', background:'#000000', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:color, transition:'width 0.3s' }} />
      </div>
      <div className="ws-val">{value}</div>
    </div>
  )
}

// ── FlagToggle（mockup LED 指示器）───────────
function FlagToggle({ label, value }: {
  label: string; value: boolean|string|number
}) {
  const on = !!value
  return (
    <div className="flag-row">
      <div className="flag-led" style={{ background: on ? '#00FF00' : '#303030' }} />
      <span>{label}</span>
    </div>
  )
}

// ── LeftPanel ────────────────────────────────
export default function LeftPanel() {
  const worldState = usePlayStore((s) => s.worldState)
  const worldStateDefinition = useStore((s) => s.worldStateDefinition)

  const qualities: QualityDef[] = worldStateDefinition?.qualities?.map(q => ({
    key: q.key, label: q.label, min: q.min ?? 0, max: q.max ?? 10,
  })) ?? []
  const flags: FlagDef[] = worldStateDefinition?.flags?.map(f => ({
    key: f.key, label: f.label, type: f.type as FlagDef['type'],
  })) ?? []
  const relationships: RelationshipDef[] = worldStateDefinition?.relationships?.map(r => ({
    key: r.key, label: r.label, min: r.min ?? 0, max: r.max ?? 10,
  })) ?? []

  return (
    <div className="col-left" style={{ width: '220px', flexShrink:0, background:'#C0C0C0', display:'flex', flexDirection:'column', overflow:'hidden' }}>

      {/* ── CLOCK ── */}
      <LiveClock />

      {/* ── LOCATION ── */}
      <div className="panel-header">📍 LOCATION</div>
      <LocationPanel />

      {/* ── WORLD STATE ── */}
      <div className="panel-header">🌐 WORLD STATE</div>
      <div className="ws-section">

        {/* QUALITIES */}
        <div className="panel-header-black" style={{ fontSize:'9px', padding:'2px 8px' }}>QUALITIES</div>
        <div className="ws-group">
          {qualities.map(q => (
            <NumberBar key={q.key} label={q.label}
              value={worldState.qualities[q.key] ?? q.min}
              min={q.min} max={q.max}
              color="#0000FF"
            />
          ))}
        </div>

        {/* FLAGS */}
        {flags.length > 0 && (
          <>
            <div className="panel-header-black" style={{ fontSize:'9px', padding:'2px 8px' }}>FLAGS</div>
            <div className="ws-group">
              {flags.map(f => (
                <FlagToggle key={f.key} label={f.label}
                  value={worldState.flags[f.key] ?? false}
                />
              ))}
            </div>
          </>
        )}

        {/* RELATIONSHIPS */}
        {relationships.length > 0 && (
          <>
            <div className="panel-header-black" style={{ fontSize:'9px', padding:'2px 8px' }}>RELATIONSHIPS</div>
            <div className="ws-group">
              {relationships.map(r => (
                <NumberBar key={r.key} label={r.label}
                  value={worldState.relationships[r.key] ?? r.min}
                  min={r.min} max={r.max}
                  color="#0080FF"
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
