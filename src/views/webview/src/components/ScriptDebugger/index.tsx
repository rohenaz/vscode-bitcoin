import { useState, useEffect, useRef } from 'react'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { PlayCircle, PauseCircle, CheckCircle, XCircle, ExternalLink } from 'lucide-react'
import { getVscode } from '../../vscode'
import { Utils, OP } from '@bsv/sdk'
import { ExecutionControls, type PlaybackSpeed } from './ExecutionControls'
import { ScriptCodeView } from './ScriptCodeView'
import { StackVisualizer } from './StackVisualizer'
import type { ExecutionStep, SpendParams } from '../../types/scriptExecution'

interface ScriptDebuggerProps {
  spendParams: SpendParams
}

export function ScriptDebugger({ spendParams }: ScriptDebuggerProps) {
  const vscode = getVscode()

  // Helper to open Bitcoin wiki for opcode
  const openOpcodeWiki = () => {
    const wikiUrl = 'https://wiki.bitcoinsv.io/index.php/Opcodes_used_in_Bitcoin_Script'
    vscode.postMessage({
      type: 'openExternal',
      url: wikiUrl
    })
  }

  // Execution state
  const [currentStep, setCurrentStep] = useState<ExecutionStep | null>(null)
  const [currentStepIndex, setCurrentStepIndex] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [executorId] = useState(() => `executor-${Date.now()}`)
  const [unlockingScript, setUnlockingScript] = useState<any>(null)
  const [lockingScript, setLockingScript] = useState<any>(null)
  const [totalSteps, setTotalSteps] = useState<number>(0)
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1)
  const animationFrameRef = useRef<number | null>(null)

  // Throttling for UI updates during fast execution
  const pendingStepRef = useRef<{ step: ExecutionStep; index: number } | null>(null)
  const lastUIUpdateRef = useRef<number>(0)
  const uiUpdateTimerRef = useRef<number | null>(null)
  const actualStepIndexRef = useRef<number>(-1) // Track actual step count independently

  // Throttled UI update function - max 2x per second (500ms)
  const updateUIState = (step: ExecutionStep, index: number, immediate = false) => {
    const now = Date.now()
    const timeSinceLastUpdate = now - lastUIUpdateRef.current

    // If not playing fast or immediate update requested, update immediately
    if (immediate || playbackSpeed <= 1 || timeSinceLastUpdate >= 500) {
      setCurrentStep(step)
      setCurrentStepIndex(index)
      lastUIUpdateRef.current = now
      pendingStepRef.current = null

      // Clear any pending timer
      if (uiUpdateTimerRef.current) {
        clearTimeout(uiUpdateTimerRef.current)
        uiUpdateTimerRef.current = null
      }
    } else {
      // Store the pending update
      pendingStepRef.current = { step, index }

      // Schedule update if not already scheduled
      if (!uiUpdateTimerRef.current) {
        const delay = 500 - timeSinceLastUpdate
        uiUpdateTimerRef.current = window.setTimeout(() => {
          if (pendingStepRef.current) {
            setCurrentStep(pendingStepRef.current.step)
            setCurrentStepIndex(pendingStepRef.current.index)
            lastUIUpdateRef.current = Date.now()
            pendingStepRef.current = null
          }
          uiUpdateTimerRef.current = null
        }, delay)
      }
    }
  }

  // Initialize executor on mount
  useEffect(() => {
    vscode.postMessage({
      type: 'scriptDebugger:init',
      data: { id: executorId, spendParams }
    })

    // Cleanup on unmount
    return () => {
      if (uiUpdateTimerRef.current) {
        clearTimeout(uiUpdateTimerRef.current)
      }
      vscode.postMessage({
        type: 'scriptDebugger:destroy',
        data: { id: executorId }
      })
    }
  }, [executorId, spendParams, vscode])

  // Listen for execution updates
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data

      if (message.type === 'scriptDebugger:initialized' && message.data.id === executorId) {
        setUnlockingScript(message.data.unlockingScript)
        setLockingScript(message.data.lockingScript)
        // Calculate total steps: unlocking script chunks + locking script chunks
        const total = message.data.unlockingScript.chunks.length + message.data.lockingScript.chunks.length
        setTotalSteps(total)
      }

      if (message.type === 'scriptDebugger:step' && message.data.id === executorId) {
        const step = message.data.step as ExecutionStep

        // Only increment step counter for actual execution steps (not breakpoint pauses)
        if (!step.breakpointHit) {
          actualStepIndexRef.current += 1
        }

        // Check if this is a stopping condition
        const shouldStop = step.breakpointHit || step.isComplete || !step.success

        // Debug: Log final step
        if (step.isComplete) {
          console.log('[ScriptDebugger] FINAL STEP received:', {
            opcode: step.opcodeName,
            pc: step.programCounter,
            context: step.context,
            stackTop: step.stack[step.stack.length - 1],
            isComplete: step.isComplete
          })
        }

        // Use immediate update for stopping conditions, throttled otherwise
        updateUIState(step, actualStepIndexRef.current, shouldStop)

        // Auto-stop if we hit a breakpoint or reached completion
        if (shouldStop) {
          setIsPlaying(false)
        }
      }

      if (message.type === 'scriptDebugger:reset' && message.data.id === executorId) {
        // Immediate update for reset
        actualStepIndexRef.current = -1
        updateUIState(null as any, -1, true)
        setIsPlaying(false)
      }

      if (message.type === 'scriptDebugger:runComplete' && message.data.id === executorId) {
        // Immediate update for completion
        const finalStep = message.data.steps[message.data.steps.length - 1] || null
        const finalIndex = message.data.steps.length - 1
        actualStepIndexRef.current = finalIndex
        updateUIState(finalStep, finalIndex, true)
        setIsPlaying(false)
      }

      if (message.type === 'scriptDebugger:history' && message.data.id === executorId) {
        // Immediate update for history navigation
        const step = message.data.history[message.data.currentIndex] || null
        actualStepIndexRef.current = message.data.currentIndex
        updateUIState(step, message.data.currentIndex, true)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [executorId, playbackSpeed])

  // Derived state (must be calculated before useEffect that depends on them)
  const isAtStart = currentStepIndex <= 0
  const isAtEnd = currentStep !== null && (!currentStep.success || currentStep.isComplete === true)
  const breakpointHit = currentStep?.breakpointHit === true
  const canStepForward = !isAtEnd
  const canStepBackward = currentStepIndex > 0

  // Auto-play logic with speed control and breakpoint handling
  useEffect(() => {

    // Stop if not playing or reached the end
    if (!isPlaying || isAtEnd) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      return
    }


    // For infinite speed, use requestAnimationFrame for maximum speed
    if (playbackSpeed === Infinity) {
      const runNextStep = () => {
        if (isPlaying && !isAtEnd) {
          handleStepForward()
          animationFrameRef.current = requestAnimationFrame(runNextStep)
        }
      }
      animationFrameRef.current = requestAnimationFrame(runNextStep)
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }
      }
    }

    // For normal speeds, use setTimeout with calculated delay
    // Base delay is 1000ms, divided by speed (0.5x = 2000ms, 1x = 1000ms, 2x = 500ms, 4x = 250ms)
    const delay = 1000 / playbackSpeed
    const timer = setTimeout(() => {
      handleStepForward()
    }, delay)

    return () => clearTimeout(timer)
  }, [isPlaying, currentStepIndex, playbackSpeed, isAtEnd, breakpointHit])

  const handleStepForward = () => {
    vscode.postMessage({
      type: 'scriptDebugger:stepForward',
      data: { id: executorId }
    })
  }

  const handleStepBackward = () => {
    vscode.postMessage({
      type: 'scriptDebugger:stepBackward',
      data: { id: executorId }
    })
  }

  const handleRunToEnd = () => {
    vscode.postMessage({
      type: 'scriptDebugger:runToEnd',
      data: { id: executorId }
    })
  }

  const handleReset = () => {
    setIsPlaying(false)
    vscode.postMessage({
      type: 'scriptDebugger:reset',
      data: { id: executorId }
    })
  }

  const handleToggleAutoPlay = () => {
    const newIsPlaying = !isPlaying

    // If stopping playback, flush any pending UI updates immediately
    if (!newIsPlaying && pendingStepRef.current) {
      setCurrentStep(pendingStepRef.current.step)
      setCurrentStepIndex(pendingStepRef.current.index)
      pendingStepRef.current = null
      if (uiUpdateTimerRef.current) {
        clearTimeout(uiUpdateTimerRef.current)
        uiUpdateTimerRef.current = null
      }
    }

    setIsPlaying(newIsPlaying)
  }

  // Get current execution state
  const stack = currentStep?.stack || []
  const altStack = currentStep?.altStack || []
  const ifStack = currentStep?.ifStack || []
  const context = currentStep?.context || 'UnlockingScript'
  // programCounter represents the instruction that was just executed
  // Default to -1 so that highlighting shows instruction 0 (the first one to execute)
  const programCounter = currentStep?.programCounter ?? -1

  // Helper to get info about the next instruction to execute
  const getNextInstructionInfo = () => {
    const nextPC = programCounter + 1
    const script = context === 'UnlockingScript' ? unlockingScript : lockingScript

    if (!script || nextPC < 0 || nextPC >= script.chunks.length) {
      return null
    }

    const chunk = script.chunks[nextPC]
    const opcode = chunk.op

    // Get opcode name (same logic as ScriptCodeView)
    let opcodeName = `OP_UNKNOWN_${opcode}`
    if (opcode >= 1 && opcode <= 75) {
      opcodeName = `<${opcode} bytes>`
    } else {
      // Find opcode name from @bsv/sdk OP enum
      for (const [key, value] of Object.entries(OP)) {
        if (value === opcode) {
          opcodeName = key
          break
        }
      }
    }

    return {
      pc: nextPC,
      opcode,
      opcodeName,
      data: chunk.data
    }
  }

  const nextInstruction = getNextInstructionInfo()

  return (
    <div className="flex flex-col h-full">
      {/* Header: Execution Controls + Current Opcode Info - Resizable */}
      <div className="flex-shrink-0">
        <ResizablePanelGroup direction="horizontal">
          {/* Left: Execution Controls */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="p-3 h-full">
              <ExecutionControls
                isAtStart={isAtStart}
                isAtEnd={isAtEnd}
                isPlaying={isPlaying}
                isAtBreakpoint={breakpointHit}
                canStepForward={canStepForward}
                canStepBackward={canStepBackward}
                onStepBackward={handleStepBackward}
                onStepForward={handleStepForward}
                onRunToEnd={handleRunToEnd}
                onReset={handleReset}
                onToggleAutoPlay={handleToggleAutoPlay}
                currentStep={currentStepIndex + 1}
                totalSteps={totalSteps}
                playbackSpeed={playbackSpeed}
                onSpeedChange={setPlaybackSpeed}
              />
            </div>
          </ResizablePanel>

          <ResizableHandle />

          {/* Right: Current Opcode Info or Final Result */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="p-3 h-full flex flex-col">
              {currentStep && currentStep.isComplete ? (
                /* Final Result Display - Compact Empty State */
                <div className="flex items-center justify-center gap-3 h-full">
                  {(() => {
                    const stackTop = currentStep.stack[currentStep.stack.length - 1]
                    const isTrue = stackTop && stackTop.length > 0 && stackTop.some(b => b !== 0)
                    return (
                      <>
                        {isTrue ? (
                          <CheckCircle className="h-8 w-8 text-green-400 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-8 w-8 text-red-400 flex-shrink-0" />
                        )}
                        <div>
                          <div className={`text-2xl font-bold ${isTrue ? 'text-green-400' : 'text-red-400'}`}>
                            {isTrue ? 'TRUE' : 'FALSE'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Script returned {isTrue ? 'true' : 'false'}
                          </div>
                        </div>
                      </>
                    )
                  })()}
                </div>
              ) : currentStep?.breakpointHit ? (
                /* Breakpoint Paused State - Compact Empty State */
                <div className="flex items-center justify-center gap-3 h-full">
                  <PauseCircle className="h-6 w-6 text-yellow-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">Paused at Breakpoint</div>
                    {nextInstruction && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Next: <span className="font-mono text-foreground">{nextInstruction.opcodeName}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : currentStep ? (
                /* Dual Display: Previous (executed) and Next (about to execute) */
                <div className="grid grid-cols-2 gap-4 h-full">
                  {/* Left: Previous (Just Executed) */}
                  <div className="flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between mb-2 flex-shrink-0">
                      <div className="text-xs font-semibold text-blue-400">
                        {currentStep.opcodeName}
                      </div>
                      <Badge variant="secondary" className="text-[10px]">
                        Executed [{currentStep.programCounter}]
                      </Badge>
                    </div>

                    {/* Stack Changes - max 3 rows */}
                    {currentStep.stackDiff && currentStep.stackDiff.mainStackChanges.length > 0 && (
                      <ScrollArea className="h-[60px] w-full flex-shrink-0">
                        <div className="space-y-0.5">
                          {currentStep.stackDiff.mainStackChanges.map((change, idx) => (
                            <div key={idx} className="text-[9px] font-mono">
                              {change.type === 'push' && change.value && (
                                <div className="flex items-center gap-1">
                                  <span className="text-green-400">+</span>
                                  <span className="text-muted-foreground">push:</span>
                                  <span className="text-green-400 break-all">
                                    {Utils.toHex(change.value)}
                                  </span>
                                </div>
                              )}
                              {change.type === 'pop' && change.oldValue && (
                                <div className="flex items-center gap-1">
                                  <span className="text-red-400">-</span>
                                  <span className="text-muted-foreground">pop:</span>
                                  <span className="text-red-400 break-all">
                                    {Utils.toHex(change.oldValue)}
                                  </span>
                                </div>
                              )}
                              {change.type === 'modify' && (
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1">
                                    <span className="text-yellow-400">~</span>
                                    <span className="text-muted-foreground">was:</span>
                                    <span className="text-yellow-400 break-all">
                                      {change.oldValue ? Utils.toHex(change.oldValue) : ''}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-yellow-400">→</span>
                                    <span className="text-muted-foreground">now:</span>
                                    <span className="text-green-400 break-all">
                                      {change.value ? Utils.toHex(change.value) : ''}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}

                    {!currentStep.success && currentStep.error && (
                      <div className="mt-2 p-1 bg-red-500/10 border border-red-500/50 rounded flex-shrink-0">
                        <div className="text-[9px] text-red-400">
                          Error: {currentStep.error}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: Next (About to Execute) */}
                  <div className="flex flex-col overflow-hidden">
                    {nextInstruction ? (
                      <>
                        <div className="flex items-center justify-between mb-2 flex-shrink-0">
                          <div className="text-xs font-semibold text-green-400">
                            {nextInstruction.opcodeName}
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            Executing [{nextInstruction.pc}]
                          </Badge>
                        </div>

                        {/* Description and Wiki Link */}
                        <div className="flex items-start gap-2 flex-1">
                          <div className="text-[10px] text-muted-foreground flex-1">
                            {currentStep.description}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 flex-shrink-0"
                            onClick={openOpcodeWiki}
                            title="Open Bitcoin Wiki"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-muted-foreground italic">
                        No more instructions
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Before Execution State - Compact Empty State */
                <div className="flex items-center justify-center gap-3 h-full">
                  <PlayCircle className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                  <div>
                    <div className="text-sm font-semibold">Ready to Execute</div>
                    <div className="text-xs text-muted-foreground">
                      Press play or step forward to begin
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <Separator />

      {/* Resizable Two-Panel Layout */}
      <ResizablePanelGroup
        direction="horizontal"
        className="flex-1 overflow-hidden"
      >
        {/* Left: Script Code */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <ScriptCodeView
            unlockingScript={unlockingScript || { chunks: [], hex: '', asm: '' }}
            lockingScript={lockingScript || { chunks: [], hex: '', asm: '' }}
            currentContext={context}
            currentPC={programCounter}
            executorId={executorId}
            hasStarted={currentStepIndex >= 0}
            isComplete={isAtEnd}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right: Stack Visualizer */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <StackVisualizer
            stack={stack}
            altStack={altStack}
            ifStack={ifStack}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
