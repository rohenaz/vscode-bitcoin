import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Item, ItemActions, ItemContent, ItemTitle, ItemDescription } from '@/components/ui/item'
import { Search } from 'lucide-react'
import { getVscode } from '../vscode'

interface BlockchainTabProps {
  openItems: string[]
  onOpenChange: (items: string[]) => void
}

export default function BlockchainTab({ openItems, onOpenChange }: BlockchainTabProps) {
  const vscode = getVscode()

  const execute = (command: string) => {
    vscode.postMessage({ command })
  }

  return (
    <Accordion type="multiple" className="w-full" value={openItems} onValueChange={onOpenChange}>
      <AccordionItem value="lookup">
        <AccordionTrigger className="text-xs">
          <div className="flex items-center gap-2">
            <Search className="h-3 w-3" />
            Lookup
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2">
            <Item size="sm">
              <ItemContent>
                <ItemTitle>Lookup BAP Profile</ItemTitle>
                <ItemDescription>Query Bitcoin Attestation Protocol identity</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.lookupBapProfile')}>
                  Lookup
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>Fetch Ordinals Inscription</ItemTitle>
                <ItemDescription>Retrieve inscription data from origin</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.fetchOrdinalsInscription')}>
                  Fetch
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>Explore Address</ItemTitle>
                <ItemDescription>View address details in blockchain explorer</ItemDescription>
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
    </Accordion>
  )
}
