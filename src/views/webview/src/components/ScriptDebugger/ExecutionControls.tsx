import { Button } from '@/components/ui/button'
import { Play, Pause, SkipBack, SkipForward, RotateCcw, FastForward, Settings, Check, Infinity as InfinityIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type PlaybackSpeed = 0.5 | 1 | 2 | 4 | typeof Infinity

interface ExecutionControlsProps {
  isAtStart: boolean
  isAtEnd: boolean
  isPlaying: boolean
  isAtBreakpoint: boolean
  canStepForward: boolean
  canStepBackward: boolean
  onStepBackward: () => void
  onStepForward: () => void
  onRunToEnd: () => void
  onReset: () => void
  onToggleAutoPlay: () => void
  currentStep: number
  totalSteps: number
  playbackSpeed: PlaybackSpeed
  onSpeedChange: (speed: PlaybackSpeed) => void
}

export function ExecutionControls({
  isAtStart,
  isAtEnd,
  isPlaying,
  isAtBreakpoint,
  canStepForward,
  canStepBackward,
  onStepBackward,
  onStepForward,
  onRunToEnd,
  onReset,
  onToggleAutoPlay,
  currentStep,
  totalSteps,
  playbackSpeed,
  onSpeedChange
}: ExecutionControlsProps) {
  const getSpeedLabel = (speed: PlaybackSpeed) => {
    if (speed === Infinity) return 'Max'
    return `${speed}x`
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Step Counter and Settings */}
      <div className="flex justify-between items-center text-xs">
        <span className="text-muted-foreground">Step</span>
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold">
            {currentStep} / {totalSteps}
          </span>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-5 w-5"
                title="Playback settings"
              >
                <Settings className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-40" align="end">
              <DropdownMenuLabel>Playback Speed</DropdownMenuLabel>
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onSelect={() => onSpeedChange(0.5)}
                  className={playbackSpeed === 0.5 ? 'bg-accent' : ''}
                >
                  <span className="flex items-center justify-between w-full">
                    <span>0.5x</span>
                    {playbackSpeed === 0.5 && <Check className="h-3 w-3" />}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => onSpeedChange(1)}
                  className={playbackSpeed === 1 ? 'bg-accent' : ''}
                >
                  <span className="flex items-center justify-between w-full">
                    <span>1x (Normal)</span>
                    {playbackSpeed === 1 && <Check className="h-3 w-3" />}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => onSpeedChange(2)}
                  className={playbackSpeed === 2 ? 'bg-accent' : ''}
                >
                  <span className="flex items-center justify-between w-full">
                    <span>2x</span>
                    {playbackSpeed === 2 && <Check className="h-3 w-3" />}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => onSpeedChange(4)}
                  className={playbackSpeed === 4 ? 'bg-accent' : ''}
                >
                  <span className="flex items-center justify-between w-full">
                    <span>4x</span>
                    {playbackSpeed === 4 && <Check className="h-3 w-3" />}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => onSpeedChange(Infinity)}
                  className={playbackSpeed === Infinity ? 'bg-accent' : ''}
                >
                  <span className="flex items-center justify-between w-full">
                    <span className="flex items-center gap-1.5">
                      <InfinityIcon className="h-3.5 w-3.5" />
                      <span>Max Speed</span>
                    </span>
                    {playbackSpeed === Infinity && <Check className="h-3 w-3" />}
                  </span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
        {isPlaying ? (
          <span className="flex items-center justify-center gap-1.5 text-green-400">
            <Play className="h-3 w-3" />
            Running at {getSpeedLabel(playbackSpeed)}
          </span>
        ) : isAtEnd ? (
          <span className="flex items-center justify-center gap-1.5 text-blue-400">
            <Check className="h-3 w-3" />
            Done
          </span>
        ) : isAtBreakpoint ? (
          <span className="flex items-center justify-center gap-1.5 text-yellow-400">
            <Pause className="h-3 w-3" />
            Break
          </span>
        ) : isAtStart ? (
          <span className="text-muted-foreground">Ready</span>
        ) : (
          <span className="flex items-center justify-center gap-1.5 text-muted-foreground">
            <Pause className="h-3 w-3" />
            Paused
          </span>
        )}
      </div>
    </div>
  )
}
