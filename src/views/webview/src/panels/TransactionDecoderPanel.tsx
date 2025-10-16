import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { DecodeTransaction } from '../components/DecodeTransaction'
import { PanelHeader } from '../components/PanelHeader'
import { TransactionParser, type ParseResult, type ParsedField } from '../utils/transactionParser'
import { getVscode } from '../vscode'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'
import { AlertTriangle } from 'lucide-react'
import '../App.css'

export function TransactionDecoderPanel() {
  const vscode = getVscode()
  const { txid: txidParam } = useParams<{ txid?: string }>()
  const [rawTxHex, setRawTxHex] = useState('')
  const [decodedTxid, setDecodedTxid] = useState<string | null>(null)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [showInvalidDialog, setShowInvalidDialog] = useState(false)
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

  // Parse transaction when rawTxHex changes
  useEffect(() => {
    if (rawTxHex.trim()) {
      const parser = new TransactionParser(rawTxHex.trim())
      const result = parser.parse()
      setParseResult(result)

      // Show alert dialog if transaction is invalid
      const hasIssues = result.errors.length > 0 ||
        result.warnings.length > 0 ||
        result.fields.some(field => field.error)

      if (hasIssues) {
        setShowInvalidDialog(true)
      }
    } else {
      setParseResult(null)
    }
  }, [rawTxHex])

  const handleRawTxHexChange = (value: string) => {
    setRawTxHex(value)
  }

  const handleOpenInParser = () => {
    if (!rawTxHex.trim()) return
    vscode.postMessage({
      type: 'transaction:openParser',
      data: { rawTxHex: rawTxHex.trim() }
    })
  }

  const isValid = parseResult &&
    parseResult.errors.length === 0 &&
    parseResult.warnings.length === 0 &&
    !parseResult.fields.some((field: ParsedField) => field.error)

  const hasIssues = parseResult && (
    parseResult.errors.length > 0 ||
    parseResult.warnings.length > 0 ||
    parseResult.fields.some((field: ParsedField) => field.error)
  )

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <PanelHeader
        title="Transaction Decoder"
        subtitle={decodedTxid || undefined}
        subtitleCopyable={!!decodedTxid}
        validationStatus={
          isValid ? 'valid' : hasIssues ? 'invalid' : null
        }
      />

      {/* Invalid Transaction Alert Dialog */}
      <AlertDialog open={showInvalidDialog} onOpenChange={setShowInvalidDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Invalid Transaction Detected
            </AlertDialogTitle>
            <AlertDialogDescription>
              This transaction has parsing errors and may not be valid.
              {parseResult && (
                <div className="mt-3 space-y-2 text-xs">
                  {parseResult.errors.length > 0 && (
                    <div>
                      <span className="font-semibold text-destructive">Errors:</span>
                      <ul className="list-disc list-inside mt-1">
                        {parseResult.errors.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {parseResult.warnings.length > 0 && (
                    <div>
                      <span className="font-semibold text-muted-foreground">Warnings:</span>
                      <ul className="list-disc list-inside mt-1">
                        {parseResult.warnings.map((warning, idx) => (
                          <li key={idx}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Dismiss</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowInvalidDialog(false)
              handleOpenInParser()
            }}>
              Inspect in Parser
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
