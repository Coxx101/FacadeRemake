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
      background: 'var(--bg-stage)',
      backgroundImage: [
        'linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px)',
        'linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)',
      ].join(','),
      backgroundSize: '60px 60px',
      borderBottom: '1px solid var(--border)',
      display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
      overflow: 'hidden',
    }}>
      {/* Stage Header */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        background: 'var(--text)', color: 'var(--bg-panel)',
        padding: '4px 10px', fontSize: '11px', fontWeight: 700,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        zIndex: 10,
      }}>
        THE STAGE / {currentLandmark?.title ?? '—'}
      </div>

      {/* 角色容器 */}
      <div style={{ display: 'flex', gap: '60px', paddingBottom: '30px', zIndex: 5 }}>
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
    <div style={{
      width: '160px', height: '220px',
      border: `3px solid ${color}`,
      background: 'var(--bg-surface)',
      position: 'relative',
      boxShadow: speaking
        ? `0 0 0 3px ${color}40, 8px 8px 0 rgba(0,0,0,0.1)`
        : '8px 8px 0 rgba(0,0,0,0.08)',
      transition: 'box-shadow 0.3s',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* 说话指示 */}
      {speaking && (
        <div style={{
          position: 'absolute', top: '-10px', left: '50%',
          transform: 'translateX(-50%)',
          width: '8px', height: '8px',
          borderRadius: '50%', background: color,
          animation: 'speakingPulse 0.8s ease-in-out infinite',
        }} />
      )}
      {/* 角色标签 */}
      <div style={{
        position: 'absolute', top: '-28px', width: '100%',
        textAlign: 'center', fontFamily: "'Special Elite','Courier New',monospace",
        fontSize: '14px', fontWeight: 700, letterSpacing: '2px', color,
      }}>
        {name}
      </div>
      {/* 占位内容 */}
      <div style={{
        width: '90%', height: '90%',
        background: 'var(--bg-surface)',
        border: `1px dashed var(--border)`,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-dim)', fontSize: '12px', textAlign: 'center',
      }}>
        {name}<br />
        <span style={{ fontSize: '10px', marginTop: '4px', opacity: 0.6 }}>立绘占位</span>
      </div>
    </div>
  )
}