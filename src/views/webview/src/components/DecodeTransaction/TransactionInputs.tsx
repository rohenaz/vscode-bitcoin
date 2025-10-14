import { useState } from 'react'
import { Hash, ChevronDown, ChevronUp, Play, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import type { DecodedTransactionInput, DecodedTransactionOutput } from '../../types/decodedTransaction'
import { Identicon } from '../Identicon'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatSatoshis, truncateTxid, extractP2PKHAddress, detectScriptType } from '../../utils/scriptParser'
import { getVscode } from '../../vscode'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface TransactionInputsProps {
  inputs: DecodedTransactionInput[]
  outputs: DecodedTransactionOutput[]
  transactionVersion: number
  transactionLockTime: number
  network?: string
}

export function TransactionInputs({ inputs, outputs, transactionVersion, transactionLockTime, network = 'mainnet' }: TransactionInputsProps) {
  const vscode = getVscode()
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [encodingView, setEncodingView] = useState<{ [key: number]: string }>({})

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index)
  }

  const handleExecuteScript = (input: DecodedTransactionInput, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!input.resolved || !input.lockingScript) {
      vscode.postMessage({
        type: 'showWarning',
        data: { message: 'Input not resolved. Cannot execute script without locking script.' }
      })
      return
    }

    vscode.postMessage({
      type: 'transaction:executeScript',
      data: {
        inputIndex: input.index,
        unlockingScript: input.unlockingScript,
        sourceTXID: input.sourceTXID,
        sourceOutputIndex: input.sourceOutputIndex,
        // Pass full transaction context for proper script execution
        spendingTxInputs: inputs,
        spendingTxOutputs: outputs,
        transactionVersion,
        transactionLockTime
      }
    })
  }

  const handleLoadTransaction = (txid: string, e: React.MouseEvent) => {
    e.stopPropagation()
    vscode.postMessage({
      type: 'transaction:loadByTxid',
      data: { txid, network }
    })
  }

  const hexToAscii = (hex: string): string => {
    try {
      let str = ''
      for (let i = 0; i < hex.length; i += 2) {
        const byte = parseInt(hex.substr(i, 2), 16)
        str += byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.'
      }
      return str
    } catch {
      return ''
    }
  }

  const getEncodingView = (inputIndex: number) => {
    return encodingView[inputIndex] || 'script'
  }

  const setInputEncodingView = (inputIndex: number, view: string) => {
    setEncodingView(prev => ({ ...prev, [inputIndex]: view }))
  }

  const renderScriptContent = (script: string, scriptAsm: string, view: string) => {
    switch (view) {
      case 'ascii':
        return (
          <ScrollArea className="h-48 w-full rounded-md border border-border">
            <pre className="text-[10px] font-mono whitespace-pre-wrap break-all bg-black/30 p-2">
              {hexToAscii(script)}
            </pre>
          </ScrollArea>
        )
      case 'script':
        return (
          <ScrollArea className="h-48 w-full rounded-md border border-border">
            <pre className="text-[10px] font-mono whitespace-pre-wrap break-all bg-black/30 p-2">
              {scriptAsm}
            </pre>
          </ScrollArea>
        )
      case 'hex':
      default:
        return (
          <ScrollArea className="h-48 w-full rounded-md border border-border">
            <pre className="text-[10px] font-mono whitespace-pre-wrap break-all bg-black/30 p-2">
              {script}
            </pre>
          </ScrollArea>
        )
    }
  }

  return (
    <ul className="rounded bg-gradient-to-b from-[#1a1a1a] to-black space-y-1">
      {inputs.map((input) => {
        const isExpanded = expandedIndex === input.index
        const address = input.lockingScript ? extractP2PKHAddress(input.lockingScript) : null
        const scriptInfo = input.lockingScriptAsm ? detectScriptType(input.lockingScriptAsm) : null

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
                {input.resolved && scriptInfo?.type === 'p2pkh' && address && (
                  <Identicon value={input.lockingScript || input.sourceTXID} className="w-6 h-6 flex-shrink-0" />
                )}

                <div className="flex flex-col w-full min-w-0">
                  {input.resolved && scriptInfo?.type === 'p2pkh' && address ? (
                    <>
                      <code className="text-xs font-mono truncate">
                        {address}
                      </code>
                      <button
                        onClick={(e) => handleLoadTransaction(input.sourceTXID, e)}
                        className="text-[10px] text-blue-500/80 hover:text-blue-400 w-fit"
                        title="Click to view source transaction"
                      >
                        via {truncateTxid(input.sourceTXID)} [{input.sourceOutputIndex}]
                      </button>
                    </>
                  ) : input.resolved && scriptInfo ? (
                    <>
                      <code className="text-xs font-mono text-muted-foreground truncate">
                        {scriptInfo.label}
                      </code>
                      <button
                        onClick={(e) => handleLoadTransaction(input.sourceTXID, e)}
                        className="text-[10px] text-blue-500/80 hover:text-blue-400 w-fit"
                        title="Click to view source transaction"
                      >
                        via {truncateTxid(input.sourceTXID)} [{input.sourceOutputIndex}]
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={(e) => handleLoadTransaction(input.sourceTXID, e)}
                        className="text-xs font-mono text-blue-500/80 hover:text-blue-400 truncate w-fit"
                        title="Click to view source transaction"
                      >
                        {truncateTxid(input.sourceTXID)}
                      </button>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground/70">
                          Output #{input.sourceOutputIndex}
                        </span>
                        {input.resolved === false && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <AlertCircle className="h-3 w-3 text-orange-500/80" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Input not found on chain</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Amount and Status */}
              <div className="flex items-center gap-2">
                {input.resolved && input.satoshis !== undefined && (
                  <div className="text-xs font-mono text-nowrap text-muted-foreground">
                    {formatSatoshis(input.satoshis)}
                  </div>
                )}
                {input.resolved && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <CheckCircle className="h-3 w-3 text-green-500/80" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Resolved from chain</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
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
              <div className="px-3 pb-3 space-y-3">
                <Tabs defaultValue="scriptpubkey" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 h-7">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <TabsTrigger value="scriptpubkey" disabled={input.resolved === false} className="text-[10px] h-6">
                            SCRIPTPUBKEY
                          </TabsTrigger>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs max-w-xs">
                            The locking script from the output being spent. Defines the conditions that must be met to spend the coins.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <TabsTrigger value="scriptsig" className="text-[10px] h-6">SCRIPTSIG</TabsTrigger>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs max-w-xs">
                            The unlocking script that proves you can spend the coins. Typically contains signatures and public keys.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TabsList>

                  <TabsContent value="scriptpubkey" className="space-y-2">
                    {input.resolved && input.lockingScript && input.lockingScriptAsm ? (
                      <>
                        <Tabs
                          value={getEncodingView(input.index)}
                          onValueChange={(v) => setInputEncodingView(input.index, v)}
                          className="w-full"
                        >
                          <TabsList className="grid w-full grid-cols-3 h-7">
                            <TabsTrigger value="ascii" className="text-[10px] h-6">ASCII</TabsTrigger>
                            <TabsTrigger value="script" className="text-[10px] h-6">SCRIPT</TabsTrigger>
                            <TabsTrigger value="hex" className="text-[10px] h-6">HEX</TabsTrigger>
                          </TabsList>

                          <TabsContent value="ascii">
                            {renderScriptContent(input.lockingScript, input.lockingScriptAsm, 'ascii')}
                          </TabsContent>
                          <TabsContent value="script">
                            {renderScriptContent(input.lockingScript, input.lockingScriptAsm, 'script')}
                          </TabsContent>
                          <TabsContent value="hex">
                            {renderScriptContent(input.lockingScript, input.lockingScriptAsm, 'hex')}
                          </TabsContent>
                        </Tabs>
                      </>
                    ) : input.resolved === false ? (
                      <div className="text-xs text-muted-foreground p-4 text-center">
                        <AlertCircle className="h-4 w-4 mx-auto mb-2" />
                        Input not resolved from chain
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground p-4 text-center">
                        <Loader2 className="h-4 w-4 mx-auto mb-2 animate-spin" />
                        Resolving input from chain...
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="scriptsig" className="space-y-2">
                    <Tabs
                      value={getEncodingView(input.index)}
                      onValueChange={(v) => setInputEncodingView(input.index, v)}
                      className="w-full"
                    >
                      <TabsList className="grid w-full grid-cols-3 h-7">
                        <TabsTrigger value="ascii" className="text-[10px] h-6">ASCII</TabsTrigger>
                        <TabsTrigger value="script" className="text-[10px] h-6">SCRIPT</TabsTrigger>
                        <TabsTrigger value="hex" className="text-[10px] h-6">HEX</TabsTrigger>
                      </TabsList>

                      <TabsContent value="ascii">
                        {renderScriptContent(input.unlockingScript, input.unlockingScriptAsm, 'ascii')}
                      </TabsContent>
                      <TabsContent value="script">
                        {renderScriptContent(input.unlockingScript, input.unlockingScriptAsm, 'script')}
                      </TabsContent>
                      <TabsContent value="hex">
                        {renderScriptContent(input.unlockingScript, input.unlockingScriptAsm, 'hex')}
                      </TabsContent>
                    </Tabs>
                  </TabsContent>
                </Tabs>

                {/* Execute Script Button */}
                {input.resolved && input.lockingScript && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={(e) => handleExecuteScript(input, e)}
                  >
                    <Play className="mr-2 h-3 w-3" />
                    Execute Script (Step-by-Step)
                  </Button>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
