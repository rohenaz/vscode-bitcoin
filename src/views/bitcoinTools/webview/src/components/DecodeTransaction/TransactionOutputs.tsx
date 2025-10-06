import { useState } from 'react'
import { Hash, ChevronDown, ChevronUp } from 'lucide-react'
import type { DecodedTransactionOutput } from '../../types/decodedTransaction'
import { Identicon } from '../Identicon'
import { ScriptViewer } from '../ScriptViewer'
import { detectScriptType, formatSatoshis, extractP2PKHAddress } from '../../utils/scriptParser'

interface TransactionOutputsProps {
  outputs: DecodedTransactionOutput[]
  highlightIndex?: number
}

export function TransactionOutputs({ outputs, highlightIndex }: TransactionOutputsProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index)
  }

  return (
    <ul className="rounded bg-gradient-to-b from-[#1a1a1a] to-black space-y-1">
      {outputs.map((output) => {
        const scriptInfo = detectScriptType(output.lockingScriptAsm)
        const address = scriptInfo.type === 'p2pkh' ? extractP2PKHAddress(output.lockingScript) : null
        const isHighlighted = highlightIndex !== undefined && output.index === highlightIndex
        const isExpanded = expandedIndex === output.index

        return (
          <li
            key={`output-${output.index}`}
            className={`rounded ${
              isHighlighted ? 'bg-accent/30 ring-1 ring-primary' : ''
            }`}
          >
            <div
              className="cursor-pointer p-3 flex gap-2 justify-between hover:bg-accent/50 relative group"
              onClick={() => toggleExpand(output.index)}
            >
            {/* Index */}
            <span
              className={`font-mono flex items-center gap-1 text-xs ${
                isHighlighted ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Hash className="h-3 w-3" />
              {output.index}
            </span>

            {/* Content */}
            <div className="flex w-full items-start gap-2">
              {scriptInfo.type === 'p2pkh' && (
                <Identicon
                  value={output.lockingScript}
                  className="w-6 h-6 flex-shrink-0"
                />
              )}

              <div className="flex flex-col w-full min-w-0">
                {scriptInfo.type === 'p2pkh' ? (
                  <code className="text-xs font-mono truncate">
                    {address || 'Invalid P2PKH'}
                  </code>
                ) : scriptInfo.type === 'op_return' || scriptInfo.type === 'run' ? (
                  <span className="text-xs font-mono text-muted-foreground">
                    {scriptInfo.label}
                  </span>
                ) : (
                  <code className="text-xs font-mono text-muted-foreground truncate">
                    {scriptInfo.label}
                  </code>
                )}

                {scriptInfo.type === 'p2pkh' && (
                  <span className="text-[10px] text-muted-foreground/70">
                    Pay to Public Key Hash
                  </span>
                )}
              </div>
            </div>

            {/* Amount */}
            <div className="flex items-center gap-2">
              <div className="text-xs font-mono text-nowrap text-muted-foreground">
                {formatSatoshis(output.satoshis)}
              </div>
              {isExpanded ? (
                <ChevronUp className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </div>
            </div>

            {/* Expanded Script Viewer */}
            {isExpanded && (
              <div className="px-3 pb-3">
                <ScriptViewer
                  scriptHex={output.lockingScript}
                  scriptAsm={output.lockingScriptAsm}
                  label="Locking Script"
                />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
