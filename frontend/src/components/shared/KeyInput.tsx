import { useStore } from '../../store/useStore'
import { inputStyle } from '../inspector/Inspector'

/**
 * WorldState Key 输入框，支持从现有变量中选择或自由输入新 key。
 *
 * 内部用 <datalist> 提供自动补全，用户体验类似 combobox。
 *
 * @param filter - 按 type 过滤可选 key：
 *   - 'flag' → 仅显示 flags
 *   - 'quality' → 仅显示 qualities
 *   - 'relationship' → 仅显示 relationships
 *   - undefined → 显示所有变量
 */
export default function KeyInput({
  value,
  onChange,
  filter,
  style,
  placeholder,
}: {
  value: string
  onChange: (key: string) => void
  filter?: 'flag' | 'quality' | 'relationship'
  style?: React.CSSProperties
  placeholder?: string
}) {
  const wsd = useStore((s) => s.worldStateDefinition)

  // 根据 filter 收集可选 key 及其 label
  const options: Array<{ key: string; label: string }> = []
  if (!filter || filter === 'quality') {
    for (const q of wsd.qualities) options.push({ key: q.key, label: `${q.key} (${q.label || '品质'})` })
  }
  if (!filter || filter === 'flag') {
    for (const f of wsd.flags) options.push({ key: f.key, label: `${f.key} (${f.label || '标记'})` })
  }
  if (!filter || filter === 'relationship') {
    for (const r of wsd.relationships) options.push({ key: r.key, label: `${r.key} (${r.label || '关系'})` })
  }

  const dlId = `ws-key-${filter ?? 'all'}-${options.length}`

  return (
    <>
      <input
        list={dlId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, flex: 1, ...style }}
        placeholder={placeholder ?? 'world state key'}
      />
      <datalist id={dlId}>
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </datalist>
    </>
  )
}
