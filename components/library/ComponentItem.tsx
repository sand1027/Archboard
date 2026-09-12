'use client'

import { useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import type { ArchitectureComponent } from '@/types/architecture'
import { DND_MIME, setDragPayload } from '@/lib/canvas/dnd'

interface ComponentItemProps {
  component: ArchitectureComponent
  onAdd: (component: ArchitectureComponent) => void
}

export default function ComponentItem({ component, onAdd }: ComponentItemProps) {
  const [imgError, setImgError] = useState(false)
  const dragImageRef = useRef<HTMLDivElement>(null)

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      setDragPayload(e, DND_MIME.hldComponent, component.id)
      if (dragImageRef.current) {
        e.dataTransfer.setDragImage(dragImageRef.current, 20, 20)
      }
    },
    [component.id]
  )

  return (
    <>
      <div
        ref={dragImageRef}
        aria-hidden
        style={{
          position: 'fixed',
          top: -9999,
          left: -9999,
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          background: 'transparent',
        }}
      >
        {!imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={component.icon}
            alt=""
            width={40}
            height={40}
            style={{ width: 40, height: 40, objectFit: 'contain' }}
          />
        ) : (
          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>
            {component.name.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>

      <button
        type="button"
        draggable
        onDragStart={handleDragStart}
        onClick={() => onAdd(component)}
        title={`${component.name} — ${component.description}`}
        className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl cursor-grab active:cursor-grabbing
          bg-white border border-slate-200/90 hover:border-slate-300 hover:shadow-sm hover:shadow-slate-200/60
          transition-all duration-150 select-none text-left w-full"
      >
        <div className="relative w-9 h-9 flex-shrink-0 flex items-center justify-center">
          {!imgError ? (
            <Image
              src={component.icon}
              alt={component.name}
              width={36}
              height={36}
              className="w-9 h-9 object-contain"
              onError={() => setImgError(true)}
              unoptimized
              draggable={false}
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 text-[10px] font-bold">
              {component.name.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
        <span className="text-[10px] text-slate-700 text-center font-medium leading-tight line-clamp-2 w-full">
          {component.name}
        </span>
      </button>
    </>
  )
}
