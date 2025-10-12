import { useState, useEffect, useRef } from 'react'
import { DecodeTransaction } from '../components/DecodeTransaction'
import { getVscode } from '../vscode'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import '../App.css'

export function TransactionDecoderPanel() {
  const vscode = getVscode()
  const [currentTxid, setCurrentTxid] = useState<string | null>(null)
  const [rawTxHex, setRawTxHex] = useState('')
  const shouldAutoDecode = useRef(false)
  const initialLoad = useRef(true)

  // Initial setup - run once on mount
  useEffect(() => {
    document.documentElement.classList.add('dark')

    // Remove initial loading spinner
    const loader = document.getElementById('initial-loader')
    if (loader) {
      loader.style.opacity = '0'
      loader.style.transition = 'opacity 0.3s'
      setTimeout(() => loader.remove(), 300)
    }

    // Check if there's a txid in the hash on initial load
    const hash = window.location.hash
    if (hash.startsWith('#/tx/')) {
      const txidFromHash = hash.substring(5)
      if (txidFromHash) {
        // Load transaction from chain by txid
        vscode.postMessage({
          type: 'transaction:loadByTxid',
          data: { txid: txidFromHash, network: 'mainnet' }
        })
      }
    }

    // Signal that webview is ready
    vscode.postMessage({ type: 'webview:ready' })
  }, [vscode])

  // Message and navigation handlers
  useEffect(() => {
    // Listen for messages from extension
    const handleMessage = (event: MessageEvent) => {
      const message = event.data
      if (message.type === 'transaction:populate' && message.data?.rawTxHex) {
        const newTxHex = message.data.rawTxHex
        setRawTxHex(newTxHex)
        shouldAutoDecode.current = true
      } else if (message.type === 'transaction:decoded' && message.data?.txid) {
        const txid = message.data.txid

        // Only push state if it's not the initial load and txid changed
        if (!initialLoad.current && txid !== currentTxid) {
          window.history.pushState({ txid, rawTxHex }, '', `#/tx/${txid}`)
          setCurrentTxid(txid)
        } else if (initialLoad.current) {
          // On initial load, replace state instead of push
          window.history.replaceState({ txid, rawTxHex }, '', `#/tx/${txid}`)
          setCurrentTxid(txid)
          initialLoad.current = false
        }
      }
    }

    // Handle browser back/forward buttons
    const handlePopState = (event: PopStateEvent) => {
      if (event.state?.txid && event.state?.rawTxHex) {
        setCurrentTxid(event.state.txid)
        setRawTxHex(event.state.rawTxHex)
        shouldAutoDecode.current = true
      }
    }

    window.addEventListener('message', handleMessage)
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('message', handleMessage)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [currentTxid, rawTxHex])

  // Auto-decode when hex is populated from extension
  useEffect(() => {
    if (shouldAutoDecode.current && rawTxHex) {
      shouldAutoDecode.current = false
      // Trigger decode
      vscode.postMessage({
        type: 'transaction:decode',
        data: { rawTx: rawTxHex }
      })
    }
  }, [rawTxHex, vscode])

  const handleOpenSidePanel = () => {
    // Request to open the side panel's decode section
    vscode.postMessage({
      type: 'openSidePanel',
      data: { section: 'tools', accordion: 'decode' }
    })
  }

  const handleBack = () => {
    window.history.back()
  }

  const canGoBack = window.history.length > 1

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            disabled={!canGoBack}
            title="Go back"
            className="h-7 w-7 p-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold ml-2">Transaction Decoder</h1>
        </div>
        <button
          onClick={handleOpenSidePanel}
          className="text-xs text-muted-foreground hover:text-foreground px-3 py-1 rounded hover:bg-accent"
        >
          Edit in Side Panel →
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4">
        <DecodeTransaction rawTxHex={rawTxHex} onRawTxHexChange={setRawTxHex} />
      </div>
    </div>
  )
}
