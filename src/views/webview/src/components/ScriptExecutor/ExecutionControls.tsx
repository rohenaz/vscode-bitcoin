import { Button } from '@/components/ui/button'
import { Play, Pause, SkipBack, SkipForward, RotateCcw, FastForward } from 'lucide-react'

interface ExecutionControlsProps {
  isAtStart: boolean
  isAtEnd: boolean
  isPlaying: boolean
  canStepForward: boolean
  canStepBackward: boolean
  onStepBackward: () => void
  onStepForward: () => void
  onRunToEnd: () => void
  onReset: () => void
  onToggleAutoPlay: () => void
  currentStep: number
  totalSteps: number
}

export function ExecutionControls({
  isAtStart,
  isAtEnd,
  isPlaying,
  canStepForward,
  canStepBackward,
  onStepBackward,
  onStepForward,
  onRunToEnd,
  onReset,
  onToggleAutoPlay,
  currentStep,
  totalSteps
}: ExecutionControlsProps) {
  return (
    <div className="flex flex-col gap-3 p-3 bg-[#1a1a1a] border border-border rounded-lg">
      {/* Step Counter */}
      <div className="flex justify-between items-center text-xs">
        <span className="text-muted-foreground">Step</span>
        <span className="font-mono font-semibold">
          {currentStep} / {totalSteps}
        </span>
      </div>

      {/* Main Controls */}
      <div className="flex gap-2">
        {/* Reset */}
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          disabled={isAtStart}
          className="flex-1"
          title="Reset to beginning"
        >
          <RotateCcw className="h-3 w-3" />
        </Button>

        {/* Step Backward */}
        <Button
          variant="outline"
          size="sm"
          onClick={onStepBackward}
          disabled={!canStepBackward || isPlaying}
          className="flex-1"
          title="Step backward"
        >
          <SkipBack className="h-3 w-3" />
        </Button>

        {/* Auto-Play / Pause */}
        <Button
          variant={isPlaying ? "default" : "outline"}
          size="sm"
          onClick={onToggleAutoPlay}
          disabled={isAtEnd}
          className="flex-1"
          title={isPlaying ? "Pause auto-play" : "Start auto-play"}
        >
          {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
        </Button>

        {/* Step Forward */}
        <Button
          variant="outline"
          size="sm"
          onClick={onStepForward}
          disabled={!canStepForward || isPlaying}
          className="flex-1"
          title="Step forward"
        >
          <SkipForward className="h-3 w-3" />
        </Button>

        {/* Run to End */}
        <Button
          variant="outline"
          size="sm"
          onClick={onRunToEnd}
          disabled={isAtEnd || isPlaying}
          className="flex-1"
          title="Run to end"
        >
          <FastForward className="h-3 w-3" />
        </Button>
      </div>

      {/* Status Indicator */}
      <div className="text-xs text-center">
        {isPlaying && (
          <span className="text-green-400">▶ Running...</span>
        )}
        {isAtEnd && !isPlaying && (
          <span className="text-blue-400">✓ Execution complete</span>
        )}
        {isAtStart && !isPlaying && !isAtEnd && (
          <span className="text-muted-foreground">Ready to execute</span>
        )}
        {!isAtStart && !isAtEnd && !isPlaying && (
          <span className="text-yellow-400">⏸ Paused</span>
        )}
      </div>
    </div>
  )
}
