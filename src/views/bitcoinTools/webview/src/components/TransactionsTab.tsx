import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Search, Wrench } from 'lucide-react'
import { getVscode } from '../vscode'
import { useState } from 'react'

export default function TransactionsTab() {
  const vscode = getVscode()
  const [openItems, setOpenItems] = useState<string[]>(['query'])

  const execute = (command: string) => {
    vscode.postMessage({ command })
  }

  return (
    <Accordion type="multiple" className="w-full" value={openItems} onValueChange={setOpenItems}>
      <AccordionItem value="query">
        <AccordionTrigger className="text-xs">
          <div className="flex items-center gap-2">
            <Search className="h-3 w-3" />
            Query
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="grid gap-1">
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.getTx')}>
              Fetch Transaction
            </Button>
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.getUtxosForAddress')}>
              Get UTXOs for Address
            </Button>
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.exploreAddress')}>
              Explore Address
            </Button>
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
          <div className="grid gap-1">
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.decodeRawTx')}>
              Decode Raw Transaction
            </Button>
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.rawTxToBob')}>
              Raw Tx to Bob Format
            </Button>
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.asmFromScript')}>
              ASM from Script
            </Button>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
