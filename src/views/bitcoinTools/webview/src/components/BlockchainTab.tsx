import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { User, Image, ExternalLink, Search } from 'lucide-react'
import { getVscode } from '../vscode'
import { useState } from 'react'

export default function BlockchainTab() {
  const vscode = getVscode()
  const [openItems, setOpenItems] = useState<string[]>(['lookup'])

  const execute = (command: string) => {
    vscode.postMessage({ command })
  }

  return (
    <Accordion type="multiple" className="w-full" value={openItems} onValueChange={setOpenItems}>
      <AccordionItem value="lookup">
        <AccordionTrigger className="text-xs">
          <div className="flex items-center gap-2">
            <Search className="h-3 w-3" />
            Lookup
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="grid gap-1">
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.lookupBapProfile')}>
              <User className="h-3 w-3 mr-2" />
              Lookup BAP Profile
            </Button>
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.fetchOrdinalsInscription')}>
              <Image className="h-3 w-3 mr-2" />
              Fetch Ordinals Inscription
            </Button>
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.exploreAddress')}>
              <ExternalLink className="h-3 w-3 mr-2" />
              Explore Address
            </Button>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
