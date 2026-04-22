# Learnings

## [LRN-20260413-001] React Flow 拖拽卡顿 - 受控模式陷阱

**Logged**: 2026-04-13T21:55:00+08:00
**Priority**: high
**Status**: resolved
**Area**: frontend

### Summary
React Flow 受控模式（传入 `nodes` prop）下，store 中的 landmark 位置在拖拽结束 (`dragging === false`) 时更新，触发 `landmarks` 引用变化 → `useMemo` 重算 nodes 数组 → React Flow 重置内部状态 → 拖拽只生效在松手瞬间。

### Details
问题根因是 React Flow 受控模式的工作机制：
1. `onNodesChange` 中位置变化需要被 apply 回 nodes 数组才能实时生效
2. 仅在 `dragging === false` 时写 store，拖拽过程中 React Flow 内部位置更新和 props 传入的 position 不一致
3. 拖拽松手时写 store → `landmarks` 变化 → `useMemo` 生成全新 nodes 数组 → React Flow 用新 position 重置节点位置
4. 实际效果：节点在拖拽时看起来"卡住"，只在松手时"跳"到新位置

### Resolution
- **已放弃的方案**: 
  - dataRef 缓存 data 引用（不够，nodes 数组本身是新的）
  - useMemo 稳定化（无法阻止 React Flow 受控重置）
- **正确方案**: 
  - 不传 `nodes` prop → 用 `setNodes`/`useNodesState` 让 React Flow 非受控管理位置
  - 拖拽结束时 (`onNodeDragStop`) 同步位置到 store
  - Store 数据变化（非位置类）通过 `applyNodeChanges` 更新节点属性
  - 位置类变化（store 数据加载时）通过 `setNodes` 强制更新

### Metadata
- Source: user_feedback (三次修复尝试未解决)
- Related Files: src/components/canvas/LandmarkCanvas.tsx, src/store/useStore.ts
- Tags: react-flow, drag-performance, controlled-mode, zustand
- Pattern-Key: react_flow.controlled_drag
- Recurrence-Count: 3
- First-Seen: 2026-04-13T21:43:00+08:00
- Last-Seen: 2026-04-13T21:54:00+08:00
