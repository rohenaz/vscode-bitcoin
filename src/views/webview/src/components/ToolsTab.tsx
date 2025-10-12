import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { MapPin, FileText, Database, Blocks, KeyRound } from 'lucide-react'
import KeysToolsTab from './KeysToolsTab'
import AddressesTab from './AddressesTab'
import TransactionsTab from './TransactionsTab'
import DataTab from './DataTab'
import BlockchainTab from './BlockchainTab'

interface ToolsTabProps {
  openSections: string[]
  onSectionsChange: (sections: string[]) => void
  keysState: string[]
  onKeysChange: (items: string[]) => void
  addressesState: string[]
  onAddressesChange: (items: string[]) => void
  transactionsState: string[]
  onTransactionsChange: (items: string[]) => void
  dataState: string[]
  onDataChange: (items: string[]) => void
  blockchainState: string[]
  onBlockchainChange: (items: string[]) => void
}

export default function ToolsTab({
  openSections,
  onSectionsChange,
  keysState,
  onKeysChange,
  addressesState,
  onAddressesChange,
  transactionsState,
  onTransactionsChange,
  dataState,
  onDataChange,
  blockchainState,
  onBlockchainChange
}: ToolsTabProps) {
  return (
    <Accordion
      type="multiple"
      className="w-full"
      value={openSections}
      onValueChange={onSectionsChange}
    >
      <AccordionItem value="keys">
        <AccordionTrigger className="text-xs">
          <div className="flex items-center gap-2">
            <KeyRound className="h-3 w-3" />
            Keys
          </div>
        </AccordionTrigger>
        <AccordionContent className="pl-4">
          <KeysToolsTab
            openItems={keysState}
            onOpenChange={onKeysChange}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="addresses">
        <AccordionTrigger className="text-xs">
          <div className="flex items-center gap-2">
            <MapPin className="h-3 w-3" />
            Addresses
          </div>
        </AccordionTrigger>
        <AccordionContent className="pl-4">
          <AddressesTab
            openItems={addressesState}
            onOpenChange={onAddressesChange}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="transactions">
        <AccordionTrigger className="text-xs">
          <div className="flex items-center gap-2">
            <FileText className="h-3 w-3" />
            Transactions
          </div>
        </AccordionTrigger>
        <AccordionContent className="pl-4">
          <TransactionsTab
            openItems={transactionsState}
            onOpenChange={onTransactionsChange}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="data">
        <AccordionTrigger className="text-xs">
          <div className="flex items-center gap-2">
            <Database className="h-3 w-3" />
            Data
          </div>
        </AccordionTrigger>
        <AccordionContent className="pl-4">
          <DataTab
            openItems={dataState}
            onOpenChange={onDataChange}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="blockchain">
        <AccordionTrigger className="text-xs">
          <div className="flex items-center gap-2">
            <Blocks className="h-3 w-3" />
            Blockchain
          </div>
        </AccordionTrigger>
        <AccordionContent className="pl-4">
          <BlockchainTab
            openItems={blockchainState}
            onOpenChange={onBlockchainChange}
          />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
