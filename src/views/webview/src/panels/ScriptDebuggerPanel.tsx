import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { ScriptDebugger } from '../components/ScriptDebugger'
import { ScriptDebuggerInput } from '../components/ScriptDebuggerInput'
import { PanelHeader } from '../components/PanelHeader'
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

  const formatSubtitle = (): string | undefined => {
    if (!spendParams?.sourceTXID) return undefined
    const txidPart = `${spendParams.sourceTXID.slice(0, 16)}...${spendParams.sourceTXID.slice(-8)}`
    const inputPart = spendParams.inputIndex !== undefined ? ` Input: ${spendParams.inputIndex}` : ''
    return txidPart + inputPart
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <PanelHeader
        title="Script Debugger"
        subtitle={formatSubtitle()}
        action={spendParams ? {
          label: 'New Script',
          onClick: handleReset
        } : undefined}
      />

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
