import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { DecodeTransaction } from '../components/DecodeTransaction'
import { PanelHeader } from '../components/PanelHeader'
import { getVscode } from '../vscode'
import '../App.css'

export function TransactionDecoderPanel() {
  const vscode = getVscode()
  const { txid: txidParam } = useParams<{ txid?: string }>()
  const [rawTxHex, setRawTxHex] = useState('')
  const [decodedTxid, setDecodedTxid] = useState<string | null>(null)
  const shouldAutoDecode = useRef(false)

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
  }, [])

  // Load transaction from INITIAL_DATA or route params
  useEffect(() => {
    const initialData = window.INITIAL_DATA as any

    // Check if we have INITIAL_DATA with rawTxHex (immediate display)
    if (initialData?.rawTxHex) {
      console.log('[TransactionDecoderPanel] Loading rawTx from INITIAL_DATA:', initialData.txid)
      setRawTxHex(initialData.rawTxHex)
      shouldAutoDecode.current = true
    }
    // Check if we have INITIAL_DATA with just txid (need to fetch)
    else if (initialData?.txid) {
      console.log('[TransactionDecoderPanel] Loading txid from INITIAL_DATA:', initialData.txid)
      const network = initialData.network === 'test' ? 'testnet' : 'mainnet'
      vscode.postMessage({
        type: 'transaction:loadByTxid',
        data: { txid: initialData.txid, network }
      })
    }
    // Fallback: route param with no INITIAL_DATA
    else if (txidParam) {
      console.log('[TransactionDecoderPanel] Route has txid but no INITIAL_DATA, requesting load:', txidParam)
      vscode.postMessage({
        type: 'transaction:loadByTxid',
        data: { txid: txidParam, network: 'mainnet' }
      })
    }
  }, [txidParam, vscode])

  // Auto-decode when hex is populated
  useEffect(() => {
    if (shouldAutoDecode.current && rawTxHex) {
      shouldAutoDecode.current = false
      console.log('[TransactionDecoderPanel] Auto-decoding transaction')
      vscode.postMessage({
        type: 'transaction:decode',
        data: { rawTx: rawTxHex }
      })
    }
  }, [rawTxHex, vscode])

  // Handle messages from backend (decode results, etc)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data

      // Handle transaction loaded by txid (from backend fetch)
      if (message.type === 'transaction:populate' && message.data?.rawTxHex) {
        console.log('[TransactionDecoderPanel] Received transaction from backend')
        setRawTxHex(message.data.rawTxHex)
        shouldAutoDecode.current = true
      }
      // Handle transaction decoded (legacy)
      else if (message.type === 'transaction:decoded' && message.data?.rawTx) {
        console.log('[TransactionDecoderPanel] Received decoded transaction')
        setRawTxHex(message.data.rawTx)
        shouldAutoDecode.current = true
      }
      // Extract txid from decoded transaction
      else if (message.type === 'transaction:decoded' && message.data?.txid) {
        setDecodedTxid(message.data.txid)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const handleRawTxHexChange = (value: string) => {
    setRawTxHex(value)
  }

  const handleExplore = () => {
    if (decodedTxid) {
      vscode.postMessage({
        type: 'openExternal',
        url: `https://whatsonchain.com/tx/${decodedTxid}`
      })
    }
  }

  const formatTxidDisplay = (txid: string): string => {
    return `${txid.slice(0, 16)}...${txid.slice(-8)}`
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <PanelHeader
        title="Transaction Decoder"
        subtitle={decodedTxid ? formatTxidDisplay(decodedTxid) : undefined}
        action={decodedTxid ? {
          label: 'Explore',
          onClick: handleExplore
        } : undefined}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <DecodeTransaction
          rawTxHex={rawTxHex}
          onRawTxHexChange={handleRawTxHexChange}
        />
      </div>
    </div>
  )
}
