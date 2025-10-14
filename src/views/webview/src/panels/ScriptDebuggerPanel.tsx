import { useState, useEffect } from 'react'
import { ScriptDebugger } from '../components/ScriptDebugger'
import { ScriptDebuggerInput } from '../components/ScriptDebuggerInput'
import type { SpendParams } from '../types/scriptExecution'
import { getVscode } from '../vscode'
import '../App.css'

export function ScriptDebuggerPanel() {
  console.log('[ScriptDebuggerPanel] Component rendering')
  const [spendParams, setSpendParams] = useState<SpendParams | null>(null)
  const [initialUnlockingScript, setInitialUnlockingScript] = useState<string>('')

  useEffect(() => {
    console.log('[ScriptDebuggerPanel] useEffect running')
    const vscode = getVscode()

    document.documentElement.classList.add('dark')
    const loader = document.getElementById('initial-loader')
    if (loader) {
      loader.style.opacity = '0'
      loader.style.transition = 'opacity 0.3s'
      setTimeout(() => loader.remove(), 300)
    }

    const handleMessage = (event: MessageEvent) => {
      console.log('[ScriptDebuggerPanel] Message received:', event)
      const message = event.data
      console.log('[ScriptDebuggerPanel] Message data:', message)
      if (message.type === 'script:populate' && message.data?.spendParams) {
        console.log('[ScriptDebuggerPanel] script:populate received!')
        // If the locking script is empty, show the input form with unlocking script pre-filled
        if (!message.data.spendParams.lockingScript) {
          setInitialUnlockingScript(message.data.spendParams.unlockingScript)
        } else {
          setSpendParams(message.data.spendParams)
        }
      }
    }

    console.log('[ScriptDebuggerPanel] Adding message listener')
    window.addEventListener('message', handleMessage)
    console.log('[ScriptDebuggerPanel] Message listener added')

    // Signal to backend that webview is ready
    console.log('[ScriptDebuggerPanel] Sending webview:ready')
    vscode.postMessage({ type: 'webview:ready' })

    return () => {
      console.log('[ScriptDebuggerPanel] Removing message listener')
      window.removeEventListener('message', handleMessage)
    }
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
        <h1 className="text-lg font-semibold">Script Debugger</h1>
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
      <div className="flex-1 overflow-hidden px-4">
        {!spendParams ? (
          <ScriptDebuggerInput onExecute={handleExecute} initialUnlockingScript={initialUnlockingScript} />
        ) : (
          <div className="h-full">
            <ScriptDebugger spendParams={spendParams} />
          </div>
        )}
      </div>
    </div>
  )
}
