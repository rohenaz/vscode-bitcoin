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
      <AccordionItem value="mainnet">
        <AccordionTrigger className="text-xs">
          <div className="flex items-center gap-2">
            <Plus className="h-3 w-3" />
            Mainnet
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2">
            <Item size="sm">
              <ItemContent>
                <ItemTitle>Private Key</ItemTitle>
                <ItemDescription>Generate in different formats</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.generateWIF')}>
                  WIF
                </Button>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.generatePrivateKey')}>
                  Hex
                </Button>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.generateHDPrivateKey')}>
                  xPrv
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>Public Key</ItemTitle>
                <ItemDescription>Generate in different formats</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.generatePublicKey')}>
                  Hex
                </Button>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.generateHDPublicKey')}>
                  xPub
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
            <Item size="sm">
              <ItemContent>
                <ItemTitle>Vanity WIF</ItemTitle>
                <ItemDescription>Generate vanity address</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.generateWIFVanity')}>
                  Generate
                </Button>
              </ItemActions>
            </Item>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="testnet">
        <AccordionTrigger className="text-xs">
          <div className="flex items-center gap-2">
            <Plus className="h-3 w-3" />
            Testnet
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2">
            <Item size="sm">
              <ItemContent>
                <ItemTitle>Private Key (WIF)</ItemTitle>
                <ItemDescription>Generate testnet WIF</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.generateTestnetWIF')}>
                  Generate
                </Button>
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>Vanity WIF</ItemTitle>
                <ItemDescription>Generate vanity testnet address</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm" onClick={() => execute('bitcoin.generateTestnetWIFVanity')}>
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
