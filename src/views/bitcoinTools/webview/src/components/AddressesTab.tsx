import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Item, ItemActions, ItemContent, ItemTitle, ItemDescription } from '@/components/ui/item'
import { KeyRound, FlaskConical } from 'lucide-react'
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
            <KeyRound className="h-3 w-3" />
            From Keys
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2">
            <Item size="sm">
              <ItemContent>
                <ItemTitle className="text-xs">WIF → Address</ItemTitle>
                <ItemDescription className="text-xs">Generate P2PKH address from WIF</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="xs" onClick={() => execute('bitcoin.addressFromWIF')}>
                  Derive
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle className="text-xs">Private Key → Address</ItemTitle>
                <ItemDescription className="text-xs">Generate P2PKH address from private key hex</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="xs" onClick={() => execute('bitcoin.addressFromPrivateKey')}>
                  Derive
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle className="text-xs">Public Key → Address</ItemTitle>
                <ItemDescription className="text-xs">Generate P2PKH address from public key</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="xs" onClick={() => execute('bitcoin.addressFromPublicKey')}>
                  Derive
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle className="text-xs">xPriv → Address</ItemTitle>
                <ItemDescription className="text-xs">Generate address from HD extended private key</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="xs" onClick={() => execute('bitcoin.addressFromHDPrivateKey')}>
                  Derive
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle className="text-xs">xPub → Address</ItemTitle>
                <ItemDescription className="text-xs">Generate address from HD extended public key</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="xs" onClick={() => execute('bitcoin.addressFromHDPublicKey')}>
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
                <ItemTitle className="text-xs">Private Key → Testnet Address</ItemTitle>
                <ItemDescription className="text-xs">Generate testnet P2PKH address from private key</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="xs" onClick={() => execute('bitcoin.addressFromPrivateKeyTestnet')}>
                  Derive
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle className="text-xs">Public Key → Testnet Address</ItemTitle>
                <ItemDescription className="text-xs">Generate testnet P2PKH address from public key</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="xs" onClick={() => execute('bitcoin.addressFromPublicKeyTestnet')}>
                  Derive
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle className="text-xs">xPriv → Testnet Address</ItemTitle>
                <ItemDescription className="text-xs">Generate testnet address from HD extended private key</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="xs" onClick={() => execute('bitcoin.addressFromHDPrivateKeyTestnet')}>
                  Derive
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle className="text-xs">xPub → Testnet Address</ItemTitle>
                <ItemDescription className="text-xs">Generate testnet address from HD extended public key</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="xs" onClick={() => execute('bitcoin.addressFromHDPublicKeyTestnet')}>
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
