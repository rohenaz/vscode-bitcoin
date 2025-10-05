import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Lock, RefreshCw } from 'lucide-react'
import DataConversion from './DataConversion'
import { getVscode } from '../vscode'
import { useState } from 'react'

export default function DataTab() {
  const vscode = getVscode()
  const [openItems, setOpenItems] = useState<string[]>(['convert'])

  const execute = (command: string) => {
    vscode.postMessage({ command })
  }

  return (
    <Accordion type="multiple" className="w-full" value={openItems} onValueChange={setOpenItems}>
      <AccordionItem value="convert">
        <AccordionTrigger className="text-xs">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-3 w-3" />
            Convert
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <DataConversion />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="encrypt">
        <AccordionTrigger className="text-xs">
          <div className="flex items-center gap-2">
            <Lock className="h-3 w-3" />
            Encrypt
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="grid gap-1">
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.encrypt')}>
              Encrypt Data
            </Button>
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.decrypt')}>
              Decrypt Data
            </Button>
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.decodeFile')}>
              Decode File
            </Button>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
