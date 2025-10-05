import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Item, ItemActions, ItemContent, ItemTitle, ItemDescription } from '@/components/ui/item'
import { MapPin, FlaskConical } from 'lucide-react'
import { getVscode } from '../vscode'

interface AddressesTabProps {
  openItems: string[]
  onOpenChange: (items: string[]) => void
}

export default function AddressesTab({ openItems, onOpenChange }: AddressesTabProps) {
  const vscode = getVscode()

  const execute = (command: string) => {
    vscode.postMessage({ command })
  }

  return (
    <Accordion type="multiple" className="w-full" value={openItems} onValueChange={onOpenChange}>
      <AccordionItem value="from-keys">
        <AccordionTrigger className="text-xs">
          <div className="flex items-center gap-2">
            <MapPin className="h-3 w-3" />
            From Keys
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2">
            <Item size="sm">
              <ItemContent>
                <ItemTitle>From WIF</ItemTitle>
                <ItemDescription>Derive address from WIF private key</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.addressFromWIF')}>
                  Derive
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>From Private Key</ItemTitle>
                <ItemDescription>Derive address from private key hex</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.addressFromPrivateKey')}>
                  Derive
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>From Public Key</ItemTitle>
                <ItemDescription>Derive address from public key</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.addressFromPublicKey')}>
                  Derive
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>From Extended Private Key</ItemTitle>
                <ItemDescription>Derive address from HD xPriv</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.addressFromHDPrivateKey')}>
                  Derive
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>From Extended Public Key</ItemTitle>
                <ItemDescription>Derive address from HD xPub</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.addressFromHDPublicKey')}>
                  Derive
                </Button>
              </ItemActions>
            </Item>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="testnet">
        <AccordionTrigger className="text-xs">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-3 w-3" />
            Testnet
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2">
            <Item size="sm">
              <ItemContent>
                <ItemTitle>From Private Key</ItemTitle>
                <ItemDescription>Derive testnet address from private key</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.addressFromPrivateKeyTestnet')}>
                  Derive
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>From Public Key</ItemTitle>
                <ItemDescription>Derive testnet address from public key</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.addressFromPublicKeyTestnet')}>
                  Derive
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>From Extended Private Key</ItemTitle>
                <ItemDescription>Derive testnet address from HD xPriv</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.addressFromHDPrivateKeyTestnet')}>
                  Derive
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>From Extended Public Key</ItemTitle>
                <ItemDescription>Derive testnet address from HD xPub</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.addressFromHDPublicKeyTestnet')}>
                  Derive
                </Button>
              </ItemActions>
            </Item>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
