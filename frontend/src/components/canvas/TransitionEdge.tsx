import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'

/** 90s Windows 风格边颜色：统一为黑色 */
const DASHED_TYPES = new Set(['fallback', 'count', 'turnlimit'])

export default function TransitionEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data, selected,
}: EdgeProps) {
  const edgeType = (data as Record<string, unknown>)?.edgeType as string ?? 'condition'
  const label    = (data as Record<string, unknown>)?.label as string | undefined
  /** 90s风格：统一黑色连线 */
  const color    = '#000000'
  /** 虚线类型：兜底/计数/回合限制 */
  const isDashed = DASHED_TYPES.has(edgeType)

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
    borderRadius: 0,  /** 90s风格：直角连线 */
  })

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{
        stroke: color,
        strokeWidth: selected ? 2.5 : 1.8,
        opacity: 1,  /** 90s风格：无透明度变化 */
        strokeDasharray: isDashed ? '6 4' : 'none',
        /** 90s风格：无阴影效果 */
      }} markerEnd={`url(#arrow-black)`} />  /** 统一使用黑色箭头 */

      {label && !isDashed && (
        <EdgeLabelRenderer>
          <div style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}>
            <div style={{
              background: '#ffffff',  /** 90s风格：白底 */
              border: '2px solid #808080',  /** bevel-out 风格边框 */
              padding: '2px 7px',
              fontSize: '11px', color: '#000000', fontWeight: 500,
              whiteSpace: 'nowrap',
              /** 90s风格：无圆角、无阴影 */
            }}>
              {label}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
