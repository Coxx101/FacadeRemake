import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Flag, BookOpen, ArrowRight } from 'lucide-react'
import type { NodeProps } from '@xyflow/react'
import type { Landmark } from '../../types'
import { useStore } from '../../store/useStore'

// React Flow v12 要求 node data 继承 Record<string, unknown>
export interface LandmarkNodeData extends Record<string, unknown> {
  landmark: Landmark
}

const LandmarkNode = memo(({ data, selected }: NodeProps) => {
  const landmark = (data as LandmarkNodeData).landmark
  const storylets = useStore((s) => s.storylets)
  const nodeStorylets = storylets.filter((sl) =>
    sl.phase_tags.includes(landmark.phase_tag)
  )

  if (landmark.is_ending) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #2a2010 0%, #1e1810 100%)',
        border: `2px solid ${selected ? '#f5a623' : '#7a5a1a'}`,
        borderRadius: '10px', padding: '14px 16px', minWidth: '180px',
        boxShadow: selected ? '0 0 0 3px rgba(245,166,35,0.3), 0 4px 20px rgba(0,0,0,0.5)' : '0 4px 16px rgba(0,0,0,0.4)',
        cursor: 'pointer', transition: 'all 0.15s',
      }}>
        <Handle type="target" position={Position.Left} id="target"
          style={{ background: '#7a5a1a', border: '2px solid #f5a623', width: 10, height: 10 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <Flag size={16} color="#f5a623" />
          <span style={{ color: '#f5a623', fontWeight: 700, fontSize: '13px' }}>结局</span>
        </div>
        <div style={{ color: '#e8eaf0', fontWeight: 600, fontSize: '14px', lineHeight: 1.3 }}>
          {landmark.title.replace('结局 — ', '')}
        </div>
        {landmark.description && (
          <div style={{ color: '#8891b0', fontSize: '11px', marginTop: '5px', lineHeight: 1.4 }}>
            {landmark.description.slice(0, 45)}{landmark.description.length > 45 ? '…' : ''}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #171d35 0%, #131828 100%)',
      border: `2px solid ${selected ? '#4f6ef7' : '#2e3250'}`,
      borderRadius: '10px', padding: '14px 16px', minWidth: '200px', maxWidth: '240px',
      boxShadow: selected ? '0 0 0 3px rgba(79,110,247,0.3), 0 4px 20px rgba(0,0,0,0.5)' : '0 4px 16px rgba(0,0,0,0.4)',
      cursor: 'pointer', transition: 'all 0.15s',
    }}>
      <Handle type="target" position={Position.Left} id="target"
        style={{ background: '#2e3250', border: '2px solid #4f6ef7', width: 10, height: 10 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4f6ef7', flexShrink: 0, boxShadow: '0 0 6px rgba(79,110,247,0.8)' }} />
        <span style={{ color: '#8891b0', fontSize: '11px', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
          {landmark.phase_tag}
        </span>
      </div>

      <div style={{ color: '#e8eaf0', fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
        {landmark.title}
      </div>

      {landmark.description && (
        <div style={{ color: '#8891b0', fontSize: '11px', lineHeight: 1.4, marginBottom: '10px' }}>
          {landmark.description.slice(0, 55)}{landmark.description.length > 55 ? '…' : ''}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', paddingTop: '8px', borderTop: '1px solid #2e3250' }}>
        <StatBadge icon={<BookOpen size={10} />} value={nodeStorylets.length} total={landmark.max_storylets} label="storylets" color="#4f6ef7" />
        <StatBadge icon={<ArrowRight size={10} />} value={landmark.transitions.length} label="出边" color="#2ecc71" />
      </div>

      <Handle type="source" position={Position.Right} id="source"
        style={{ background: '#2e3250', border: '2px solid #4f6ef7', width: 10, height: 10 }} />
    </div>
  )
})

function StatBadge({ icon, value, total, label, color }: { icon: React.ReactNode; value: number; total?: number; label: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(79,110,247,0.08)', borderRadius: '4px', padding: '2px 6px' }}>
      {icon}
      <span style={{ color, fontSize: '11px', fontWeight: 600 }}>{value}{total !== undefined ? `/${total}` : ''}</span>
      <span style={{ color: '#4a5070', fontSize: '10px' }}>{label}</span>
    </div>
  )
}

LandmarkNode.displayName = 'LandmarkNode'
export default LandmarkNode
