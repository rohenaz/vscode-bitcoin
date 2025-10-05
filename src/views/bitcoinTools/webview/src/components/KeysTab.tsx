import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { KeyRound, Unlock, Vault } from 'lucide-react'
import { getVscode } from '../vscode'
import { useState } from 'react'

export default function KeysTab() {
  const vscode = getVscode()
  const [openItems, setOpenItems] = useState<string[]>(['generate'])

  const execute = (command: string) => {
    vscode.postMessage({ command })
  }

  return (
    <Accordion type="multiple" className="w-full" value={openItems} onValueChange={setOpenItems}>
      <AccordionItem value="generate">
        <AccordionTrigger className="text-xs">
          <div className="flex items-center gap-2">
            <KeyRound className="h-3 w-3" />
            Generate
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="grid gap-1">
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.generatePrivateKey')}>
              Private Key
            </Button>
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.generatePublicKey')}>
              Public Key
            </Button>
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.generateWIF')}>
              WIF (Mainnet)
            </Button>
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.generateTestnetWIF')}>
              WIF (Testnet)
            </Button>
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.generateWIFVanity')}>
              WIF Vanity (Mainnet)
            </Button>
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.generateTestnetWIFVanity')}>
              WIF Vanity (Testnet)
            </Button>
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.generateHDPrivateKey')}>
              Extended Private Key
            </Button>
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.generateHDPublicKey')}>
              Extended Public Key
            </Button>
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.generateMnemonic')}>
              Mnemonic
            </Button>
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
          <div className="grid gap-1">
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.publicKeyFromPrivateKey')}>
              Public from Private
            </Button>
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.publicKeyFromWIF')}>
              Public from WIF
            </Button>
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.xPubFromxPriv')}>
              xPub from xPriv
            </Button>
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.extendedPrivateKeyFromMnemonic')}>
              xPriv from Mnemonic
            </Button>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="vault">
        <AccordionTrigger className="text-xs">
          <div className="flex items-center gap-2">
            <Vault className="h-3 w-3" />
            Vault
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="grid gap-1">
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.showKeyVault')}>
              Open Key Vault
            </Button>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
