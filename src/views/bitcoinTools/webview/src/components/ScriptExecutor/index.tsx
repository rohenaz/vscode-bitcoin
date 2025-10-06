import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { ExecutionControls } from './ExecutionControls'
import { ScriptCodeView } from './ScriptCodeView'
import { StackVisualizer } from './StackVisualizer'
import type { ExecutionStep, SpendParams } from '../../types/scriptExecution'
import { getVscode } from '../../vscode'

interface ScriptExecutorProps {
  spendParams: SpendParams
  onClose?: () => void
}

export function ScriptExecutor({ spendParams, onClose }: ScriptExecutorProps) {
  const vscode = getVscode()

  // Execution state
  const [currentStep, setCurrentStep] = useState<ExecutionStep | null>(null)
  const [executionHistory, setExecutionHistory] = useState<ExecutionStep[]>([])
  const [currentStepIndex, setCurrentStepIndex] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [executorId] = useState(() => `executor-${Date.now()}`)
  const [unlockingScript, setUnlockingScript] = useState<any>(null)
  const [lockingScript, setLockingScript] = useState<any>(null)

  // Initialize executor on mount
  useEffect(() => {
    vscode.postMessage({
      type: 'scriptExecutor:init',
      data: { id: executorId, spendParams }
    })

    // Cleanup on unmount
    return () => {
      vscode.postMessage({
        type: 'scriptExecutor:destroy',
        data: { id: executorId }
      })
    }
  }, [executorId, spendParams, vscode])

  // Listen for execution updates
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data

      if (message.type === 'scriptExecutor:initialized' && message.data.id === executorId) {
        setUnlockingScript(message.data.unlockingScript)
        setLockingScript(message.data.lockingScript)
      }

      if (message.type === 'scriptExecutor:step' && message.data.id === executorId) {
        const step = message.data.step as ExecutionStep
        setCurrentStep(step)
        setExecutionHistory(prev => [...prev, step])
        setCurrentStepIndex(prev => prev + 1)
      }

      if (message.type === 'scriptExecutor:reset' && message.data.id === executorId) {
        setCurrentStep(null)
        setExecutionHistory([])
        setCurrentStepIndex(-1)
      }

      if (message.type === 'scriptExecutor:runComplete' && message.data.id === executorId) {
        setExecutionHistory(message.data.steps)
        setCurrentStepIndex(message.data.steps.length - 1)
        setCurrentStep(message.data.steps[message.data.steps.length - 1] || null)
        setIsPlaying(false)
      }

      if (message.type === 'scriptExecutor:history' && message.data.id === executorId) {
        setExecutionHistory(message.data.history)
        setCurrentStepIndex(message.data.currentIndex)
        setCurrentStep(message.data.history[message.data.currentIndex] || null)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [executorId])

  // Auto-play logic
  useEffect(() => {
    if (!isPlaying || isAtEnd) {
      return
    }

    const timer = setTimeout(() => {
      handleStepForward()
    }, 500) // 500ms between steps

    return () => clearTimeout(timer)
  }, [isPlaying, currentStepIndex])

  const handleStepForward = () => {
    vscode.postMessage({
      type: 'scriptExecutor:stepForward',
      data: { id: executorId }
    })
  }

  const handleStepBackward = () => {
    vscode.postMessage({
      type: 'scriptExecutor:stepBackward',
      data: { id: executorId }
    })
  }

  const handleRunToEnd = () => {
    vscode.postMessage({
      type: 'scriptExecutor:runToEnd',
      data: { id: executorId }
    })
  }

  const handleReset = () => {
    setIsPlaying(false)
    vscode.postMessage({
      type: 'scriptExecutor:reset',
      data: { id: executorId }
    })
  }

  const handleToggleAutoPlay = () => {
    setIsPlaying(!isPlaying)
  }

  // Derived state
  const isAtStart = currentStepIndex <= 0
  const isAtEnd = currentStep !== null && !currentStep.success
  const canStepForward = !isAtEnd
  const canStepBackward = currentStepIndex > 0

  // Get current execution state
  const stack = currentStep?.stack || []
  const altStack = currentStep?.altStack || []
  const ifStack = currentStep?.ifStack || []
  const context = currentStep?.context || 'UnlockingScript'
  const programCounter = currentStep?.programCounter || 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Script Execution Visualizer</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        )}
      </div>

      {/* Execution Controls */}
      <ExecutionControls
        isAtStart={isAtStart}
        isAtEnd={isAtEnd}
        isPlaying={isPlaying}
        canStepForward={canStepForward}
        canStepBackward={canStepBackward}
        onStepBackward={handleStepBackward}
        onStepForward={handleStepForward}
        onRunToEnd={handleRunToEnd}
        onReset={handleReset}
        onToggleAutoPlay={handleToggleAutoPlay}
        currentStep={currentStepIndex + 1}
        totalSteps={executionHistory.length}
      />

      {/* Current Opcode Info */}
      {currentStep && (
        <Card className="p-3 bg-[#1a1a1a]">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-sm font-semibold text-blue-400">
                {currentStep.opcodeName}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {currentStep.description}
              </div>
            </div>
            <div className="text-right text-xs">
              <div className="text-muted-foreground">
                {currentStep.context}
              </div>
              <div className="font-mono text-muted-foreground">
                PC: {currentStep.programCounter}
              </div>
            </div>
          </div>

          {!currentStep.success && currentStep.error && (
            <div className="mt-2 p-2 bg-red-500/10 border border-red-500/50 rounded">
              <div className="text-xs text-red-400">
                ❌ Error: {currentStep.error}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Script Code */}
        <ScriptCodeView
          unlockingScript={unlockingScript || { chunks: [] }}
          lockingScript={lockingScript || { chunks: [] }}
          currentContext={context}
          currentPC={programCounter}
        />

        {/* Right: Stack Visualizer */}
        <StackVisualizer
          stack={stack}
          altStack={altStack}
          ifStack={ifStack}
        />
      </div>
    </div>
  )
}
