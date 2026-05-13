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
      <div className={selected ? 'bevel-in' : 'bevel-out'}
        style={{
          background: '#C0C0C0',
          padding: '3px',
          minWidth: '180px',
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}>
        {/* 标题栏 */}
        <div className="panel-header" style={{ margin: '-3px -3px 6px -3px' }}>
          <Flag size={14} color="#000080" />
          <span style={{ color: '#000', fontWeight: 700, fontSize: '11px' }}>结局</span>
        </div>
        
        {/* 内容区 */}
        <div style={{
          background: '#FFFFCC',
          border: '2px solid',
          borderColor: '#808080 #ffffff #ffffff #808080',
          padding: '6px 8px',
          margin: '3px',
        }}>
          <div style={{ color: '#000', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>
            {landmark.title.replace('结局 — ', '')}
          </div>
          {landmark.description && (
            <div style={{ color: '#444', fontSize: '11px', lineHeight: 1.4 }}>
              {landmark.description.slice(0, 45)}{landmark.description.length > 45 ? '…' : ''}
            </div>
          )}
        </div>
        
        <Handle type="target" position={Position.Left} id="target"
          style={{ background: '#808080', border: '2px solid #000080', width: 10, height: 10 }} />
      </div>
    )
  }

  return (
    <div className={selected ? 'bevel-in' : 'bevel-out'}
      style={{
        background: '#C0C0C0',
        padding: '3px',
        minWidth: '200px',
        maxWidth: '240px',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}>
      
      {/* 标题栏 */}
      <div className="panel-header" style={{ margin: '-3px -3px 6px', fontSize: '11px' }}>
        <span style={{ width: '8px', height: '8px', background: selected ? '#FFFF00' : '#808080', flexShrink: 0, display: 'inline-block' }} />
        <span style={{ fontFamily: '"Courier New", monospace', letterSpacing: '0.05em' }}>{landmark.phase_tag}</span>
      </div>
      
      {/* 内容区 — 面板黄 */}
      <div style={{
        background: '#FFFFCC',
        border: '2px solid',
        borderColor: '#808080 #ffffff #ffffff #808080',
        padding: '6px 8px',
        margin: '0 3px',
      }}>
        {/* 节点标题 */}
        <div style={{ color: '#000', fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
          {landmark.title}
        </div>
        
        {/* 描述 */}
        {landmark.description && (
          <div style={{ color: '#444', fontSize: '11px', lineHeight: 1.4, marginBottom: '4px' }}>
            {landmark.description.slice(0, 55)}{landmark.description.length > 55 ? '…' : ''}
          </div>
        )}
      </div>
      
      {/* 底部状态栏 */}
      <div style={{ display: 'flex', gap: '8px', paddingTop: '6px', borderTop: '2px solid #808080' }}>
        <div className="bevel-out" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 6px', fontSize: '11px' }}>
          <BookOpen size={10} />
          <span style={{ color: '#0000FF', fontWeight: 600 }}>{nodeStorylets.length}</span>
          <span style={{ color: '#808080', fontSize: '10px' }}>storylets</span>
        </div>
        <div className="bevel-out" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 6px', fontSize: '11px' }}>
          <ArrowRight size={10} />
          <span style={{ color: '#00AA00', fontWeight: 600 }}>{landmark.transitions.length}</span>
          <span style={{ color: '#808080', fontSize: '10px' }}>出边</span>
        </div>
      </div>
      
      <Handle type="target" position={Position.Left} id="target"
        style={{ background: '#808080', border: '2px solid #0000FF', width: 10, height: 10 }} />
      <Handle type="source" position={Position.Right} id="source"
        style={{ background: '#808080', border: '2px solid #0000FF', width: 10, height: 10 }} />
    </div>
  )
})

function StatBadge({ icon, value, total, label, color }: { icon: React.ReactNode; value: number; total?: number; label: string; color: string }) {
  return (
    <div className="bevel-out" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 6px', fontSize: '11px' }}>
      {icon}
      <span style={{ color, fontWeight: 600 }}>{value}{total !== undefined ? `/${total}` : ''}</span>
      <span style={{ color: '#808080', fontSize: '10px' }}>{label}</span>
    </div>
  )
}

LandmarkNode.displayName = 'LandmarkNode'
export default LandmarkNode
