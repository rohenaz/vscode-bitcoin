import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Item, ItemActions, ItemContent, ItemTitle, ItemDescription } from '@/components/ui/item'
import { Search, Wrench } from 'lucide-react'
import { getVscode } from '../vscode'

interface TransactionsTabProps {
  openItems: string[]
  onOpenChange: (items: string[]) => void
}

export default function TransactionsTab({ openItems, onOpenChange }: TransactionsTabProps) {
  const vscode = getVscode()

  const execute = (command: string) => {
    vscode.postMessage({ command })
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

      <AccordionItem value="tools">
        <AccordionTrigger className="text-xs">
          <div className="flex items-center gap-2">
            <Wrench className="h-3 w-3" />
            Tools
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
    </Accordion>
  )
}
