import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Item, ItemActions, ItemContent, ItemTitle, ItemDescription } from '@/components/ui/item'
import { Plus, Unlock } from 'lucide-react'
import { getVscode } from '../vscode'

interface KeysToolsTabProps {
  openItems: string[]
  onOpenChange: (items: string[]) => void
}

export default function KeysToolsTab({ openItems, onOpenChange }: KeysToolsTabProps) {
  const vscode = getVscode()

  const execute = (command: string) => {
    vscode.postMessage({ command })
  }

  return (
    <Accordion type="multiple" className="w-full" value={openItems} onValueChange={onOpenChange}>
      <AccordionItem value="generate">
        <AccordionTrigger className="text-xs">
          <div className="flex items-center gap-2">
            <Plus className="h-3 w-3" />
            Generate
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2">
            <Item size="sm">
              <ItemContent>
                <ItemTitle>Private Key</ItemTitle>
                <ItemDescription>Generate a new private key</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.generatePrivateKey')}>
                  Generate
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>Public Key</ItemTitle>
                <ItemDescription>Generate a new public key</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.generatePublicKey')}>
                  Generate
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>WIF (Mainnet)</ItemTitle>
                <ItemDescription>Generate mainnet WIF key</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.generateWIF')}>
                  Generate
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>WIF (Testnet)</ItemTitle>
                <ItemDescription>Generate testnet WIF key</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.generateTestnetWIF')}>
                  Generate
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>WIF Vanity (Mainnet)</ItemTitle>
                <ItemDescription>Generate vanity mainnet WIF</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.generateWIFVanity')}>
                  Generate
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>WIF Vanity (Testnet)</ItemTitle>
                <ItemDescription>Generate vanity testnet WIF</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.generateTestnetWIFVanity')}>
                  Generate
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>Extended Private Key</ItemTitle>
                <ItemDescription>Generate HD extended private key</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.generateHDPrivateKey')}>
                  Generate
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>Extended Public Key</ItemTitle>
                <ItemDescription>Generate HD extended public key</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.generateHDPublicKey')}>
                  Generate
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>Mnemonic</ItemTitle>
                <ItemDescription>Generate BIP39 mnemonic phrase</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.generateMnemonic')}>
                  Generate
                </Button>
              </ItemActions>
            </Item>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="derive">
        <AccordionTrigger className="text-xs">
          <div className="flex items-center gap-2">
            <Unlock className="h-3 w-3" />
            Derive
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2">
            <Item size="sm">
              <ItemContent>
                <ItemTitle>Public from Private</ItemTitle>
                <ItemDescription>Derive public key from private key</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.publicKeyFromPrivateKey')}>
                  Derive
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>Public from WIF</ItemTitle>
                <ItemDescription>Derive public key from WIF</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.publicKeyFromWIF')}>
                  Derive
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>xPub from xPriv</ItemTitle>
                <ItemDescription>Derive extended public from extended private</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.xPubFromxPriv')}>
                  Derive
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>xPriv from Mnemonic</ItemTitle>
                <ItemDescription>Derive extended private key from mnemonic</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.extendedPrivateKeyFromMnemonic')}>
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
