import { useEffect, useRef } from 'react'

interface IdenticonProps {
  value: string
  className?: string
}

export function Identicon({ value, className = 'w-8 h-8' }: IdenticonProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current || !value) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Simple hash function
    const hash = Array.from(value).reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0)
    }, 0)

    // Generate colors from hash
    const hue = Math.abs(hash) % 360
    const saturation = 50 + (Math.abs(hash >> 8) % 30)
    const lightness = 40 + (Math.abs(hash >> 16) % 20)

    // Set canvas size
    const size = 40
    canvas.width = size
    canvas.height = size

    // Generate 5x5 grid pattern (symmetric)
    const gridSize = 5
    const cellSize = size / gridSize

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        // Make it symmetric
        const actualX = x < 3 ? x : 4 - x
        const index = y * 3 + actualX
        const bit = (hash >> index) & 1

        if (bit) {
          ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`
        } else {
          ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness + 20}%)`
        }

        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)
      }
    }
  }, [value])

  return <canvas ref={canvasRef} className={`rounded ${className}`} />
}
