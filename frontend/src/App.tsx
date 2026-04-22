import { ReactFlowProvider } from '@xyflow/react'
import Toolbar from './components/Toolbar'
import LandmarkCanvas from './components/canvas/LandmarkCanvas'
import Inspector from './components/inspector/Inspector'
import CharactersPanel from './components/characters/CharactersPanel'
import WorldStatePanel from './components/worldstate/WorldStatePanel'
import StoryletModal from './components/modal/StoryletModal'
import PlayMode from './components/play/PlayMode'
import StartScreen from './components/StartScreen'
import { useStore } from './store/useStore'
import { useCallback, useRef, useEffect } from 'react'
import type { AppMode } from './types'

function DesignMode() {
  const inspectorWidth = useStore((s) => s.inspectorWidth)
  const setInspectorWidthStore = useStore((s) => s.setInspectorWidth)
  const rightPanel = useStore((s) => s.rightPanel)
  const isResizing = useRef(false)
  const lastX = useRef(0)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    isResizing.current = true
    lastX.current = e.clientX
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    e.preventDefault()
  }, [])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return
      const delta = lastX.current - e.clientX
      lastX.current = e.clientX
      setInspectorWidthStore(Math.max(280, Math.min(800, inspectorWidth + delta)))
    }
    const onMouseUp = () => {
      if (!isResizing.current) return
      isResizing.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [inspectorWidth, setInspectorWidthStore])

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
      {/* 左侧：Canvas 占满剩余空间 */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
        <ReactFlowProvider>
          <LandmarkCanvas />
        </ReactFlowProvider>
      </div>

      {/* 可拖拽分隔条 */}
      <div
        onMouseDown={onMouseDown}
        style={{
          width: '5px', cursor: 'col-resize',
          background: '#2e3250',
          position: 'relative', zIndex: 10,
          flexShrink: 0,
        }}
        onMouseEnter={(e) => { if (!isResizing.current) (e.currentTarget.style.background = '#4f6ef7') }}
        onMouseLeave={(e) => { if (!isResizing.current) (e.currentTarget.style.background = '#2e3250') }}
      />

      {/* 右侧：Inspector / CharactersPanel / WorldStatePanel（动态宽度） */}
      {rightPanel === 'inspector'
        ? <Inspector />
        : rightPanel === 'characters'
          ? <CharactersPanel />
          : <WorldStatePanel />
      }
    </div>
  )
}


export default function App() {
  const mode = useStore((s) => s.mode)
  const isModalOpen = useStore((s) => s.isStoryletModalOpen)
  const setMode = useStore((s) => s.setMode)

  const handleEnterProject = useCallback((targetMode: AppMode) => {
    setMode(targetMode)
  }, [setMode])

  if (mode === 'home') {
    return <StartScreen onEnterProject={handleEnterProject} />
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Toolbar />
      {mode === 'design' ? <DesignMode /> : <PlayMode />}
      {isModalOpen && <StoryletModal />}
    </div>
  )
}
