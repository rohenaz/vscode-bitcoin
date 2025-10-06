import { useState } from 'react'
import { Hash, ChevronDown, ChevronUp, Play } from 'lucide-react'
import type { DecodedTransactionInput } from '../../types/decodedTransaction'
import { Identicon } from '../Identicon'
import { ScriptViewer } from '../ScriptViewer'
import { Button } from '@/components/ui/button'
import { formatSatoshis, truncateTxid, extractAddressFromUnlockingScript } from '../../utils/scriptParser'
import { getVscode } from '../../vscode'

interface TransactionInputsProps {
  inputs: DecodedTransactionInput[]
  inputAmounts?: Map<string, number>
}

export function TransactionInputs({ inputs, inputAmounts }: TransactionInputsProps) {
  const vscode = getVscode()
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index)
  }

  const handleExecuteScript = (input: DecodedTransactionInput, e: React.MouseEvent) => {
    e.stopPropagation() // Don't trigger expand/collapse

    // Request to execute this input's scripts
    vscode.postMessage({
      type: 'transaction:executeScript',
      data: {
        inputIndex: input.index,
        unlockingScript: input.unlockingScript,
        sourceTXID: input.sourceTXID,
        sourceOutputIndex: input.sourceOutputIndex
      }
    })
  }

  return (
    <ul className="rounded bg-gradient-to-b from-[#1a1a1a] to-black space-y-1">
      {inputs.map((input) => {
        const outpoint = `${input.sourceTXID}_${input.sourceOutputIndex}`
        const satoshis = inputAmounts?.get(outpoint)
        const isExpanded = expandedIndex === input.index
        const address = input.unlockingScript ? extractAddressFromUnlockingScript(input.unlockingScript) : null

        return (
          <li
            key={`input-${input.index}`}
            className="rounded"
          >
            <div
              className="cursor-pointer p-3 flex gap-2 justify-between hover:bg-accent/50 relative group"
              onClick={() => toggleExpand(input.index)}
            >
            {/* Index */}
            <span className="font-mono flex items-center gap-1 text-muted-foreground text-xs">
              <Hash className="h-3 w-3" />
              {input.index}
            </span>

            {/* Content */}
            <div className="flex w-full items-start gap-2">
              <Identicon value={address || input.sourceTXID} className="w-6 h-6 flex-shrink-0" />

              <div className="flex flex-col w-full min-w-0">
                {address ? (
                  <>
                    <code className="text-xs font-mono truncate">
                      {address}
                    </code>
                    <span className="text-[10px] text-muted-foreground/70">
                      via {truncateTxid(input.sourceTXID)} [{input.sourceOutputIndex}]
                    </span>
                  </>
                ) : (
                  <>
                    <code className="text-xs font-mono text-muted-foreground truncate">
                      {truncateTxid(input.sourceTXID)}
                    </code>
                    <span className="text-[10px] text-muted-foreground/70">
                      Output #{input.sourceOutputIndex}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Amount and Expand Icon */}
            <div className="flex items-center gap-2">
              {satoshis !== undefined && (
                <div className="text-xs font-mono text-nowrap text-muted-foreground">
                  {formatSatoshis(satoshis)}
                </div>
              )}
              {isExpanded ? (
                <ChevronUp className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </div>
            </div>

            {/* Expanded Script Viewer */}
            {isExpanded && (
              <div className="px-3 pb-3 space-y-2">
                <ScriptViewer
                  scriptHex={input.unlockingScript}
                  scriptAsm={input.unlockingScriptAsm}
                  label="Unlocking Script"
                />

                {/* Execute Script Button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={(e) => handleExecuteScript(input, e)}
                >
                  <Play className="mr-2 h-3 w-3" />
                  Execute Script (Step-by-Step)
                </Button>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
