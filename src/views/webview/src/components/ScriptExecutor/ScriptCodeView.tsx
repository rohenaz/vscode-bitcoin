import { Card } from '@/components/ui/card'
import { ChevronRight, Copy, Check } from 'lucide-react'
import { OP, Utils } from '@bsv/sdk'
import { useState, useEffect, useRef } from 'react'
import { getVscode } from '../../vscode'

interface ScriptChunk {
  op: number
  data?: number[]
}

interface ScriptInfo {
  chunks: ScriptChunk[]
  hex: string
  asm: string
}

interface ScriptCodeViewProps {
  unlockingScript: ScriptInfo
  lockingScript: ScriptInfo
  currentContext: 'UnlockingScript' | 'LockingScript'
  currentPC: number
}

export function ScriptCodeView({
  unlockingScript,
  lockingScript,
  currentContext,
  currentPC
}: ScriptCodeViewProps) {
  const vscode = getVscode()
  const [copiedItem, setCopiedItem] = useState<string | null>(null)
  const [hoveredChunk, setHoveredChunk] = useState<string | null>(null)
  const currentChunkRef = useRef<HTMLDivElement | null>(null)
  const lockingScriptContainerRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll to keep current opcode in view
  useEffect(() => {
    if (currentChunkRef.current && lockingScriptContainerRef.current && currentContext === 'LockingScript') {
      currentChunkRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })
    }
  }, [currentPC, currentContext])

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedItem(label)
    setTimeout(() => setCopiedItem(null), 2000)
    vscode.postMessage({
      type: 'showInfo',
      data: { message: `${label} copied to clipboard` }
    })
  }

  const getOpcodeName = (opcode: number): string => {
    // Opcodes 1-75 are implicit data pushes - just show the data, not an opcode name
    if (opcode >= 1 && opcode <= 75) {
      return `<${opcode} bytes>`
    }

    // Find the opcode name by searching through OP object keys
    for (const [key, value] of Object.entries(OP)) {
      if (value === opcode) {
        return key
      }
    }
    return `OP_UNKNOWN_${opcode}`
  }

  const renderChunk = (chunk: ScriptChunk, index: number, isActive: boolean, context: string) => {
    const isCurrentChunk = isActive && index === currentPC
    const opName = getOpcodeName(chunk.op)
    const isDataPush = chunk.op >= 0 && chunk.op <= 96
    const chunkKey = `${context}-${index}`
    const isHovered = hoveredChunk === chunkKey

    return (
      <div
        key={chunkKey}
        ref={isCurrentChunk && context === 'lock' ? currentChunkRef : null}
        className={`
          flex items-center gap-2 px-2 py-1 rounded font-mono text-xs group
          ${isCurrentChunk
            ? 'bg-yellow-500/20 border-l-2 border-yellow-500'
            : 'hover:bg-accent/30'
          }
        `}
        onMouseEnter={() => setHoveredChunk(chunkKey)}
        onMouseLeave={() => setHoveredChunk(null)}
      >
        {/* Current indicator */}
        <div className="w-4 flex-shrink-0">
          {isCurrentChunk && (
            <ChevronRight className="h-3 w-3 text-yellow-500" />
          )}
        </div>

        {/* Index */}
        <span className="text-muted-foreground min-w-[24px] text-right">
          {index}
        </span>

        {/* Opcode */}
        <span className={`font-semibold min-w-[100px] ${
          isDataPush ? 'text-green-400' : 'text-blue-400'
        }`}>
          {opName}
        </span>

        {/* Data */}
        {chunk.data && chunk.data.length > 0 ? (
          <span className="text-muted-foreground truncate flex-1 flex items-center gap-2">
            <span className="truncate">
              {Utils.toHex(chunk.data).slice(0, 40)}
              {chunk.data.length > 20 && '...'}
              <span className="ml-2 text-[10px]">
                ({chunk.data.length} bytes)
              </span>
            </span>
            {/* Copy button visible on hover */}
            {isHovered && (
              <button
                onClick={() => handleCopy(Utils.toHex(chunk.data!), `Data ${chunkKey}`)}
                className="flex-shrink-0 hover:text-foreground transition-colors"
                title="Copy data as hex"
              >
                {copiedItem === `Data ${chunkKey}` ? (
                  <Check className="h-3 w-3 text-green-400" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            )}
          </span>
        ) : (
          <>
            <span className="flex-1"></span>
            {/* Copy button for opcode (visible on hover, only for non-data opcodes) */}
            {isHovered && (
              <button
                onClick={() => handleCopy(opName, `Opcode ${chunkKey}`)}
                className="flex-shrink-0 hover:text-foreground transition-colors"
                title="Copy opcode"
              >
                {copiedItem === `Opcode ${chunkKey}` ? (
                  <Check className="h-3 w-3 text-green-400" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full gap-3 overflow-hidden">
      {/* Unlocking Script */}
      <Card className="p-3 bg-[#1a1a1a] flex flex-col flex-shrink-0 max-h-[30%]">
        <div className="flex justify-between items-center mb-2 flex-shrink-0">
          <h3 className="text-xs font-semibold">Unlocking Script [{unlockingScript.chunks.length}]</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopy(unlockingScript.asm, 'Unlocking Script (ASM)')}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              title="Copy as ASM"
            >
              {copiedItem === 'Unlocking Script (ASM)' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              ASM
            </button>
            <button
              onClick={() => handleCopy(unlockingScript.hex, 'Unlocking Script (HEX)')}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              title="Copy as hex"
            >
              {copiedItem === 'Unlocking Script (HEX)' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              HEX
            </button>
            <span className={`text-xs px-2 py-0.5 rounded ${
              currentContext === 'UnlockingScript'
                ? 'bg-green-500/20 text-green-400'
                : 'bg-muted text-muted-foreground'
            }`}>
              {currentContext === 'UnlockingScript' ? 'Executing' : 'Complete'}
            </span>
          </div>
        </div>

        <div className="space-y-0.5 flex-1 overflow-y-auto min-h-0">
          {unlockingScript.chunks.length === 0 ? (
            <div className="text-xs text-muted-foreground italic text-center py-2">
              No unlocking script
            </div>
          ) : (
            unlockingScript.chunks.map((chunk, idx) =>
              renderChunk(chunk, idx, currentContext === 'UnlockingScript', 'unlock')
            )
          )}
        </div>
      </Card>

      {/* Locking Script */}
      <Card className="p-3 bg-[#1a1a1a] flex flex-col flex-1 min-h-0">
        <div className="flex justify-between items-center mb-2 flex-shrink-0">
          <h3 className="text-xs font-semibold">Locking Script [{lockingScript.chunks.length}]</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopy(lockingScript.asm, 'Locking Script (ASM)')}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              title="Copy as ASM"
            >
              {copiedItem === 'Locking Script (ASM)' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              ASM
            </button>
            <button
              onClick={() => handleCopy(lockingScript.hex, 'Locking Script (HEX)')}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              title="Copy as hex"
            >
              {copiedItem === 'Locking Script (HEX)' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              HEX
            </button>
            <span className={`text-xs px-2 py-0.5 rounded ${
              currentContext === 'LockingScript'
                ? 'bg-green-500/20 text-green-400'
                : currentContext === 'UnlockingScript'
                ? 'bg-muted text-muted-foreground'
                : 'bg-green-500/20 text-green-400'
            }`}>
              {currentContext === 'LockingScript' ? 'Executing' :
               currentContext === 'UnlockingScript' ? 'Pending' : 'Complete'}
            </span>
          </div>
        </div>

        <div ref={lockingScriptContainerRef} className="space-y-0.5 flex-1 overflow-y-auto min-h-0">
          {lockingScript.chunks.length === 0 ? (
            <div className="text-xs text-muted-foreground italic text-center py-2">
              No locking script
            </div>
          ) : (
            lockingScript.chunks.map((chunk, idx) =>
              renderChunk(chunk, idx, currentContext === 'LockingScript', 'lock')
            )
          )}
        </div>
      </Card>
    </div>
  )
}
