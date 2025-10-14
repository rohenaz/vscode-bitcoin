import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Copy } from 'lucide-react'
import { hexToChunked, asmToSasm, tokenizeAsm, type ScriptToken } from '../utils/scriptFormatter'
import { getVscode } from '../vscode'

interface ScriptViewerProps {
  scriptHex: string
  scriptAsm: string
  label?: string
  className?: string
}

export function ScriptViewer({ scriptHex, scriptAsm, label, className = '' }: ScriptViewerProps) {
  const vscode = getVscode()
  const [activeTab, setActiveTab] = useState('asm')

  const handleCopy = (text: string, format: string) => {
    navigator.clipboard.writeText(text)
    vscode.postMessage({
      type: 'showInfo',
      data: { message: `${format} copied to clipboard` }
    })
  }

  const chunkedHex = hexToChunked(scriptHex)
  const sasm = asmToSasm(scriptAsm)
  const tokens = tokenizeAsm(scriptAsm)

  const renderTokens = (tokens: ScriptToken[]) => {
    return tokens.map((token, idx) => {
      let className = 'font-mono text-xs '

      if (token.type === 'opcode') {
        className += 'text-blue-400 font-semibold'
      } else if (token.type === 'data') {
        className += 'text-green-400'
      } else {
        className += 'text-muted-foreground'
      }

      return (
        <span key={idx} className={className}>
          {token.value}{' '}
        </span>
      )
    })
  }

  return (
    <div className={`border border-border rounded-md ${className}`}>
      {label && (
        <div className="px-3 py-1.5 border-b border-border bg-muted/30">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between px-2 py-1 border-b border-border">
          <TabsList className="h-7">
            <TabsTrigger value="asm" className="text-xs px-2 py-0.5">ASM</TabsTrigger>
            <TabsTrigger value="hex" className="text-xs px-2 py-0.5">Hex</TabsTrigger>
            <TabsTrigger value="chunked" className="text-xs px-2 py-0.5">Chunked</TabsTrigger>
            <TabsTrigger value="sasm" className="text-xs px-2 py-0.5">SASM</TabsTrigger>
          </TabsList>

          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            onClick={() => {
              const textToCopy = {
                asm: scriptAsm,
                hex: scriptHex,
                chunked: chunkedHex,
                sasm: sasm
              }[activeTab] || ''
              handleCopy(textToCopy, activeTab.toUpperCase())
            }}
          >
            <Copy className="h-3 w-3 mr-1" />
            <span className="text-xs">Copy</span>
          </Button>
        </div>

        <div className="p-3">
          <TabsContent value="asm" className="mt-0">
            <ScrollArea className="h-48 w-full rounded-md border border-border">
              <div className="rounded bg-[#0d1117] p-3">
                <code className="whitespace-pre-wrap break-all">
                  {renderTokens(tokens)}
                </code>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="hex" className="mt-0">
            <ScrollArea className="h-48 w-full rounded-md border border-border">
              <div className="rounded bg-[#0d1117] p-3">
                <code className="font-mono text-xs text-green-400 whitespace-pre-wrap break-all">
                  {scriptHex}
                </code>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="chunked" className="mt-0">
            <ScrollArea className="h-48 w-full rounded-md border border-border">
              <div className="rounded bg-[#0d1117] p-3">
                <code className="font-mono text-xs text-green-400 whitespace-pre-wrap">
                  {chunkedHex}
                </code>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="sasm" className="mt-0">
            <ScrollArea className="h-48 w-full rounded-md border border-border">
              <div className="rounded bg-[#0d1117] p-3">
                <code className="font-mono text-xs text-purple-400 whitespace-pre-wrap break-all">
                  {sasm}
                </code>
              </div>
            </ScrollArea>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
