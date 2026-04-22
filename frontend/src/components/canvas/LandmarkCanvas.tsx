import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  type OnNodesChange,
  type NodeChange,
  SelectionMode,
} from '@xyflow/react'
import { useStore } from '../../store/useStore'
import LandmarkNode from './LandmarkNode'
import TransitionEdge from './TransitionEdge'
import type { Landmark } from '../../types'

const nodeTypes: NodeTypes = { landmark: LandmarkNode as NodeTypes['landmark'] }
const edgeTypes: EdgeTypes = { transition: TransitionEdge as EdgeTypes['transition'] }

function landmarksToInitialNodes(landmarks: Landmark[]): Node[] {
  return landmarks.map((lm) => ({
    id: lm.id,
    type: 'landmark' as const,
    position: lm.position ?? { x: 0, y: 0 },
    data: { landmark: lm },
  }))
}

function landmarksToEdges(landmarks: Landmark[]): Edge[] {
  const edges: Edge[] = []
  for (const lm of landmarks) {
    for (let i = 0; i < lm.transitions.length; i++) {
      const t = lm.transitions[i]
      let edgeType: 'condition' | 'count' | 'fallback' | 'turnlimit' = 'condition'
      if (t.is_fallback) edgeType = 'fallback'
      else if (t.storylet_count != null) edgeType = 'count'
      else if (t.turn_limit != null) edgeType = 'turnlimit'
      else if (t.conditions.length > 0) edgeType = 'condition'

      edges.push({
        id: `${lm.id}->${t.target_id}-${i}`,
        source: lm.id,
        target: t.target_id,
        sourceHandle: 'source',
        targetHandle: 'target',
        type: 'transition',
        data: { label: t.label || undefined, edgeType },
        animated: t.is_fallback,
      })
    }
  }
  return edges
}

export default function LandmarkCanvas() {
  const landmarks = useStore((s) => s.landmarks)
  const selectLandmark = useStore((s) => s.selectLandmark)
  const selectLandmarks = useStore((s) => s.selectLandmarks)
  const selectedLandmarkId = useStore((s) => s.selectedLandmarkId)
  const selectedLandmarkIds = useStore((s) => s.selectedLandmarkIds)
  const setRightPanel = useStore((s) => s.setRightPanel)
  const rightPanel = useStore((s) => s.rightPanel)
  const updateLandmarksPositions = useStore((s) => s.updateLandmarksPositions)

  // React Flow 管理节点/边状态（拖拽实时流畅）
  const [nodes, setNodes, onNodesChange] = useNodesState(
    useMemo(() => landmarksToInitialNodes(landmarks), [])
  )
  const [edges, setEdges] = useEdgesState(
    useMemo(() => landmarksToEdges(landmarks), [])
  )

  // 记录拖拽前的初始位置，用于拖拽结束时只 pushUndo 一次
  const dragStartPositions = useRef<Map<string, { x: number; y: number }>>(null)
  const hasDragged = useRef(false)

  // 拦截 onNodesChange：过滤选中状态变化，自己通过 store 管理
  const wrappedOnNodesChange: OnNodesChange = useCallback((changes: NodeChange[]) => {
    // 过滤掉 select 事件，让 React Flow 的内置 selected 管理正常工作（框选/Shift+点击需要）
    onNodesChange(changes)
  }, [onNodesChange])

  // Store 中 landmark 数据变化 → 同步 data 引用（保留位置）
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => {
        const lm = landmarks.find((l) => l.id === n.id)
        if (!lm) return n
        return { ...n, data: { landmark: lm } }
      })
    )
  }, [landmarks, setNodes])

  // Store 中 landmark 结构变化（增删）→ 同步节点和边
  useEffect(() => {
    const lmIds = new Set(landmarks.map((l) => l.id))

    setNodes((nds) => {
      const existingIds = new Set(nds.map((n) => n.id))
      let changed = false

      const added = landmarks.filter((lm) => !existingIds.has(lm.id))
      if (added.length > 0) changed = true

      const removed = nds.filter((n) => !lmIds.has(n.id))
      if (removed.length > 0) changed = true

      if (!changed) return nds

      return [
        ...nds.filter((n) => lmIds.has(n.id)),
        ...added.map((lm) => ({
          id: lm.id,
          type: 'landmark' as const,
          position: lm.position ?? { x: 0, y: 0 },
          data: { landmark: lm },
        })),
      ]
    })

    setEdges(landmarksToEdges(landmarks))
  }, [landmarks, setNodes, setEdges])

  // 选中状态同步：React Flow 选中变化 → 更新 store
  const onSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: Node[] }) => {
    const ids = selectedNodes.map((n) => n.id)
    selectLandmarks(ids)
  }, [selectLandmarks])

  // 双击节点：选中并回到蓝图（inspector）
  const onNodeDoubleClick = useCallback(() => {
    selectLandmarks([useStore.getState().selectedLandmarkId].filter(Boolean))
    if (rightPanel !== 'inspector') setRightPanel('inspector')
  }, [selectLandmarks, rightPanel, setRightPanel])

  // 拖拽开始：记录初始位置
  const onNodeDragStart = useCallback((_event: React.MouseEvent, node: Node) => {
    // 如果拖拽的是已选中节点之一，记录所有已选中节点的位置
    const store = useStore.getState()
    const selectedIds = store.selectedLandmarkIds
    const isMultiDrag = selectedIds.length > 1 && selectedIds.includes(node.id)

    if (isMultiDrag) {
      dragStartPositions.current = new Map()
      for (const id of selectedIds) {
        const n = useStore.getState().landmarks.find((l) => l.id === id)
        if (n?.position) dragStartPositions.current.set(id, { ...n.position })
      }
    } else {
      dragStartPositions.current = new Map([[node.id, { ...node.position }]])
    }
    hasDragged.current = true
  }, [])

  // 拖拽中：实时同步所有选中节点到 store（保持与 React Flow 位置一致）
  const onNodeDrag = useCallback((_event: React.MouseEvent, draggedNode: Node) => {
    if (!dragStartPositions.current) return
    const store = useStore.getState()
    const selectedIds = store.selectedLandmarkIds
    const isMultiDrag = selectedIds.length > 1 && selectedIds.includes(draggedNode.id)

    if (isMultiDrag && dragStartPositions.current.size > 1) {
      // 计算拖拽偏移量
      const startPos = dragStartPositions.current.get(draggedNode.id)
      if (!startPos) return
      const dx = draggedNode.position.x - startPos.x
      const dy = draggedNode.position.y - startPos.y

      const updates: { id: string; position: { x: number; y: number } }[] = []
      for (const [id, pos] of dragStartPositions.current) {
        updates.push({ id, position: { x: pos.x + dx, y: pos.y + dy } })
      }
      updateLandmarksPositions(updates)
    }
  }, [updateLandmarksPositions])

  // 拖拽结束：同步最终位置到 store
  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      useStore.getState().updateLandmarkPosition(node.id, node.position)
      dragStartPositions.current = null
    },
    []
  )

  // 从节点 Handle 拖拽连线到另一个节点（同方向只允许一条）
  const onConnect = useCallback(
    (connection: { source: string; target: string }) => {
      const { landmarks: lms } = useStore.getState()
      const src = lms.find((l) => l.id === connection.source)
      if (!src) return
      const alreadyExists = src.transitions.some((t) => t.target_id === connection.target)
      if (alreadyExists) {
        alert(`「${src.title || src.id}」已有指向该节点的连线，不允许重复添加。`)
        return
      }
      useStore.getState().addTransition(connection.source, connection.target)
    },
    []
  )

  // 右键边 → 删除
  const onEdgeContextMenu = useCallback(
    (e: React.MouseEvent, edge: Edge) => {
      e.preventDefault()
      const edgeId: string = edge.id
      const lastDash = edgeId.lastIndexOf('-')
      if (lastDash === -1) return
      const idx = parseInt(edgeId.slice(lastDash + 1), 10)
      if (isNaN(idx)) return
      const { landmarks: lms } = useStore.getState()
      const src = lms.find((l) => l.id === edge.source)
      const tgt = src?.transitions[idx]?.target_id
      const tgtLm = lms.find((l) => l.id === tgt)
      if (window.confirm(`删除连线：${src?.title || edge.source} → ${tgtLm?.title || tgt || '?'}？`)) {
        useStore.getState().removeTransition(edge.source, idx)
      }
    },
    []
  )

  // Delete 快捷键：选中节点后按 Delete/Backspace 删除（支持多选批量删除）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { selectedLandmarkIds: ids, deleteLandmarks, deleteLandmark, landmarks: lms } = useStore.getState()
        if (ids.length > 1) {
          e.preventDefault()
          const names = ids.map((id) => lms.find((l) => l.id === id)?.title || id).join('、')
          if (window.confirm(`确认删除以下 ${ids.length} 个节点？\n\n${names}\n\n这些节点的所有出边也将被移除。`)) {
            deleteLandmarks(ids)
          }
        } else if (selectedLandmarkId) {
          e.preventDefault()
          const lm = lms.find((l) => l.id === selectedLandmarkId)
          if (lm && window.confirm(`确认删除「${lm.title || lm.id}」？\n\n该节点的所有出边也将被移除。`)) {
            deleteLandmark(selectedLandmarkId)
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedLandmarkId])

  // 中键拖拽平移画布（React Flow 不原生支持中键 pan）
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0, vpX: 0, vpY: 0 })
  const reactFlowWrapper = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = reactFlowWrapper.current?.querySelector('.react-flow__pane')
    if (!el) return

    const onDown = (e: PointerEvent) => {
      if (e.button !== 1) return // 中键
      e.preventDefault()
      e.stopPropagation()
      isPanningRef.current = true
      panStartRef.current = { x: e.clientX, y: e.clientY, vpX: 0, vpY: 0 }
    }
    const onMove = (e: PointerEvent) => {
      if (!isPanningRef.current) return
      e.preventDefault()
      // 用 setViewport 做 delta 平移
      const dx = e.clientX - panStartRef.current.x
      const dy = e.clientY - panStartRef.current.y
      panStartRef.current.x = e.clientX
      panStartRef.current.y = e.clientY
      const rf = (window as any).__reactFlowInstance
      if (rf) {
        const vp = rf.getViewport()
        rf.setViewport({ x: vp.x + dx, y: vp.y + dy, zoom: vp.zoom })
      }
    }
    const onUp = () => { isPanningRef.current = false }

    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  // 保存 React Flow 实例引用供中键平移使用
  const onInit = useCallback((instance: any) => {
    (window as any).__reactFlowInstance = instance
  }, [])

  return (
    <div ref={reactFlowWrapper} style={{ width: '100%', height: '100%' }}>
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          {[
            { id: 'arrow-condition', color: '#2ecc71' },
            { id: 'arrow-count',     color: '#f1c40f' },
            { id: 'arrow-fallback',  color: '#e74c3c' },
            { id: 'arrow-turnlimit', color: '#e67e22' },
          ].map(({ id, color }) => (
            <marker key={id} id={id} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill={color} />
            </marker>
          ))}
        </defs>
      </svg>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={wrappedOnNodesChange}
        onSelectionChange={onSelectionChange}
        onConnect={onConnect}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onEdgeContextMenu={onEdgeContextMenu}
        onNodeDoubleClick={onNodeDoubleClick}
        onInit={onInit}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        selectionMode={SelectionMode.Partial}
        panOnDrag={false}
        selectionOnDrag={true}
        zoomOnDoubleClick={false}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
        defaultEdgeOptions={{ type: 'transition' }}
        elevateEdgesOnSelect={false}
        deleteKeyCode={null}
        connectOnClick={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e2130" />
        <Controls style={{ bottom: 24, left: 24 }} showInteractive={false} />
        <MiniMap
          style={{ bottom: 24, right: 24 }}
          nodeColor={(n) => {
            const lm = landmarks.find((l) => l.id === n.id)
            return lm?.is_ending ? '#7a5a1a' : '#2e3250'
          }}
          maskColor="rgba(15,17,23,0.8)"
        />
      </ReactFlow>
    </div>
  )
}
