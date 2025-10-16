import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupButton, InputGroupText } from '@/components/ui/input-group'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Bug, Trash2 } from 'lucide-react'
import { getVscode } from '../vscode'

interface ScriptDebuggerInputProps {
  onExecute?: (params: any) => void
  initialUnlockingScript?: string
  initialTxid?: string
  initialNetwork?: string
}

export function ScriptDebuggerInput({ initialTxid = '', initialNetwork = 'main' }: ScriptDebuggerInputProps) {
  const vscode = getVscode()
  const [txid, setTxid] = useState(initialTxid)
  const [isLoading, setIsLoading] = useState(false)
  const [transaction, setTransaction] = useState<any>(null)

  // Auto-load transaction if initialTxid is provided
  useEffect(() => {
    if (initialTxid && !transaction && !isLoading) {
      console.log('[ScriptDebuggerInput] Auto-loading transaction:', initialTxid, initialNetwork)
      setIsLoading(true)
      vscode.postMessage({
        type: 'transaction:loadByTxid',
        data: {
          txid: initialTxid,
          network: initialNetwork === 'test' ? 'test' : 'main'
        }
      })
    }
  }, [initialTxid, initialNetwork]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data

      // Only handle messages this component cares about
      if (message.type === 'transaction:decoded' && isLoading) {
        setTransaction(message.data)
        setIsLoading(false)
      } else if (message.type === 'transaction:decode:error' && isLoading) {
        setIsLoading(false)
      }
      // Let other message types (like script:populate) pass through to other listeners
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [isLoading])

  const handleLoadTransaction = () => {
    if (!txid.trim()) return

    console.log('[ScriptDebuggerInput] Loading transaction:', txid.trim())
    setIsLoading(true)

    // Ask backend to fetch and decode transaction
    // WhatOnChain API uses 'main' and 'test' only
    vscode.postMessage({
      type: 'transaction:loadByTxid',
      data: {
        txid: txid.trim(),
        network: 'main'
      }
    })
    console.log('[ScriptDebuggerInput] Sent transaction:loadByTxid message')
  }

  const handleClear = () => {
    setTxid('')
    setTransaction(null)
  }

  const handleSelectInput = (inputIndex: number) => {
    const input = transaction.inputs[inputIndex]

    vscode.postMessage({
      type: 'transaction:executeScript',
      data: {
        inputIndex,
        unlockingScript: input.unlockingScript,
        sourceTXID: input.sourceTXID,
        sourceOutputIndex: input.sourceOutputIndex,
        spendingTxInputs: transaction.inputs,
        spendingTxOutputs: transaction.outputs,
        transactionVersion: transaction.version,
        transactionLockTime: transaction.lockTime
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* TXID Input */}
      <InputGroup>
        <InputGroupInput
          value={txid}
          onChange={(e) => setTxid(e.target.value)}
          placeholder="Enter transaction ID (TXID)..."
          className="font-mono text-xs"
          disabled={isLoading || !!transaction}
        />
        <InputGroupAddon align="block-end" className="border-t">
          <InputGroupButton
            onClick={handleLoadTransaction}
            disabled={isLoading || !txid.trim() || !!transaction}
            className="ml-auto"
            variant="default"
            size="sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                Loading...
              </>
            ) : (
              'Load Transaction'
            )}
          </InputGroupButton>
        </InputGroupAddon>
        <InputGroupAddon align="block-start" className="border-b">
          <InputGroupText className="font-medium text-xs">
            <Bug className="w-3 h-3" />
            Debug Script
          </InputGroupText>
          <InputGroupButton
            onClick={handleClear}
            disabled={!txid.trim() && !transaction}
            variant="ghost"
            size="icon-xs"
            className="ml-auto"
            title="Clear input"
          >
            <Trash2 className="w-3 h-3" />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      {/* Input Selection */}
      {transaction && (
        <Card>
          <CardContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Select Input to Debug</p>
              <div className="space-y-2">
                {transaction.inputs.map((input: any, index: number) => (
                  <button
                    key={index}
                    onClick={() => handleSelectInput(index)}
                    className="w-full text-left p-3 rounded border border-border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono">Input #{index}</span>
                      <span className="text-xs text-muted-foreground">
                        {input.sourceTXID ? `${input.sourceTXID.slice(0, 8)}...` : 'Coinbase'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={() => {
                setTransaction(null)
                setTxid('')
              }}
              variant="outline"
              className="w-full"
            >
              Load Different Transaction
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
