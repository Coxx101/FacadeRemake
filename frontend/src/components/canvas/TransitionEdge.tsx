import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'

const EDGE_COLORS: Record<string, string> = {
  condition: '#2ecc71',
  count:     '#f1c40f',
  fallback:  '#e74c3c',
  turnlimit: '#e67e22',
}

/** 非条件线（兜底/计数/回合限制）用虚线，降低视觉权重 */
const DASHED_TYPES = new Set(['fallback', 'count', 'turnlimit'])

export default function TransitionEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data, selected,
}: EdgeProps) {
  const edgeType = (data as Record<string, unknown>)?.edgeType as string ?? 'condition'
  const label    = (data as Record<string, unknown>)?.label as string | undefined
  const color    = EDGE_COLORS[edgeType] ?? '#4f6ef7'
  const isDashed = DASHED_TYPES.has(edgeType)

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  })

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{
        stroke: color,
        strokeWidth: selected ? 2.5 : 1.8,
        opacity: selected ? 1 : (isDashed ? 0.75 : 0.75),
        strokeDasharray: isDashed ? '6 4' : 'none',
        filter: selected ? `drop-shadow(0 0 4px ${color})` : 'none',
      }} markerEnd={`url(#arrow-${edgeType})`} />

      {label && !isDashed && (
        <EdgeLabelRenderer>
          <div style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}>
            <div style={{
              background: '#1a1d27', border: `1px solid ${color}`,
              borderRadius: '4px', padding: '2px 7px',
              fontSize: '11px', color, fontWeight: 500,
              whiteSpace: 'nowrap',
              opacity: isDashed ? 0.6 : 0.9,
            }}>
              {label}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
