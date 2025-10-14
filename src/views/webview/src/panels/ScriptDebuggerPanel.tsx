import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { ScriptDebugger } from '../components/ScriptDebugger'
import { ScriptDebuggerInput } from '../components/ScriptDebuggerInput'
import type { SpendParams } from '../types/scriptExecution'
import '../App.css'

export function ScriptDebuggerPanel() {
  console.log('[ScriptDebuggerPanel] Component rendering')
  const { txid: txidParam, network: networkParam } = useParams<{ txid?: string; network?: string; inputIndex?: string }>()
  const [spendParams, setSpendParams] = useState<SpendParams | null>(null)
  const [initialTxid, setInitialTxid] = useState<string>('')
  const [initialNetwork, setInitialNetwork] = useState<string>('main')

  useEffect(() => {
    console.log('[ScriptDebuggerPanel] useEffect running')
    document.documentElement.classList.add('dark')

    // Remove initial loading spinner
    const loader = document.getElementById('initial-loader')
    if (loader) {
      loader.style.opacity = '0'
      loader.style.transition = 'opacity 0.3s'
      setTimeout(() => loader.remove(), 300)
    }

    // Load spendParams from INITIAL_DATA if available
    const initialData = window.INITIAL_DATA as any
    if (initialData?.spendParams) {
      console.log('[ScriptDebuggerPanel] Loading spendParams from INITIAL_DATA')
      setSpendParams(initialData.spendParams)
    } else if (txidParam && networkParam) {
      console.log('[ScriptDebuggerPanel] Loading from route params:', txidParam, networkParam)
      setInitialTxid(txidParam)
      setInitialNetwork(networkParam)
    } else if (initialData?.txid) {
      console.log('[ScriptDebuggerPanel] Loading txid from INITIAL_DATA:', initialData.txid)
      setInitialTxid(initialData.txid)
      setInitialNetwork(initialData.network || 'main')
    } else {
      console.log('[ScriptDebuggerPanel] No INITIAL_DATA, showing input form')
    }
  }, [txidParam, networkParam])

  const handleExecute = (params: SpendParams) => {
    console.log('[ScriptDebuggerPanel] Manual execution with params')
    setSpendParams(params)
  }

  const handleReset = () => {
    console.log('[ScriptDebuggerPanel] Resetting to input form')
    setSpendParams(null)
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border p-4">
        <div className="flex items-center justify-between">
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
        {spendParams?.sourceTXID && (
          <div className="mt-2 text-xs text-muted-foreground font-mono">
            <span className="opacity-60">TX:</span> {spendParams.sourceTXID.slice(0, 16)}...{spendParams.sourceTXID.slice(-8)}
            {spendParams.inputIndex !== undefined && (
              <span className="ml-3">
                <span className="opacity-60">Input:</span> {spendParams.inputIndex}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden px-4">
        {!spendParams ? (
          <ScriptDebuggerInput onExecute={handleExecute} initialUnlockingScript="" initialTxid={initialTxid} initialNetwork={initialNetwork} />
        ) : (
          <div className="h-full">
            <ScriptDebugger spendParams={spendParams} />
          </div>
        )}
      </div>
    </div>
  )
}
