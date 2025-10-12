import { useState, useEffect } from 'react'
import { ScriptExecutor } from '../components/ScriptExecutor'
import { ScriptExecutorInput } from '../components/ScriptExecutorInput'
import type { SpendParams } from '../types/scriptExecution'
import '../App.css'

export function ScriptExecutorPanel() {
  const [spendParams, setSpendParams] = useState<SpendParams | null>(null)
  const [initialUnlockingScript, setInitialUnlockingScript] = useState<string>('')

  useEffect(() => {
    document.documentElement.classList.add('dark')
    const loader = document.getElementById('initial-loader')
    if (loader) {
      loader.style.opacity = '0'
      loader.style.transition = 'opacity 0.3s'
      setTimeout(() => loader.remove(), 300)
    }

    const handleMessage = (event: MessageEvent) => {
      const message = event.data
      if (message.type === 'script:populate' && message.data?.spendParams) {
        // If the locking script is empty, show the input form with unlocking script pre-filled
        if (!message.data.spendParams.lockingScript) {
          setInitialUnlockingScript(message.data.spendParams.unlockingScript)
        } else {
          setSpendParams(message.data.spendParams)
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const handleExecute = (params: SpendParams) => {
    setSpendParams(params)
  }

  const handleReset = () => {
    setSpendParams(null)
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border p-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Script Execution Visualizer</h1>
        {spendParams && (
          <button
            onClick={handleReset}
            className="text-xs text-muted-foreground hover:text-foreground px-3 py-1 rounded hover:bg-accent"
          >
            New Script
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-4">
        {!spendParams ? (
          <ScriptExecutorInput onExecute={handleExecute} initialUnlockingScript={initialUnlockingScript} />
        ) : (
          <div className="h-full">
            <ScriptExecutor spendParams={spendParams} />
          </div>
        )}
      </div>
    </div>
  )
}
