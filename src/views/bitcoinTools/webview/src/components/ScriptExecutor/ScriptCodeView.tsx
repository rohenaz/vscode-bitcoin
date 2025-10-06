import { Card } from '@/components/ui/card'
import { ChevronRight } from 'lucide-react'
import { OP } from '@bsv/sdk'

interface ScriptChunk {
  op: number
  data?: number[]
}

interface ScriptCodeViewProps {
  unlockingScript: { chunks: ScriptChunk[] }
  lockingScript: { chunks: ScriptChunk[] }
  currentContext: 'UnlockingScript' | 'LockingScript'
  currentPC: number
}

export function ScriptCodeView({
  unlockingScript,
  lockingScript,
  currentContext,
  currentPC
}: ScriptCodeViewProps) {
  const getOpcodeName = (opcode: number): string => {
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

    return (
      <div
        key={`${context}-${index}`}
        className={`
          flex items-center gap-2 px-2 py-1 rounded font-mono text-xs
          ${isCurrentChunk
            ? 'bg-yellow-500/20 border-l-2 border-yellow-500'
            : 'hover:bg-accent/30'
          }
        `}
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
        {chunk.data && chunk.data.length > 0 && (
          <span className="text-muted-foreground truncate flex-1">
            {Buffer.from(chunk.data).toString('hex').slice(0, 40)}
            {chunk.data.length > 20 && '...'}
            <span className="ml-2 text-[10px]">
              ({chunk.data.length} bytes)
            </span>
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Unlocking Script */}
      <Card className="p-3 bg-[#1a1a1a]">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xs font-semibold">Unlocking Script</h3>
          <span className={`text-xs px-2 py-0.5 rounded ${
            currentContext === 'UnlockingScript'
              ? 'bg-green-500/20 text-green-400'
              : 'bg-muted text-muted-foreground'
          }`}>
            {currentContext === 'UnlockingScript' ? 'Executing' : 'Complete'}
          </span>
        </div>

        <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
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
      <Card className="p-3 bg-[#1a1a1a]">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xs font-semibold">Locking Script</h3>
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

        <div className="space-y-0.5 max-h-[300px] overflow-y-auto">
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
