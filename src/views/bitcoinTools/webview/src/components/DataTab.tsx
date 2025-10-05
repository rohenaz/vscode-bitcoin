import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Item, ItemActions, ItemContent, ItemTitle, ItemDescription } from '@/components/ui/item'
import { Lock, RefreshCw } from 'lucide-react'
import DataConversion from './DataConversion'
import { getVscode } from '../vscode'

interface DataTabProps {
  openItems: string[]
  onOpenChange: (items: string[]) => void
}

export default function DataTab({ openItems, onOpenChange }: DataTabProps) {
  const vscode = getVscode()

  const execute = (command: string) => {
    vscode.postMessage({ command })
  }

  return (
    <Accordion type="multiple" className="w-full" value={openItems} onValueChange={onOpenChange}>
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
          <div className="space-y-2">
            <Item size="sm">
              <ItemContent>
                <ItemTitle>Encrypt Data</ItemTitle>
                <ItemDescription>Encrypt data with ECIES encryption</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.encrypt')}>
                  Encrypt
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>Decrypt Data</ItemTitle>
                <ItemDescription>Decrypt ECIES encrypted data</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.decrypt')}>
                  Decrypt
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>Decode File</ItemTitle>
                <ItemDescription>Decode and display file contents</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.decodeFile')}>
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
