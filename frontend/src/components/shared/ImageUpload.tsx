/**
 * ImageUpload — 90s Retro 图片上传组件
 * 点击预览区 → 选文件 → FileReader → base64 data URL → onChange(url)
 */
import { useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'

interface ImageUploadProps {
  value?: string
  onChange: (dataUrl: string | undefined) => void
  width?: number
  height?: number
  placeholder?: string
}

export default function ImageUpload({ value, onChange, width = 160, height = 120, placeholder = '点击上传图片' }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [hover, setHover] = useState(false)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => onChange(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(undefined)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        className={value ? 'bevel-in' : 'bevel-out'}
        onClick={() => inputRef.current?.click()}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          width, height,
          cursor: 'pointer',
          overflow: 'hidden',
          background: '#d0ccc8',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}
      >
        {value ? (
          <>
            <img src={value} alt="preview"
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
            {/* 悬停时 overlay */}
            {hover && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(0,0,0,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ color: '#fff', fontSize: 11, fontFamily: '"MS Sans Serif",sans-serif' }}>
                  点击更换
                </span>
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', color: '#808080', fontSize: 11, fontFamily: '"MS Sans Serif",sans-serif' }}>
            <Upload size={20} strokeWidth={1.5} style={{ marginBottom: 4 }} />
            <div>{placeholder}</div>
          </div>
        )}
      </div>

      {/* 清除按钮 */}
      {value && (
        <button onClick={handleRemove}
          className="title-bar-btn"
          style={{
            position: 'absolute', top: 2, right: 2,
            width: 18, height: 18, padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#C0C0C0',
          }}
          title="清除图片"
        >
          <X size={10} />
        </button>
      )}

      <input ref={inputRef} type="file" accept="image/*"
        onChange={handleFile}
        style={{ display: 'none' }}
      />
    </div>
  )
}
