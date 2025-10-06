import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Play, Loader2 } from 'lucide-react'
import { ScriptExecutor } from '../ScriptExecutor'
import type { SpendParams } from '../../types/scriptExecution'
import { getVscode } from '../../vscode'

export function ExecuteScript() {
  const vscode = getVscode()
  const [scriptInput, setScriptInput] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showExecutor, setShowExecutor] = useState(false)
  const [spendParams, setSpendParams] = useState<SpendParams | null>(null)

  const handleExecute = () => {
    if (!scriptInput.trim()) {
      setError('Please enter a script')
      return
    }

    setIsExecuting(true)
    setError(null)

    vscode.postMessage({
      type: 'script:execute',
      data: { script: scriptInput.trim() }
    })
  }

  // Listen for messages from extension
  useState(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data

      if (message.type === 'script:ready') {
        setSpendParams(message.data.spendParams)
        setIsExecuting(false)
        setShowExecutor(true)
        setError(null)
      } else if (message.type === 'script:error') {
        setError(message.data.error)
        setIsExecuting(false)
        setSpendParams(null)
        setShowExecutor(false)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  })

  return (
    <div className="space-y-4">
      {/* Script Executor */}
      {showExecutor && spendParams && (
        <ScriptExecutor
          spendParams={spendParams}
          onClose={() => {
            setShowExecutor(false)
            setSpendParams(null)
          }}
        />
      )}

      {/* Input Area */}
      {!showExecutor && (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground mb-2">
            Enter a Bitcoin script in any format (hex, ASM, or mixed). The script will be parsed and executed step-by-step.
          </div>
          <Textarea
            placeholder="Enter script... (e.g. OP_DUP OP_HASH160 <pubkeyhash> OP_EQUALVERIFY OP_CHECKSIG)"
            value={scriptInput}
            onChange={(e) => setScriptInput(e.target.value)}
            className="font-mono text-xs min-h-[150px] max-h-[400px]"
          />
          <Button
            onClick={handleExecute}
            disabled={isExecuting || !scriptInput.trim()}
            className="w-full"
          >
            {isExecuting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Parsing Script...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Execute Script
              </>
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
    </div>
  )
}
