/**
 * LocationPanel — v3.1 小地图（矩形节点 + 规整网格布局 + bevel 效果）
 */
import { useMemo, useState } from 'react'
import { usePlayStore } from '../../store/usePlayStore'
import { useStore } from '../../store/useStore'

// ── 布局常量 ──────────────────────────────────────────────────────────────
const COLS = 2
const NODE_W = 82
const NODE_H = 30
const GAP_X = 18
const GAP_Y = 28
const PAD_X = 12
const PAD_Y = 10
const MAP_W = PAD_X * 2 + COLS * NODE_W + (COLS - 1) * GAP_X  // = 206

interface LayoutNode {
  id: string
  label: string
  col: number
  row: number
}

/** 网格布局：按连接数降序排列，2 列自动换行 */
function gridLayout(locations: Array<{ id: string; label: string; adjacent: string[] }>): LayoutNode[] {
  const sorted = [...locations].sort((a, b) => b.adjacent.length - a.adjacent.length)
  return sorted.map((loc, i) => ({
    id: loc.id,
    label: loc.label,
    col: i % COLS,
    row: Math.floor(i / COLS),
  }))
}

/** 节点中心坐标 */
function nodeCenter(n: LayoutNode): { x: number; y: number } {
  return {
    x: PAD_X + n.col * (NODE_W + GAP_X) + NODE_W / 2,
    y: PAD_Y + n.row * (NODE_H + GAP_Y) + NODE_H / 2,
  }
}

/** 地图总高度（行数 × 节点高 + 间距 + 内边距） */
function mapHeight(locations: Array<{ id: string; label: string; adjacent: string[] }>): number {
  const rows = Math.ceil(locations.length / COLS)
  return PAD_Y * 2 + rows * NODE_H + (rows - 1) * GAP_Y
}

export default function LocationPanel() {
  const locations = usePlayStore(s => s.locations)
  const playerLocation = usePlayStore(s => s.playerLocation)
  const entityLocations = usePlayStore(s => s.entityLocations)
  const playChars = usePlayStore(s => s.characters)
  const playProps = usePlayStore(s => s.props)
  const moveToLocation = usePlayStore(s => s.moveToLocation)
  const isLoading = usePlayStore(s => s.isLoading)
  const edChars = useStore(s => s.characters)
  const edProps = useStore(s => s.propLibrary)

  const chars = useMemo(() =>
    playChars.length > 0 ? playChars : edChars.map(c => ({ id: c.id, name: c.name })),
    [playChars, edChars])
  const props = useMemo(() =>
    playProps.length > 0 ? playProps : edProps.map(p => ({ id: p.id, name: p.label })),
    [playProps, edProps])

  const current = playerLocation || (locations.length > 0 ? locations[0].id : '')
  const reachable = useMemo(() => {
    const loc = locations.find(l => l.id === current)
    return new Set(loc?.adjacent || [])
  }, [current, locations])

  const entitiesAt = (locId: string) =>
    Object.entries(entityLocations)
      .filter(([, l]) => l === locId)
      .map(([id]) => {
        const c = chars.find(x => x.id === id)
        if (c) return { id, name: c.name, type: 'character' as const }
        const p = props.find(x => x.id === id)
        if (p) return { id, name: p.name, type: 'prop' as const }
        return { id, name: id, type: 'prop' as const }
      })

  const layoutNodes = useMemo(() => gridLayout(locations), [locations])
  const mh = mapHeight(locations)

  if (locations.length === 0) {
    return (
      <div className="bevel-in" style={{ margin: '6px', padding: '14px 8px', textAlign: 'center', background: '#D4D0CC', color: '#808080', fontSize: '11px', fontFamily: '"MS Sans Serif", sans-serif' }}>
        <div style={{ fontSize: '18px', marginBottom: '2px' }}>🗺️</div>
        暂无位置数据
      </div>
    )
  }

  return (
    <div style={{ padding: '4px 4px 2px', position: 'relative', minHeight: mh + 38 }}>
      {/* ── 连线层 (SVG) ── */}
      <svg
        width={MAP_W} height={mh}
        style={{ position: 'absolute', top: 0, left: 4, pointerEvents: 'none', zIndex: 1 }}
      >
        <defs>
          <pattern id="grid" width="14" height="14" patternUnits="userSpaceOnUse">
            <path d="M 14 0 L 0 0 0 14" fill="none" stroke="#b0b0b0" strokeWidth="0.25" />
          </pattern>
        </defs>
        <rect width={MAP_W} height={mh} fill="#B8B8B8" />
        <rect width={MAP_W} height={mh} fill="url(#grid)" />

        {locations.map(src =>
          (src.adjacent || []).map(target => {
            const a = layoutNodes.find(n => n.id === src.id)
            const b = layoutNodes.find(n => n.id === target)
            if (!a || !b) return null
            const ac = nodeCenter(a)
            const bc = nodeCenter(b)
            return (
              <line key={`${src.id}->${target}`}
                x1={ac.x} y1={ac.y} x2={bc.x} y2={bc.y}
                stroke="#808080" strokeWidth={2} strokeLinecap="round"
                opacity={0.7}
              />
            )
          })
        )}
      </svg>

      {/* ── 节点层 (HTML bevel) ── */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        {layoutNodes.map(n => {
          const here = n.id === current
          const canGo = !here && reachable.has(n.id)
          const ents = entitiesAt(n.id)

          return (
            <LocationNode key={n.id}
              node={n}
              here={here}
              canGo={canGo}
              entities={ents}
              isLoading={isLoading}
              onClick={canGo ? () => moveToLocation(n.id) : undefined}
            />
          )
        })}
      </div>

      {/* ── 图例 ── */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 14, padding: '6px 0 2px' }}>
        <LegendItem color="#00AA00" bg="#FFFFCC" label="当前" />
        <LegendItem color="#0000FF" bg="#E0E8FF" label="可前往" />
        <LegendItem color="#808080" bg="#D4D0CC" label="较远" />
      </div>

      {/* ── 实体条 ── */}
      <EntityStrip {...{ current, entitiesAt, chars }} />
    </div>
  )
}

// ── 节点 ──
function LocationNode({ node, here, canGo, entities, isLoading, onClick }: {
  node: LayoutNode
  here: boolean
  canGo: boolean
  entities: Array<{ id: string; name: string; type: 'character' | 'prop' }>
  isLoading: boolean
  onClick?: () => void
}) {
  const [pressed, setPressed] = useState(false)
  const bevelCls = here || pressed ? 'bevel-in' : canGo ? 'bevel-out' : 'bevel-out'
  const c = nodeCenter(node)

  return (
    <div
      className={bevelCls}
      role={canGo ? 'button' : undefined}
      tabIndex={canGo ? 0 : undefined}
      onClick={canGo && !isLoading ? onClick : undefined}
      onKeyDown={canGo && !isLoading ? e => { if (e.key === 'Enter') onClick?.() } : undefined}
      onMouseDown={canGo ? () => setPressed(true) : undefined}
      onMouseUp={canGo ? () => setPressed(false) : undefined}
      onMouseLeave={canGo ? () => setPressed(false) : undefined}
      style={{
        position: 'absolute',
        left: c.x - NODE_W / 2, top: c.y - NODE_H / 2,
        width: NODE_W, height: NODE_H,
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '2px 6px',
        background: here ? '#FFFFCC' : canGo ? '#E0E8FF' : '#D4D0CC',
        cursor: canGo ? 'pointer' : 'default',
        opacity: here || canGo ? 1 : 0.6,
        userSelect: 'none',
        boxSizing: 'border-box',
      }}
    >
      {/* 状态 LED */}
      <div style={{
        width: 7, height: 7, flexShrink: 0, borderRadius: '50%',
        border: '1.5px solid',
        borderColor: here ? '#00AA00 #fff #fff #00AA00' : canGo ? '#0000FF #fff #fff #0000FF' : '#808080 #fff #fff #808080',
        background: here ? '#00FF00' : canGo ? '#C0C0FF' : '#aaa',
      }} />

      {/* 地名 */}
      <span style={{
        flex: 1, fontSize: 11, fontWeight: here ? 700 : 400,
        color: here ? '#000080' : canGo ? '#000' : '#808080',
        fontFamily: '"MS Sans Serif", sans-serif',
        textAlign: 'center',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {node.label}
      </span>

      {/* 实体小图标 */}
      {entities.length > 0 && (
        <span style={{ fontSize: 10, flexShrink: 0, letterSpacing: -1 }}>
          {entities.slice(0, 2).map(e => e.type === 'character' ? '👤' : '📦').join('')}
        </span>
      )}
    </div>
  )
}

// ── 图例 ──
function LegendItem({ color, bg, label }: { color: string; bg: string; label: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontFamily: '"MS Sans Serif", sans-serif', color: '#444' }}>
      <span className="bevel-out" style={{
        display: 'inline-block', width: 10, height: 10,
        background: bg, borderColor: `${color} #fff #fff ${color}`,
      }} />
      {label}
    </span>
  )
}

// ── 实体条 ──
function EntityStrip({ current, entitiesAt, chars }: {
  current: string
  entitiesAt: (id: string) => Array<{ id: string; name: string; type: 'character' | 'prop' }>
  chars: Array<{ id: string; name: string }>
}) {
  const here = entitiesAt(current)
  if (here.length === 0) return null
  return (
    <div className="bevel-in" style={{ margin: '2px 0 6px', padding: '4px 6px', background: '#D0D0D0' }}>
      <div style={{ fontSize: 9, color: '#666', fontFamily: '"MS Sans Serif", sans-serif', marginBottom: 2 }}>
        此地 —
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
        {here.map(e => (
          <span key={e.id} className="bevel-out" style={{
            display: 'inline-flex', alignItems: 'center', gap: 2,
            padding: '1px 5px', fontSize: 9,
            background: e.type === 'character' ? '#D0E8FF' : '#FFF0D0',
            color: e.type === 'character' ? '#000080' : '#804000',
            fontFamily: '"MS Sans Serif", sans-serif',
          }}>
            {e.type === 'character' ? '👤' : '📦'} {e.name}
          </span>
        ))}
      </div>
    </div>
  )
}
