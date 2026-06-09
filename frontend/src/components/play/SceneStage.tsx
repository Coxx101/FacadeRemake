/**
 * SceneStage v2 — 角色立绘舞台
 * 背景图从 locationLibrary 的 background_url 读取
 * 立绘从 characters 的 portrait_url 读取
 */
import { usePlayStore } from '../../store/usePlayStore'
import { useStore } from '../../store/useStore'

export default function SceneStage() {
  const currentLandmark = usePlayStore((s) => s.currentLandmark)
  const playerLocation = usePlayStore((s) => s.playerLocation)
  const lastMsg = usePlayStore((s) => s.messages[s.messages.length - 1])

  // 从Design模式数据查背景图
  const designLocations = useStore((s) => s.locationLibrary)
  const designCharacters = useStore((s) => s.characters)

  const currentLoc = designLocations.find(l => l.id === playerLocation)
  const bgUrl = currentLoc?.background_url

  const tripProfile = designCharacters.find(c => c.id === 'trip')
  const graceProfile = designCharacters.find(c => c.id === 'grace')

  return (
    <div style={{
      flex: 2.2,
      position: 'relative',
      background: '#808080',
      display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
      overflow: 'hidden',
      border: '2px solid',
      borderColor: '#808080 #ffffff #ffffff #808080',
      minHeight: 0,
    }}>
      {/* ── 背景图 ── */}
      {bgUrl ? (
        <img src={bgUrl} alt=""
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: [
            'linear-gradient(to right, rgba(0,0,0,0.12) 1px, transparent 1px)',
            'linear-gradient(to bottom, rgba(0,0,0,0.12) 1px, transparent 1px)',
          ].join(','),
          backgroundSize: '40px 40px',
        }} />
      )}

      {/* Stage Header */}
      <div className="panel-header" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
        THE STAGE / {currentLandmark?.title ?? '—'}
      </div>

      {/* 角色容器 */}
      <div style={{ display: 'flex', gap: '40px', paddingBottom: '20px', zIndex: 5, alignItems: 'flex-end' }}>
        <CharPortrait
          name="TRIP"
          color="var(--trip-color)"
          speaking={lastMsg?.role === 'trip'}
          src={tripProfile?.portrait_url}
        />
        <CharPortrait
          name="GRACE"
          color="var(--grace-color)"
          speaking={lastMsg?.role === 'grace'}
          src={graceProfile?.portrait_url}
        />
      </div>
    </div>
  )
}

function CharPortrait({ name, color, speaking, src }: {
  name: string; color: string; speaking: boolean; src?: string
}) {
  return (
    <div className="bevel-out" style={{
      width: 160, height: 220,
      background: '#d0ccc8',
      position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {src ? (
        <img src={src} alt={name}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
        />
      ) : (
        <div style={{
          width: '80%', height: '80%',
          background: '#c8c4c0',
          border: '1px dashed #808080',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#808080', fontSize: 12, textAlign: 'center',
        }}>
          立绘
        </div>
      )}

      {/* 名字（框内底部，说话时闪烁角色色） */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        textAlign: 'center', padding: '2px 0',
        background: 'rgba(0,0,0,0.45)',
      }}>
        <span style={{
          fontSize: 14, fontWeight: 900,
          fontFamily: '"Arial Black", Impact, "MS Sans Serif", sans-serif',
          color: speaking ? color : '#ffffff',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          transition: 'color 0.15s',
          animation: speaking ? 'namePulse 0.7s ease-in-out infinite' : undefined,
        }}>
          {name}
        </span>
      </div>
    </div>
  )
}
