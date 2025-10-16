import { Utils } from '@bsv/sdk'
import { useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Copy, Check } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { getVscode } from '../../vscode'

interface StackVisualizerProps {
  stack: number[][]
  altStack: number[][]
  ifStack: boolean[]
}

export function StackVisualizer({ stack, altStack, ifStack }: StackVisualizerProps) {
  const vscode = getVscode()
  const mainStackScrollRef = useRef<HTMLDivElement | null>(null)
  const altStackScrollRef = useRef<HTMLDivElement | null>(null)
  const [copiedItem, setCopiedItem] = useState<string | null>(null)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)

  const reversedStack = [...stack].reverse()
  const reversedAltStack = [...altStack].reverse()

  const mainStackVirtualizer = useVirtualizer({
    count: reversedStack.length,
    getScrollElement: () => mainStackScrollRef.current,
    estimateSize: () => 120, // Approximate height of each stack item
    overscan: 5,
  })

  const altStackVirtualizer = useVirtualizer({
    count: reversedAltStack.length,
    getScrollElement: () => altStackScrollRef.current,
    estimateSize: () => 100,
    overscan: 5,
  })

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedItem(label)
    setTimeout(() => setCopiedItem(null), 2000)
    vscode.postMessage({
      type: 'showInfo',
      data: { message: `${label} copied to clipboard` }
    })
  }

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

  const hasAltStack = altStack.length > 0
  const hasIfStack = ifStack.length > 0

  // If no alt or if stack, just show main stack without resizable
  if (!hasAltStack && !hasIfStack) {
    return (
      <div className="flex flex-col h-full p-3">
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
          <div
            ref={mainStackScrollRef}
            className="flex-1 overflow-y-auto min-h-0"
          >
            <div
              style={{
                height: `${mainStackVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {mainStackVirtualizer.getVirtualItems().map((virtualItem) => {
                const item = reversedStack[virtualItem.index]
                const stackIndex = stack.length - 1 - virtualItem.index
                const decoded = decodeStackItem(item)

                const itemKey = `main-${virtualItem.index}`
                const isHovered = hoveredItem === itemKey

                return (
                  <div
                    key={virtualItem.index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                    className="font-mono text-[10px] group"
                    onMouseEnter={() => setHoveredItem(itemKey)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    {virtualItem.index > 0 && <Separator className="mb-2" />}
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-blue-400 font-semibold">
                        [{stackIndex}]
                      </span>
                      <span className="text-muted-foreground">
                        {item.length} bytes
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex gap-2 items-center">
                        <span className="text-muted-foreground min-w-[40px] flex-shrink-0">hex:</span>
                        <span className="text-green-400 truncate flex-1">
                          {decoded.hex || '(empty)'}
                        </span>
                        {isHovered && decoded.hex && (
                          <button
                            onClick={() => handleCopy(decoded.hex, `Stack[${stackIndex}] hex`)}
                            className="flex-shrink-0 hover:text-foreground transition-colors"
                            title="Copy hex value"
                          >
                            {copiedItem === `Stack[${stackIndex}] hex` ? (
                              <Check className="h-3 w-3 text-green-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        )}
                      </div>

                      {decoded.ascii && decoded.ascii !== decoded.hex && (
                        <div className="flex gap-2 items-center">
                          <span className="text-muted-foreground min-w-[40px] flex-shrink-0">ascii:</span>
                          <span className="text-yellow-400 truncate flex-1">
                            {decoded.ascii}
                          </span>
                          {isHovered && (
                            <button
                              onClick={() => handleCopy(decoded.ascii, `Stack[${stackIndex}] ascii`)}
                              className="flex-shrink-0 hover:text-foreground transition-colors"
                              title="Copy ASCII value"
                            >
                              {copiedItem === `Stack[${stackIndex}] ascii` ? (
                                <Check className="h-3 w-3 text-green-400" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          )}
                        </div>
                      )}

                      {decoded.dec !== 'too large' && (
                        <div className="flex gap-2 items-center">
                          <span className="text-muted-foreground min-w-[40px] flex-shrink-0">dec:</span>
                          <span className="text-purple-400 truncate flex-1">
                            {decoded.dec}
                          </span>
                          {isHovered && (
                            <button
                              onClick={() => handleCopy(decoded.dec, `Stack[${stackIndex}] dec`)}
                              className="flex-shrink-0 hover:text-foreground transition-colors"
                              title="Copy decimal value"
                            >
                              {copiedItem === `Stack[${stackIndex}] dec` ? (
                                <Check className="h-3 w-3 text-green-400" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          )}
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
          </div>
        )}
      </div>
    )
  }

  return (
    <ResizablePanelGroup direction="vertical" className="h-full">
      {/* Main Stack */}
      <ResizablePanel defaultSize={hasAltStack || hasIfStack ? 70 : 100} minSize={30}>
        <div className="flex flex-col h-full p-3">
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
            <div
              ref={mainStackScrollRef}
              className="flex-1 overflow-y-auto min-h-0"
            >
              <div
                style={{
                  height: `${mainStackVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {mainStackVirtualizer.getVirtualItems().map((virtualItem) => {
                  const item = reversedStack[virtualItem.index]
                  const stackIndex = stack.length - 1 - virtualItem.index
                  const decoded = decodeStackItem(item)

                  const itemKey = `main-resizable-${virtualItem.index}`
                  const isHovered = hoveredItem === itemKey

                  return (
                    <div
                      key={virtualItem.index}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                      className="font-mono text-[10px] group"
                      onMouseEnter={() => setHoveredItem(itemKey)}
                      onMouseLeave={() => setHoveredItem(null)}
                    >
                      {virtualItem.index > 0 && <Separator className="mb-2" />}
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-blue-400 font-semibold">
                          [{stackIndex}]
                        </span>
                        <span className="text-muted-foreground">
                          {item.length} bytes
                        </span>
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex gap-2 items-center">
                          <span className="text-muted-foreground min-w-[40px] flex-shrink-0">hex:</span>
                          <span className="text-green-400 truncate flex-1">
                            {decoded.hex || '(empty)'}
                          </span>
                          {isHovered && decoded.hex && (
                            <button
                              onClick={() => handleCopy(decoded.hex, `Stack[${stackIndex}] hex`)}
                              className="flex-shrink-0 hover:text-foreground transition-colors"
                              title="Copy hex value"
                            >
                              {copiedItem === `Stack[${stackIndex}] hex` ? (
                                <Check className="h-3 w-3 text-green-400" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          )}
                        </div>

                        {decoded.ascii && decoded.ascii !== decoded.hex && (
                          <div className="flex gap-2 items-center">
                            <span className="text-muted-foreground min-w-[40px] flex-shrink-0">ascii:</span>
                            <span className="text-yellow-400 truncate flex-1">
                              {decoded.ascii}
                            </span>
                            {isHovered && (
                              <button
                                onClick={() => handleCopy(decoded.ascii, `Stack[${stackIndex}] ascii`)}
                                className="flex-shrink-0 hover:text-foreground transition-colors"
                                title="Copy ASCII value"
                              >
                                {copiedItem === `Stack[${stackIndex}] ascii` ? (
                                  <Check className="h-3 w-3 text-green-400" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            )}
                          </div>
                        )}

                        {decoded.dec !== 'too large' && (
                          <div className="flex gap-2 items-center">
                            <span className="text-muted-foreground min-w-[40px] flex-shrink-0">dec:</span>
                            <span className="text-purple-400 truncate flex-1">
                              {decoded.dec}
                            </span>
                            {isHovered && (
                              <button
                                onClick={() => handleCopy(decoded.dec, `Stack[${stackIndex}] dec`)}
                                className="flex-shrink-0 hover:text-foreground transition-colors"
                                title="Copy decimal value"
                              >
                                {copiedItem === `Stack[${stackIndex}] dec` ? (
                                  <Check className="h-3 w-3 text-green-400" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            )}
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
            </div>
          )}
        </div>
      </ResizablePanel>

      {/* Alt Stack */}
      {hasAltStack && (
        <>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={hasIfStack ? 20 : 30} minSize={15}>
            <div className="flex flex-col h-full p-3">
              <div className="flex justify-between items-center mb-2 flex-shrink-0">
                <h3 className="text-xs font-semibold">Alt Stack</h3>
                <span className="text-xs text-muted-foreground">
                  {altStack.length} {altStack.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              <div
                ref={altStackScrollRef}
                className="flex-1 overflow-y-auto min-h-0"
              >
                <div
                  style={{
                    height: `${altStackVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {altStackVirtualizer.getVirtualItems().map((virtualItem) => {
                    const item = reversedAltStack[virtualItem.index]
                    const stackIndex = altStack.length - 1 - virtualItem.index
                    const decoded = decodeStackItem(item)

                    return (
                      <div
                        key={virtualItem.index}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          transform: `translateY(${virtualItem.start}px)`,
                        }}
                        className="font-mono text-[10px]"
                      >
                        {virtualItem.index > 0 && <Separator className="mb-2" />}
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
              </div>
            </div>
          </ResizablePanel>
        </>
      )}

      {/* IF Stack */}
      {hasIfStack && (
        <>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={10} minSize={10}>
            <div className="flex flex-col h-full p-3">
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
            </div>
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  )
}
