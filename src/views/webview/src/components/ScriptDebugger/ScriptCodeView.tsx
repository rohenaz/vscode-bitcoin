import { ChevronRight, Copy, Check, Circle } from 'lucide-react'
import { OP, Utils } from '@bsv/sdk'
import { useState, useEffect, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { getVscode } from '../../vscode'
import { getBreakpointKey } from '../../types/scriptExecution'

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
  executorId: string
  hasStarted: boolean
  isComplete: boolean
}

export function ScriptCodeView({
  unlockingScript,
  lockingScript,
  currentContext,
  currentPC,
  executorId,
  hasStarted,
  isComplete
}: ScriptCodeViewProps) {
  const vscode = getVscode()
  const [copiedItem, setCopiedItem] = useState<string | null>(null)
  const [hoveredChunk, setHoveredChunk] = useState<string | null>(null)
  const [breakpoints, setBreakpoints] = useState<Map<string, boolean>>(new Map())
  const unlockingScrollRef = useRef<HTMLDivElement | null>(null)
  const lockingScrollRef = useRef<HTMLDivElement | null>(null)

  // Throttling for scroll operations
  const lastScrollTimeRef = useRef<number>(0)
  const pendingScrollRef = useRef<{ pc: number; context: string } | null>(null)
  const scrollTimerRef = useRef<number | null>(null)

  // Virtualizers for both scripts
  const unlockingVirtualizer = useVirtualizer({
    count: unlockingScript.chunks.length,
    getScrollElement: () => unlockingScrollRef.current,
    estimateSize: () => 32, // Approximate height of each chunk row
    overscan: 10, // Render 10 extra items above and below viewport
  })

  const lockingVirtualizer = useVirtualizer({
    count: lockingScript.chunks.length,
    getScrollElement: () => lockingScrollRef.current,
    estimateSize: () => 32,
    overscan: 10,
  })

  // Auto-scroll to keep current opcode in view - THROTTLED
  useEffect(() => {
    const now = Date.now()
    const timeSinceLastScroll = now - lastScrollTimeRef.current

    const performScroll = () => {
      if (currentContext === 'LockingScript' && currentPC >= 0 && currentPC < lockingScript.chunks.length) {
        lockingVirtualizer.scrollToIndex(currentPC, {
          align: 'center',
          behavior: 'auto', // Use 'auto' instead of 'smooth' for faster updates
        })
      } else if (currentContext === 'UnlockingScript' && currentPC >= 0 && currentPC < unlockingScript.chunks.length) {
        unlockingVirtualizer.scrollToIndex(currentPC, {
          align: 'center',
          behavior: 'auto',
        })
      }
      lastScrollTimeRef.current = Date.now()
    }

    // Throttle to max 5 scrolls per second (200ms)
    if (timeSinceLastScroll >= 200) {
      performScroll()
      pendingScrollRef.current = null

      // Clear any pending timer
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current)
        scrollTimerRef.current = null
      }
    } else {
      // Store pending scroll
      pendingScrollRef.current = { pc: currentPC, context: currentContext }

      // Schedule scroll if not already scheduled
      if (!scrollTimerRef.current) {
        const delay = 200 - timeSinceLastScroll
        scrollTimerRef.current = window.setTimeout(() => {
          if (pendingScrollRef.current) {
            performScroll()
            pendingScrollRef.current = null
          }
          scrollTimerRef.current = null
        }, delay)
      }
    }

    return () => {
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current)
      }
    }
  }, [currentPC, currentContext, lockingScript.chunks.length, unlockingScript.chunks.length])

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

  // Breakpoint helper functions
  const hasBreakpoint = (context: 'UnlockingScript' | 'LockingScript', index: number): boolean => {
    const key = getBreakpointKey(context, index)
    return breakpoints.get(key) === true
  }

  const toggleBreakpoint = (context: 'UnlockingScript' | 'LockingScript', index: number) => {
    const key = getBreakpointKey(context, index)
    const newValue = !breakpoints.get(key)

    // Update local state immediately for responsive UI
    setBreakpoints(prev => {
      const next = new Map(prev)
      if (newValue) {
        next.set(key, true)
      } else {
        next.delete(key)
      }
      return next
    })

    // Send message to backend
    vscode.postMessage({
      type: 'scriptDebugger:toggleBreakpoint',
      data: {
        id: executorId,
        context,
        index,
        enabled: newValue
      }
    })
  }

  const renderChunk = (chunk: ScriptChunk, index: number, isActive: boolean, context: string, style?: React.CSSProperties) => {
    // currentPC now directly points to the next instruction to execute (no +1 needed)
    const isCurrentChunk = isActive && index === currentPC
    const opName = getOpcodeName(chunk.op)
    const isDataPush = chunk.op >= 0 && chunk.op <= 96
    const chunkKey = `${context}-${index}`
    const isHovered = hoveredChunk === chunkKey
    const scriptContext = context === 'unlock' ? 'UnlockingScript' : 'LockingScript'
    const hasBreak = hasBreakpoint(scriptContext, index)

    return (
      <div
        key={chunkKey}
        style={style}
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
        {/* Gutter: Breakpoint indicator + Current execution indicator */}
        <div className="w-5 flex-shrink-0 flex items-center justify-center relative">
          {/* Breakpoint indicator - always visible if set, clickable */}
          {hasBreak && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleBreakpoint(scriptContext, index)
              }}
              className="absolute hover:scale-125 transition-transform z-10"
              title="Remove breakpoint"
            >
              <Circle className="h-2.5 w-2.5 fill-red-500 text-red-500" />
            </button>
          )}

          {/* Hover: Show breakpoint toggle button */}
          {isHovered && !hasBreak && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleBreakpoint(scriptContext, index)
              }}
              className="absolute hover:scale-110 transition-transform opacity-50 hover:opacity-100"
              title="Add breakpoint"
            >
              <Circle className="h-2.5 w-2.5 text-muted-foreground" />
            </button>
          )}

          {/* Current execution indicator - overlays breakpoint */}
          {isCurrentChunk && (
            <ChevronRight className="h-3 w-3 text-yellow-500 absolute z-20" />
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

        {/* Data - with consistent copy button placement */}
        {chunk.data && chunk.data.length > 0 ? (
          <>
            <span className="text-muted-foreground truncate flex-1">
              {Utils.toHex(chunk.data).slice(0, 40)}
              {chunk.data.length > 20 && '...'}
              <span className="ml-2 text-[10px]">
                ({chunk.data.length} bytes)
              </span>
            </span>
            {/* Copy button visible on hover - always at far right */}
            {isHovered && (
              <button
                onClick={() => handleCopy(Utils.toHex(chunk.data!), `Data ${chunkKey}`)}
                className="flex-shrink-0 hover:text-foreground transition-colors ml-2"
                title="Copy data as hex"
              >
                {copiedItem === `Data ${chunkKey}` ? (
                  <Check className="h-3 w-3 text-green-400" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            )}
          </>
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
    <ResizablePanelGroup direction="vertical" className="h-full">
      {/* Unlocking Script */}
      <ResizablePanel defaultSize={30} minSize={20}>
        <div className="flex flex-col h-full p-3">
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
                !hasStarted
                  ? 'bg-muted text-muted-foreground'
                  : currentContext === 'UnlockingScript'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-blue-500/20 text-blue-400'
              }`}>
                {!hasStarted
                  ? 'Ready'
                  : currentContext === 'UnlockingScript'
                  ? 'Executing'
                  : 'Complete'}
              </span>
            </div>
          </div>

          <div
            ref={unlockingScrollRef}
            className="flex-1 overflow-y-auto min-h-0"
          >
            {unlockingScript.chunks.length === 0 ? (
              <div className="text-xs text-muted-foreground italic text-center py-2">
                No unlocking script
              </div>
            ) : (
              <div
                style={{
                  height: `${unlockingVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {unlockingVirtualizer.getVirtualItems().map((virtualItem) => {
                  const chunk = unlockingScript.chunks[virtualItem.index]
                  return renderChunk(
                    chunk,
                    virtualItem.index,
                    currentContext === 'UnlockingScript',
                    'unlock',
                    {
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                    }
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Locking Script */}
      <ResizablePanel defaultSize={70} minSize={20}>
        <div className="flex flex-col h-full p-3">
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
                !hasStarted || currentContext === 'UnlockingScript'
                  ? 'bg-muted text-muted-foreground'
                  : isComplete
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-green-500/20 text-green-400'
              }`}>
                {!hasStarted
                  ? 'Ready'
                  : currentContext === 'UnlockingScript'
                  ? 'Pending'
                  : isComplete
                  ? 'Complete'
                  : 'Executing'}
              </span>
            </div>
          </div>

          <div
            ref={lockingScrollRef}
            className="flex-1 overflow-y-auto min-h-0"
          >
            {lockingScript.chunks.length === 0 ? (
              <div className="text-xs text-muted-foreground italic text-center py-2">
                No locking script
              </div>
            ) : (
              <div
                style={{
                  height: `${lockingVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {lockingVirtualizer.getVirtualItems().map((virtualItem) => {
                  const chunk = lockingScript.chunks[virtualItem.index]
                  return renderChunk(
                    chunk,
                    virtualItem.index,
                    currentContext === 'LockingScript',
                    'lock',
                    {
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                    }
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
