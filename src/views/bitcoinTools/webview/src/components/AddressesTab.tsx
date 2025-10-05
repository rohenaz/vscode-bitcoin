import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { MapPin, FlaskConical } from 'lucide-react'
import { getVscode } from '../vscode'
import { useState } from 'react'

export default function AddressesTab() {
  const vscode = getVscode()
  const [openItems, setOpenItems] = useState<string[]>(['from-keys'])

  const execute = (command: string) => {
    vscode.postMessage({ command })
  }

  return (
    <Accordion type="multiple" className="w-full" value={openItems} onValueChange={setOpenItems}>
      <AccordionItem value="from-keys">
        <AccordionTrigger className="text-xs">
          <div className="flex items-center gap-2">
            <MapPin className="h-3 w-3" />
            From Keys
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="grid gap-1">
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.addressFromWIF')}>
              From WIF
            </Button>
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.addressFromPrivateKey')}>
              From Private Key
            </Button>
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.addressFromPublicKey')}>
              From Public Key
            </Button>
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.addressFromHDPrivateKey')}>
              From Extended Private Key
            </Button>
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.addressFromHDPublicKey')}>
              From Extended Public Key
            </Button>
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
          <div className="grid gap-1">
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.addressFromPrivateKeyTestnet')}>
              From Private Key
            </Button>
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.addressFromPublicKeyTestnet')}>
              From Public Key
            </Button>
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.addressFromHDPrivateKeyTestnet')}>
              From Extended Private Key
            </Button>
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => execute('bitcoin.addressFromHDPublicKeyTestnet')}>
              From Extended Public Key
            </Button>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
