import { Card } from '@/components/ui/card'
import { Utils } from '@bsv/sdk'

interface StackVisualizerProps {
  stack: number[][]
  altStack: number[][]
  ifStack: boolean[]
}

export function StackVisualizer({ stack, altStack, ifStack }: StackVisualizerProps) {
  const decodeStackItem = (item: number[]): { hex: string; ascii: string; dec: string; bool: string } => {
    // Convert number[] to hex string
    const hex = Utils.toHex(item)

    // Convert number[] to ASCII string
    const ascii = item.map(b => (b >= 0x20 && b <= 0x7E) ? String.fromCharCode(b) : '.').join('')

    // Convert number[] to decimal (little-endian)
    let dec = 'too large'
    if (item.length <= 8) {
      let value = 0n
      for (let i = 0; i < item.length; i++) {
        value |= BigInt(item[i]) << BigInt(i * 8)
      }
      // Handle negative numbers (two's complement)
      if (item.length > 0 && item[item.length - 1] & 0x80) {
        const mask = (1n << BigInt(item.length * 8)) - 1n
        value = value - (mask + 1n)
      }
      dec = value.toString()
    }

    const bool = item.length === 0 || item.every(b => b === 0) ? 'false' : 'true'

    return { hex, ascii, dec, bool }
  }

  return (
    <div className="flex flex-col h-full gap-3 overflow-hidden">
      {/* Main Stack */}
      <Card className="p-3 bg-[#1a1a1a] flex flex-col flex-1 min-h-0">
        <div className="flex justify-between items-center mb-2 flex-shrink-0">
          <h3 className="text-xs font-semibold">Main Stack</h3>
          <span className="text-xs text-muted-foreground">
            {stack.length} {stack.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        {stack.length === 0 ? (
          <div className="text-xs text-muted-foreground italic text-center py-2">
            Empty
          </div>
        ) : (
          <div className="space-y-1 flex-1 overflow-y-auto min-h-0">
            {[...stack].reverse().map((item, idx) => {
              const stackIndex = stack.length - 1 - idx
              const decoded = decodeStackItem(item)

              return (
                <div
                  key={idx}
                  className="border border-border rounded p-2 bg-[#0a0a0a] font-mono text-[10px]"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-blue-400 font-semibold">
                      [{stackIndex}]
                    </span>
                    <span className="text-muted-foreground">
                      {item.length} bytes
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex gap-2">
                      <span className="text-muted-foreground min-w-[40px]">hex:</span>
                      <span className="text-green-400 break-all">
                        {decoded.hex || '(empty)'}
                      </span>
                    </div>

                    {decoded.ascii && decoded.ascii !== decoded.hex && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground min-w-[40px]">ascii:</span>
                        <span className="text-yellow-400 truncate">
                          {decoded.ascii}
                        </span>
                      </div>
                    )}

                    {decoded.dec !== 'too large' && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground min-w-[40px]">dec:</span>
                        <span className="text-purple-400">
                          {decoded.dec}
                        </span>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <span className="text-muted-foreground min-w-[40px]">bool:</span>
                      <span className={decoded.bool === 'true' ? 'text-green-400' : 'text-red-400'}>
                        {decoded.bool}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Alt Stack */}
      {altStack.length > 0 && (
        <Card className="p-3 bg-[#1a1a1a] flex flex-col flex-shrink-0 max-h-[30%]">
          <div className="flex justify-between items-center mb-2 flex-shrink-0">
            <h3 className="text-xs font-semibold">Alt Stack</h3>
            <span className="text-xs text-muted-foreground">
              {altStack.length} {altStack.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          <div className="space-y-1 flex-1 overflow-y-auto min-h-0">
            {[...altStack].reverse().map((item, idx) => {
              const stackIndex = altStack.length - 1 - idx
              const decoded = decodeStackItem(item)

              return (
                <div
                  key={idx}
                  className="border border-border rounded p-2 bg-[#0a0a0a] font-mono text-[10px]"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-orange-400 font-semibold">
                      [{stackIndex}]
                    </span>
                    <span className="text-muted-foreground">
                      {item.length} bytes
                    </span>
                  </div>

                  <div className="text-green-400 break-all">
                    {decoded.hex || '(empty)'}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* IF Stack */}
      {ifStack.length > 0 && (
        <Card className="p-3 bg-[#1a1a1a] flex-shrink-0">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-semibold">IF Stack</h3>
            <div className="flex gap-1">
              {ifStack.map((val, idx) => (
                <span
                  key={idx}
                  className={`text-xs px-2 py-1 rounded ${
                    val ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {val ? 'T' : 'F'}
                </span>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
