'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import type { ArchitectureComponent } from '@/types/architecture'

interface ComponentItemProps {
  component: ArchitectureComponent
  onAdd: (component: ArchitectureComponent) => void
}

export default function ComponentItem({ component, onAdd }: ComponentItemProps) {
  const [imgError, setImgError] = useState(false)

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = 'copy'
      e.dataTransfer.setData('application/archboard-component', component.id)
    },
    [component.id]
  )

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={() => onAdd(component)}
      title={`${component.name} — ${component.description}`}
      className={[
        'flex flex-col items-center gap-1.5 p-2 rounded-lg cursor-grab active:cursor-grabbing',
        'bg-white border border-gray-200 hover:border-blue-300 hover:shadow-sm',
        'transition-all duration-100 select-none group',
      ].join(' ')}
    >
      <div className="relative w-9 h-9 flex-shrink-0">
        {!imgError ? (
          <Image
            src={component.icon}
            alt={component.name}
            width={36}
            height={36}
            className="w-9 h-9 object-contain"
            onError={() => setImgError(true)}
            unoptimized
          />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-gray-200 flex items-center justify-center text-gray-500 text-[10px] font-bold">
            {component.name.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <span className="text-[10px] text-gray-700 text-center font-medium leading-tight line-clamp-2 w-full">
        {component.name}
      </span>
      {component.provider && (
        <span className="text-[9px] text-gray-400 uppercase tracking-wide">
          {component.provider}
        </span>
      )}
    </div>
  )
}
