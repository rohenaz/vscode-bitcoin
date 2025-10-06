import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Copy, Loader2, Edit, Radio } from 'lucide-react'
import type { DecodedTransaction } from '../../types/decodedTransaction'
import { TransactionInputs } from './TransactionInputs'
import { TransactionOutputs } from './TransactionOutputs'
import { ScriptExecutor } from '../ScriptExecutor'
import type { SpendParams } from '../../types/scriptExecution'
import { formatBytes, truncateTxid } from '../../utils/scriptParser'
import { getVscode } from '../../vscode'

interface DecodeTransactionProps {
  rawTxHex: string
  onRawTxHexChange: (value: string) => void
}

export function DecodeTransaction({ rawTxHex, onRawTxHexChange }: DecodeTransactionProps) {
  const vscode = getVscode()
  const [decodedTx, setDecodedTx] = useState<DecodedTransaction | null>(null)
  const [isDecoding, setIsDecoding] = useState(false)
  const [isBroadcasting, setIsBroadcasting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showScriptExecutor, setShowScriptExecutor] = useState(false)
  const [scriptExecutorData, setScriptExecutorData] = useState<any>(null)
  const [showInput, setShowInput] = useState(true)

  const handleDecode = () => {
    if (!rawTxHex.trim()) {
      setError('Please enter a transaction hex')
      return
    }

    setIsDecoding(true)
    setError(null)

    vscode.postMessage({
      type: 'transaction:decode',
      data: { rawTx: rawTxHex.trim() }
    })
  }

  const handleEdit = () => {
    setShowInput(true)
    setDecodedTx(null)
    setError(null)
  }

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    vscode.postMessage({
      type: 'showInfo',
      data: { message: `${label} copied to clipboard` }
    })
  }

  const handleBroadcast = () => {
    if (!rawTxHex.trim()) {
      setError('No transaction to broadcast')
      return
    }

    setIsBroadcasting(true)
    setError(null)

    vscode.postMessage({
      type: 'transaction:broadcast',
      data: { rawTx: rawTxHex.trim() }
    })
  }

  // Listen for messages from extension
  useState(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data

      if (message.type === 'transaction:decoded') {
        setDecodedTx(message.data)
        setIsDecoding(false)
        setError(null)
        setShowInput(false)
      } else if (message.type === 'transaction:decode:error') {
        setError(message.data.error)
        setIsDecoding(false)
        setDecodedTx(null)
      } else if (message.type === 'scriptExecutor:show') {
        setScriptExecutorData(message.data)
        setShowScriptExecutor(true)
      } else if (message.type === 'scriptExecutor:error') {
        setError(`Script execution failed: ${message.data.error}`)
      } else if (message.type === 'transaction:broadcast:result') {
        setIsBroadcasting(false)
        if (message.data.success) {
          vscode.postMessage({
            type: 'showInfo',
            data: { message: `Transaction broadcast successfully! ${message.data.txid?.slice(0, 8)}...` }
          })
        } else {
          setError(`Broadcast failed: ${message.data.error}`)
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  })

  // Create SpendParams from scriptExecutorData
  const spendParams: SpendParams | null = scriptExecutorData ? {
    sourceTXID: scriptExecutorData.sourceTXID,
    sourceOutputIndex: scriptExecutorData.sourceOutputIndex,
    sourceSatoshis: scriptExecutorData.satoshis,
    lockingScript: scriptExecutorData.lockingScript,
    transactionVersion: 1,
    otherInputs: [],
    outputs: [],
    unlockingScript: scriptExecutorData.unlockingScript,
    inputSequence: 0xffffffff,
    inputIndex: scriptExecutorData.inputIndex,
    lockTime: 0,
    memoryLimit: 10000000
  } : null

  return (
    <div className="space-y-4">
      {/* Script Executor */}
      {showScriptExecutor && spendParams && (
        <ScriptExecutor
          spendParams={spendParams}
          onClose={() => setShowScriptExecutor(false)}
        />
      )}

      {/* Input Area */}
      {showInput && (
        <div className="space-y-2">
          <Textarea
            placeholder="Paste raw transaction hex..."
            value={rawTxHex}
            onChange={(e) => onRawTxHexChange(e.target.value)}
            className="font-mono text-xs min-h-[100px] max-h-[400px]"
          />
          <Button
            onClick={handleDecode}
            disabled={isDecoding || !rawTxHex.trim()}
            className="w-full"
          >
            {isDecoding ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Decoding...
              </>
            ) : (
              'Decode Transaction'
            )}
          </Button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <Card className="p-4 border-destructive">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      )}

      {/* Decoded Transaction Display */}
      {decodedTx && !showInput && (
        <div className="space-y-4">
          {/* Transaction Summary */}
          <Card className="p-4 space-y-2 bg-[#1a1a1a]">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Transaction ID</span>
              <div className="flex items-center gap-2">
                <code className="font-mono text-[10px]">{truncateTxid(decodedTx.txid)}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => handleCopy(decodedTx.txid, 'Transaction ID')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Size</span>
              <span className="font-mono">{formatBytes(decodedTx.size)}</span>
            </div>

            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Version</span>
              <span className="font-mono">{decodedTx.version}</span>
            </div>

            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Lock Time</span>
              <span className="font-mono">{decodedTx.lockTime}</span>
            </div>

            <div className="pt-2 border-t border-border flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => handleCopy(rawTxHex, 'Raw Transaction')}
              >
                <Copy className="mr-2 h-3 w-3" />
                Copy Raw
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={handleEdit}
              >
                <Edit className="mr-2 h-3 w-3" />
                Edit
              </Button>
              <Button
                variant="default"
                size="sm"
                className="flex-1 text-xs"
                onClick={handleBroadcast}
                disabled={isBroadcasting}
              >
                {isBroadcasting ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Broadcasting...
                  </>
                ) : (
                  <>
                    <Radio className="mr-2 h-3 w-3" />
                    Broadcast
                  </>
                )}
              </Button>
            </div>
          </Card>

          {/* Inputs and Outputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Inputs */}
            <div className="space-y-2">
              <h3 className="font-mono font-semibold text-sm">
                Inputs ({decodedTx.inputs.length})
              </h3>
              <TransactionInputs inputs={decodedTx.inputs} />
            </div>

            {/* Outputs */}
            <div className="space-y-2">
              <h3 className="font-mono font-semibold text-sm">
                Outputs ({decodedTx.outputs.length})
              </h3>
              <TransactionOutputs outputs={decodedTx.outputs} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
