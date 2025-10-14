import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { Copy, Loader2, Edit, Radio, ExternalLink } from 'lucide-react'
import type { DecodedTransaction } from '../../types/decodedTransaction'
import { TransactionInputs } from './TransactionInputs'
import { TransactionOutputs } from './TransactionOutputs'
import { ScriptDebugger } from '../ScriptDebugger'
import type { SpendParams } from '../../types/scriptExecution'
import { formatBytes, truncateTxid } from '../../utils/scriptParser'
import { getVscode } from '../../vscode'

interface DecodeTransactionProps {
  rawTxHex: string
  onRawTxHexChange: (value: string) => void
  openInWindow?: boolean
}

export function DecodeTransaction({ rawTxHex, onRawTxHexChange, openInWindow = false }: DecodeTransactionProps) {
  const vscode = getVscode()
  const [decodedTx, setDecodedTx] = useState<DecodedTransaction | null>(null)
  const [isDecoding, setIsDecoding] = useState(false)
  const [isBroadcasting, setIsBroadcasting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showScriptDebugger, setShowScriptDebugger] = useState(false)
  const [scriptDebuggerData, setScriptDebuggerData] = useState<any>(null)
  const [showInput, setShowInput] = useState(true)
  const [onChain, setOnChain] = useState<boolean | null>(null)
  const [network, setNetwork] = useState<string>('mainnet')

  const handleDecode = () => {
    if (!rawTxHex || !rawTxHex.trim()) {
      setError('Please enter a transaction hex')
      return
    }

    if (openInWindow) {
      // Open in dedicated window instead of decoding inline
      vscode.postMessage({
        type: 'transaction:openInWindow',
        data: { rawTxHex: rawTxHex.trim() }
      })
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
    if (!rawTxHex || !rawTxHex.trim()) {
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
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data

      if (message.type === 'transaction:decoded') {
        setDecodedTx(message.data)
        setNetwork(message.data.network || 'mainnet')
        setIsDecoding(false)
        setError(null)
        setShowInput(false)
        setOnChain(null) // Reset status, will be updated by onChainStatus message
      } else if (message.type === 'transaction:spendingInfo') {
        // Update outputs with spending information
        if (decodedTx && message.data.txid === decodedTx.txid) {
          const updatedOutputs = decodedTx.outputs.map(output => {
            const spendingInfo = message.data.spending[output.index]
            if (spendingInfo) {
              return {
                ...output,
                spendingTxid: spendingInfo.txid,
                spendingVout: spendingInfo.vout
              }
            }
            return output
          })
          setDecodedTx({
            ...decodedTx,
            outputs: updatedOutputs
          })
        }
      } else if (message.type === 'transaction:inputsResolved') {
        // Update inputs with resolved information
        console.log('Received inputsResolved:', message.data)
        try {
          if (decodedTx && message.data.txid === decodedTx.txid && message.data.inputs) {
            console.log('Updating inputs, count:', message.data.inputs.length)
            setDecodedTx({
              ...decodedTx,
              inputs: message.data.inputs
            })
            console.log('Inputs updated successfully')
          } else {
            console.warn('Cannot update inputs:', {
              hasDecodedTx: !!decodedTx,
              txidMatch: decodedTx?.txid === message.data.txid,
              hasInputs: !!message.data.inputs
            })
          }
        } catch (error) {
          console.error('Error updating inputs:', error)
        }
      } else if (message.type === 'transaction:decode:error') {
        setError(message.data.error)
        setIsDecoding(false)
        setDecodedTx(null)
      } else if (message.type === 'transaction:onChainStatus') {
        setOnChain(message.data.onChain)
        setNetwork(message.data.network || 'mainnet')
      } else if (message.type === 'scriptDebugger:show') {
        setScriptDebuggerData(message.data)
        setShowScriptDebugger(true)
      } else if (message.type === 'scriptDebugger:error') {
        setError(`Script execution failed: ${message.data.error}`)
      } else if (message.type === 'transaction:broadcast:result') {
        setIsBroadcasting(false)
        if (message.data.success) {
          vscode.postMessage({
            type: 'showInfo',
            data: { message: `Transaction broadcast successfully! ${message.data.txid?.slice(0, 8)}...` }
          })
          setOnChain(true)
        } else {
          setError(`Broadcast failed: ${message.data.error}`)
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [decodedTx, vscode])

  // Create SpendParams from scriptDebuggerData
  const spendParams: SpendParams | null = scriptDebuggerData ? {
    sourceTXID: scriptDebuggerData.sourceTXID,
    sourceOutputIndex: scriptDebuggerData.sourceOutputIndex,
    sourceSatoshis: scriptDebuggerData.satoshis,
    lockingScript: scriptDebuggerData.lockingScript,
    transactionVersion: 1,
    otherInputs: [],
    outputs: [],
    unlockingScript: scriptDebuggerData.unlockingScript,
    inputSequence: 0xffffffff,
    inputIndex: scriptDebuggerData.inputIndex,
    lockTime: 0,
    memoryLimit: 10000000
  } : null

  return (
    <div className="space-y-4">
      {/* Script Debugger */}
      {showScriptDebugger && spendParams && (
        <ScriptDebugger
          spendParams={spendParams}
        />
      )}

      {/* Input Area */}
      {showInput && (
        <div className="space-y-2">
          <Textarea
            placeholder="Paste raw transaction hex..."
            value={rawTxHex}
            onChange={(e) => onRawTxHexChange(e.target.value)}
            className="font-mono text-xs min-h-[100px] max-h-[160px]"
          />
          <Button
            onClick={handleDecode}
            disabled={isDecoding || !rawTxHex || !rawTxHex.trim()}
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
        <ResizablePanelGroup direction="vertical" className="h-[calc(100vh-200px)] min-h-[600px]">
          {/* Transaction Summary Panel */}
          <ResizablePanel defaultSize={25} minSize={15}>
            <div className="p-4 space-y-2 h-full overflow-auto">
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

              <div className="pt-2 border-t border-border space-y-2">
                {onChain === true && (
                  <div className="text-xs text-green-500 flex items-center gap-2">
                    <span>✓</span>
                    <span>Transaction found on chain</span>
                  </div>
                )}
                <ButtonGroup className="w-full">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => handleCopy(rawTxHex, 'Raw Transaction')}
                  >
                    <Copy className="mr-2 h-3 w-3" />
                    Copy Raw
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={handleEdit}
                  >
                    <Edit className="mr-2 h-3 w-3" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      const baseUrl = network === 'testnet'
                        ? 'https://test.whatsonchain.com'
                        : 'https://whatsonchain.com'
                      vscode.postMessage({
                        type: 'openExternal',
                        url: `${baseUrl}/tx/${decodedTx.txid}`
                      })
                    }}
                  >
                    <ExternalLink className="mr-2 h-3 w-3" />
                    View
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="text-xs"
                    onClick={handleBroadcast}
                    disabled={isBroadcasting || onChain === true}
                    title={onChain === true ? 'Transaction already on chain' : 'Broadcast to network'}
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
                </ButtonGroup>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Inputs and Outputs Panel */}
          <ResizablePanel defaultSize={75} minSize={40}>
            <ResizablePanelGroup direction="horizontal">
              {/* Inputs Panel */}
              <ResizablePanel defaultSize={50} minSize={30}>
                <div className="h-full flex flex-col">
                  <h3 className="font-mono font-semibold text-sm p-2 bg-background border-b">
                    Inputs ({decodedTx.inputs.length})
                  </h3>
                  <div className="flex-1 overflow-auto p-2">
                    <TransactionInputs
                      inputs={decodedTx.inputs}
                      outputs={decodedTx.outputs}
                      transactionVersion={decodedTx.version}
                      transactionLockTime={decodedTx.lockTime}
                      network={network}
                    />
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* Outputs Panel */}
              <ResizablePanel defaultSize={50} minSize={30}>
                <div className="h-full flex flex-col">
                  <h3 className="font-mono font-semibold text-sm p-2 bg-background border-b">
                    Outputs ({decodedTx.outputs.length})
                  </h3>
                  <div className="flex-1 overflow-auto p-2">
                    <TransactionOutputs
                      outputs={decodedTx.outputs}
                      network={network}
                    />
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </div>
  )
}
