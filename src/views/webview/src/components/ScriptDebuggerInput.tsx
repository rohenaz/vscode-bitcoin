import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Load Transaction by TXID</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Enter a transaction ID to load and debug its inputs
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!transaction ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="txid">Transaction ID</Label>
              <Input
                id="txid"
                placeholder="Enter TXID..."
                value={txid}
                onChange={(e) => setTxid(e.target.value)}
                className="font-mono text-xs"
                disabled={isLoading}
              />
            </div>

            <Button
              onClick={handleLoadTransaction}
              disabled={!txid.trim() || isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading Transaction...
                </>
              ) : (
                'Load Transaction'
              )}
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Select Input to Debug</Label>
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
          </>
        )}
      </CardContent>
    </Card>
  )
}
