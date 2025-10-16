import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Item, ItemActions, ItemContent, ItemTitle, ItemDescription } from '@/components/ui/item'
import { Search, Eye, ArrowRightLeft, History } from 'lucide-react'
import { getVscode } from '../vscode'
import { DecodeTransaction } from './DecodeTransaction'
import { DecodeHistory, type DecodeHistoryEntry } from './DecodeHistory'

interface TransactionsTabProps {
  openItems: string[]
  onOpenChange: (items: string[]) => void
}

export default function TransactionsTab({ openItems, onOpenChange }: TransactionsTabProps) {
  const vscode = getVscode()
  const [rawTxHex, setRawTxHex] = useState('')
  const [history, setHistory] = useState<DecodeHistoryEntry[]>([])

  const execute = (command: string) => {
    vscode.postMessage({ command })
  }

  // Load history on mount
  useEffect(() => {
    vscode.postMessage({ type: 'decodeHistory:get' })

    const handleMessage = (event: MessageEvent) => {
      const { type, data } = event.data
      if (type === 'decodeHistory:data') {
        setHistory(data)
      } else if (type === 'decodeHistory:rawTx') {
        // Received raw tx from cache - populate and open decode
        if (data.rawTx) {
          setRawTxHex(data.rawTx)
          if (!openItems.includes('decode')) {
            onOpenChange([...openItems, 'decode'])
          }
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [openItems, onOpenChange])

  const handleDecodeFromHistory = (entry: DecodeHistoryEntry) => {
    // Open transaction decoder with txid - uses unified routing approach
    const network = entry.network || 'main'
    vscode.postMessage({
      command: 'bitcoin.openTransactionDecoder',
      args: [{ txid: entry.txid, network }]
    })
  }

  const handleDebugFromHistory = (entry: DecodeHistoryEntry) => {
    // Open script debugger with txid and network - it will fetch the tx and prompt for input selection
    const network = entry.network || 'main'
    vscode.postMessage({
      command: 'bitcoin.openScriptDebugger',
      args: [{ txid: entry.txid, network }]
    })
  }

  return (
    <Accordion type="multiple" className="w-full" value={openItems} onValueChange={onOpenChange}>
      <AccordionItem value="query">
        <AccordionTrigger className="text-xs">
          <div className="flex items-center gap-2">
            <Search className="h-3 w-3" />
            Query
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2">
            <Item size="sm">
              <ItemContent>
                <ItemTitle>Fetch Transaction</ItemTitle>
                <ItemDescription>Get transaction details by txid</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.getTx')}>
                  Fetch
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>Get UTXOs for Address</ItemTitle>
                <ItemDescription>Retrieve unspent outputs for address</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.getUtxosForAddress')}>
                  Get
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>Explore Address</ItemTitle>
                <ItemDescription>View address in blockchain explorer</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.exploreAddress')}>
                  Explore
                </Button>
              </ItemActions>
            </Item>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="history">
        <AccordionTrigger className="text-xs">
          <div className="flex items-center gap-2">
            <History className="h-3 w-3" />
            History
            {history.length > 0 && (
              <span className="ml-auto text-muted-foreground">({history.length})</span>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <DecodeHistory
            history={history}
            onDecode={handleDecodeFromHistory}
            onDebug={handleDebugFromHistory}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="decode">
        <AccordionTrigger className="text-xs">
          <div className="flex items-center gap-2">
            <Eye className="h-3 w-3" />
            Decode & Inspect
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <DecodeTransaction
            rawTxHex={rawTxHex}
            onRawTxHexChange={setRawTxHex}
            openInWindow
          />
          <div className="mt-4 space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Script Execution</div>
            <div className="space-y-2">
              <Item size="sm">
                <ItemContent>
                  <ItemTitle>Visualize Scripts</ItemTitle>
                  <ItemDescription>Step through script execution</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button variant="outline" size="sm" onClick={() => execute('bitcoin.openScriptDebugger')}>
                    Open
                  </Button>
                </ItemActions>
              </Item>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="convert">
        <AccordionTrigger className="text-xs">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-3 w-3" />
            Convert
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2">
            <Item size="sm">
              <ItemContent>
                <ItemTitle>Decode Raw Transaction</ItemTitle>
                <ItemDescription>Parse and display transaction hex</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.decodeRawTx')}>
                  Decode
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>Raw Tx to Bob Format</ItemTitle>
                <ItemDescription>Convert transaction to BOB JSON</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.rawTxToBob')}>
                  Convert
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>ASM from Script</ItemTitle>
                <ItemDescription>Decode script to assembly format</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.asmFromScript')}>
                  Decode
                </Button>
              </ItemActions>
            </Item>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* TODO: Implement ExecuteScript component */}
      {/* <AccordionItem value="execute">
        <AccordionTrigger className="text-xs">
          <div className="flex items-center gap-2">
            <Play className="h-3 w-3" />
            Execute Script
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <ExecuteScript />
        </AccordionContent>
      </AccordionItem> */}
    </Accordion>
  )
}
