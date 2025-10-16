import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { InputGroup, InputGroupAddon, InputGroupTextarea, InputGroupButton, InputGroupText } from '@/components/ui/input-group'
import { Card } from '@/components/ui/card'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { Copy, Loader2, Radio, ExternalLink, ScanQrCode, Trash2, ScanBarcode } from 'lucide-react'
import type { DecodedTransaction } from '../../types/decodedTransaction'
import { TransactionInputs } from './TransactionInputs'
import { TransactionOutputs } from './TransactionOutputs'
import { ScriptDebugger } from '../ScriptDebugger'
import type { SpendParams } from '../../types/scriptExecution'
import { formatBytes } from '../../utils/scriptParser'
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

  const handleClear = () => {
    onRawTxHexChange('')
    setDecodedTx(null)
    setError(null)
    setOnChain(null)
  }

  const handleOpenParser = () => {
    if (!rawTxHex || !rawTxHex.trim()) return
    vscode.postMessage({
      type: 'transaction:openParser',
      data: { rawTxHex: rawTxHex.trim() }
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
        setOnChain(null) // Reset status, will be updated by onChainStatus message
      } else if (message.type === 'transaction:spendingInfo') {
        // Update outputs with spending information - use functional update
        setDecodedTx(prevTx => {
          if (prevTx && message.data.txid === prevTx.txid) {
            const updatedOutputs = prevTx.outputs.map(output => {
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
            return {
              ...prevTx,
              outputs: updatedOutputs
            }
          }
          return prevTx
        })
      } else if (message.type === 'transaction:inputsResolved') {
        // Update inputs with resolved information - use functional update
        console.log('Received inputsResolved:', message.data)
        console.log('First resolved input:', message.data.inputs?.[0])
        setDecodedTx(prevTx => {
          console.log('Functional update - prevTx:', prevTx)
          if (prevTx && message.data.txid === prevTx.txid && message.data.inputs) {
            console.log('Updating inputs, count:', message.data.inputs.length)
            console.log('Current prevTx.inputs:', prevTx.inputs)
            const updated = {
              ...prevTx,
              inputs: message.data.inputs
            }
            console.log('Updated tx with new inputs:', updated)
            return updated
          }
          console.warn('Cannot update inputs:', {
            hasPrevTx: !!prevTx,
            txidMatch: prevTx?.txid === message.data.txid,
            hasInputs: !!message.data.inputs
          })
          return prevTx
        })
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
  }, [vscode])

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
    <div className="h-full flex flex-col">
      {/* Script Debugger */}
      {showScriptDebugger && spendParams && (
        <div className="p-4">
          <ScriptDebugger
            spendParams={spendParams}
          />
        </div>
      )}

      {/* Input Area - Only shown when no decoded transaction */}
      {!decodedTx && (
        <div className="p-4">
          <InputGroup>
            <InputGroupTextarea
              value={rawTxHex}
              onChange={(e) => onRawTxHexChange(e.target.value)}
              placeholder="Paste raw transaction hex..."
              className="min-h-[160px] font-mono text-xs"
            />
            <InputGroupAddon align="block-end" className="border-t">
              <InputGroupText className="text-xs">
                {rawTxHex.trim() ? `${rawTxHex.replace(/\s/g, '').length / 2} bytes` : 'No data'}
              </InputGroupText>
              <InputGroupButton
                onClick={handleDecode}
                disabled={isDecoding || !rawTxHex.trim()}
                className="ml-auto"
                variant="default"
                size="sm"
              >
                {isDecoding ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Decoding...
                  </>
                ) : (
                  'Decode Transaction'
                )}
              </InputGroupButton>
            </InputGroupAddon>
            <InputGroupAddon align="block-start" className="border-b">
              <InputGroupText className="font-medium text-xs">
                <ScanQrCode className="w-3 h-3" />
                Decode Raw Transaction
              </InputGroupText>
              <InputGroupButton
                onClick={handleClear}
                disabled={!rawTxHex.trim()}
                variant="ghost"
                size="icon-xs"
                className="ml-auto"
                title="Clear input"
              >
                <Trash2 className="w-3 h-3" />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-4">
          <Card className="p-4 border-destructive">
            <p className="text-sm text-destructive">{error}</p>
          </Card>
        </div>
      )}

      {/* Decoded Transaction Display */}
      {decodedTx && (
        <div className="flex-1 flex flex-col">
          {/* Transaction Metadata */}
          <div className="p-4 border-b">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs">
              {/* Left Column */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Size</span>
                  <span className="font-mono">{formatBytes(decodedTx.size)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version</span>
                  <span className="font-mono">{decodedTx.version}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lock Time</span>
                  <span className="font-mono">{decodedTx.lockTime}</span>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Inputs</span>
                  <span className="font-mono">{decodedTx.inputs.length}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Outputs</span>
                  <span className="font-mono">{decodedTx.outputs.length}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Network</span>
                  <span className="font-mono">{network}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Inputs and Outputs - Resizable */}
          <div className="flex-1 overflow-hidden p-4">
            <ResizablePanelGroup direction="horizontal" className="h-full">
              {/* Inputs Panel */}
              <ResizablePanel defaultSize={50} minSize={30}>
                <div className="h-full flex flex-col">
                  <h3 className="font-mono font-semibold text-sm p-2 border-b">
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
                  <h3 className="font-mono font-semibold text-sm p-2 border-b">
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
          </div>

          {/* Status and Actions - Bottom */}
          <div className="border-t p-4">
            <div className="flex items-center justify-between">
              {onChain === true && (
                <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-2">
                  <span>✓</span>
                  <span>Transaction found on chain</span>
                </div>
              )}
              {onChain === false && (
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <span>⊘</span>
                  <span>Not found on chain</span>
                </div>
              )}
              {onChain === null && <div />}

              <ButtonGroup>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={handleOpenParser}
                >
                  <ScanBarcode className="mr-2 h-3 w-3" />
                  Parse
                </Button>
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
        </div>
      )}
    </div>
  )
}
