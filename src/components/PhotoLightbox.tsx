import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { Exercise } from '../db/types'
import { GROUP_LABEL } from '../lib/labels'

interface Props {
  exercise: Exercise
  src: string
  onClose: () => void
}

/**
 * Foto de ejercicio a tamaño grande sobre un scrim. Se cierra tocando en
 * cualquier sitio o con Escape. Va en un portal para no depender de la
 * posición de la fila que la abre.
 */
export function PhotoLightbox({ exercise, src, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      opener?.focus()
    }
  }, [onClose])

  return createPortal(
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={`Foto de ${exercise.name}`}>
      <button ref={closeRef} type="button" className="lightbox__scrim" aria-label="Cerrar" onClick={onClose} />
      <figure className="lightbox__figure enter-block" onClick={onClose}>
        <img className="lightbox__img" src={src} alt="" decoding="async" />
        <figcaption className="lightbox__caption">
          <span className="t-h3">{exercise.name}</span>
          <span className="t-label-sm soft">{GROUP_LABEL[exercise.muscle_group]}</span>
        </figcaption>
      </figure>
    </div>,
    document.body,
  )
}
