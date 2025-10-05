import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import WalletTab from './components/WalletTab'
import KeysTab from './components/KeysTab'
import AddressesTab from './components/AddressesTab'
import TransactionsTab from './components/TransactionsTab'
import DataTab from './components/DataTab'
import BlockchainTab from './components/BlockchainTab'
import './App.css'
import { useEffect, useState } from 'react'

function App() {
  const [activeTab, setActiveTab] = useState('wallet')

  // Accordion state for each tab - persisted across tab switches
  const [accordionState, setAccordionState] = useState({
    keys: ['generate'],
    addresses: ['from-keys'],
    transactions: ['query'],
    data: ['convert'],
    blockchain: ['lookup'],
  })

  const updateAccordionState = (tab: string, items: string[]) => {
    setAccordionState(prev => ({ ...prev, [tab]: items }))
  }

  useEffect(() => {
    document.documentElement.classList.add('dark')

    // Remove initial loading spinner
    const loader = document.getElementById('initial-loader')
    if (loader) {
      loader.style.opacity = '0'
      loader.style.transition = 'opacity 0.3s'
      setTimeout(() => loader.remove(), 300)
    }
  }, [])

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full gap-1">
      <TabsList className="w-full h-7">
        <TabsTrigger value="wallet" className="text-xs py-0.5">Wallet</TabsTrigger>
        <TabsTrigger value="keys" className="text-xs py-0.5">Keys</TabsTrigger>
        <TabsTrigger value="addresses" className="text-xs py-0.5">Addresses</TabsTrigger>
        <TabsTrigger value="transactions" className="text-xs py-0.5">Transactions</TabsTrigger>
        <TabsTrigger value="data" className="text-xs py-0.5">Data</TabsTrigger>
        <TabsTrigger value="blockchain" className="text-xs py-0.5">Blockchain</TabsTrigger>
      </TabsList>
      <TabsContent value="wallet" className="p-2">
        <WalletTab isActive={activeTab === 'wallet'} />
      </TabsContent>
      <TabsContent value="keys" className="p-2">
        <KeysTab
          openItems={accordionState.keys}
          onOpenChange={(items) => updateAccordionState('keys', items)}
        />
      </TabsContent>
      <TabsContent value="addresses" className="p-2">
        <AddressesTab
          openItems={accordionState.addresses}
          onOpenChange={(items) => updateAccordionState('addresses', items)}
        />
      </TabsContent>
      <TabsContent value="transactions" className="p-2">
        <TransactionsTab
          openItems={accordionState.transactions}
          onOpenChange={(items) => updateAccordionState('transactions', items)}
        />
      </TabsContent>
      <TabsContent value="data" className="p-2">
        <DataTab
          openItems={accordionState.data}
          onOpenChange={(items) => updateAccordionState('data', items)}
        />
      </TabsContent>
      <TabsContent value="blockchain" className="p-2">
        <BlockchainTab
          openItems={accordionState.blockchain}
          onOpenChange={(items) => updateAccordionState('blockchain', items)}
        />
      </TabsContent>
    </Tabs>
  )
}

export default App
