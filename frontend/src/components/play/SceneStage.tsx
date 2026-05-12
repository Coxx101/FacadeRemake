/**
 * SceneStage — 角色立绘舞台（白底风格）
 * 显示两个角色的立绘占位框
 */
import { usePlayStore } from '../../store/usePlayStore'

export default function SceneStage() {
  const currentLandmark = usePlayStore((s) => s.currentLandmark)
  const lastMsg = usePlayStore((s) => s.messages[s.messages.length - 1])

  return (
    <div style={{
      flex: 2.2,
      position: 'relative',
      background: '#808080',
      backgroundImage: [
        'linear-gradient(to right, rgba(0,0,0,0.15) 1px, transparent 1px)',
        'linear-gradient(to bottom, rgba(0,0,0,0.15) 1px, transparent 1px)',
      ].join(','),
      backgroundSize: '40px 40px',
      display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
      overflow: 'hidden',
      border: '2px solid',
      borderColor: '#808080 #ffffff #ffffff #808080',
      minHeight: 0,
    }}>
      {/* Stage Header — 90s */}
      <div className="panel-header" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
        THE STAGE / {currentLandmark?.title ?? '—'}
      </div>

      {/* 角色容器 */}
      <div style={{ display: 'flex', gap: '40px', paddingBottom: '20px', zIndex: 5, alignItems: 'flex-end' }}>
        <CharPortrait
          name="TRIP"
          color="var(--trip-color)"
          speaking={lastMsg?.role === 'trip'}
        />
        <CharPortrait
          name="GRACE"
          color="var(--grace-color)"
          speaking={lastMsg?.role === 'grace'}
        />
      </div>
    </div>
  )
}

function CharPortrait({ name, color, speaking }: { name: string; color: string; speaking: boolean }) {
  return (
    <div className={speaking ? 'bevel-in' : 'bevel-out'} style={{
      width: '160px', height: '220px',
      background: '#d0ccc8',
      position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderColor: speaking ? '#ffff00 #808080 #808080 #ffff00' : undefined,
    }}>
      {/* 说话指示 */}
      {speaking && (
        <div style={{
          position: 'absolute', top: '-12px', left: '50%',
          transform: 'translateX(-50%)',
          width: '8px', height: '8px',
          background: '#FFFF00',
          border: '1px solid #808080',
          animation: 'speakingPulse 0.8s ease-in-out infinite',
        }} />
      )}
      {/* 角色标签 */}
      <div className="panel-header" style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        textAlign: 'center', fontSize: '12px',
        background: 'linear-gradient(to right, #000080, #1084D0)',
      }}>
        {name}
      </div>
      {/* 占位内容 */}
      <div style={{
        width: '80%', height: '80%',
        background: '#c8c4c0',
        border: '1px dashed #808080',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        color: '#808080', fontSize: '12px', textAlign: 'center',
      }}>
        {name}<br />
        <span style={{ fontSize: '10px', marginTop: '4px', opacity: 0.6 }}>立绘占位</span>
      </div>
    </div>
  )
}