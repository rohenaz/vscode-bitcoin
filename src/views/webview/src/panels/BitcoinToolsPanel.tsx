import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import WalletTab from '../components/WalletTab'
import KeysTab from '../components/KeysTab'
import ToolsTab from '../components/ToolsTab'
import HelpTab from '../components/HelpTab'
import { IdentityTab } from '../components/IdentityTab'
import { VaultProvider } from '../contexts/VaultContext'
import '../App.css'
import { useEffect, useState } from 'react'

export function BitcoinToolsPanel() {
  const [activeTab, setActiveTab] = useState('keys')

  // Accordion state for each tab - persisted across tab switches
  const [accordionState, setAccordionState] = useState({
    tools: {
      sections: ['keys'],
      keys: ['generate'],
      addresses: ['from-keys'],
      transactions: ['decode'],
      data: ['convert'],
      blockchain: ['lookup'],
    }
  })

  const updateToolsSection = (sections: string[]) => {
    setAccordionState(prev => ({
      ...prev,
      tools: { ...prev.tools, sections }
    }))
  }

  const updateToolsAccordion = (section: string, items: string[]) => {
    setAccordionState(prev => ({
      ...prev,
      tools: { ...prev.tools, [section]: items }
    }))
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

  // Listen for tab switching commands from backend
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { command, tab } = event.data

      if (command === 'switchToTab' && tab) {
        setActiveTab(tab)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  return (
    <VaultProvider>
      <div className="w-full">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full gap-1">
        <TabsList className="w-full h-7">
        <TabsTrigger value="keys" className="text-xs py-0.5">Keys</TabsTrigger>
        <TabsTrigger value="wallet" className="text-xs py-0.5">Wallet</TabsTrigger>
        <TabsTrigger value="identity" className="text-xs py-0.5">Identity</TabsTrigger>
        <TabsTrigger value="tools" className="text-xs py-0.5">Tools</TabsTrigger>
        <TabsTrigger value="help" className="text-xs py-0.5">Help</TabsTrigger>
      </TabsList>
      <TabsContent value="keys" className="p-2">
        <KeysTab />
      </TabsContent>
      <TabsContent value="wallet" className="p-2">
        <WalletTab isActive={activeTab === 'wallet'} />
      </TabsContent>
      <TabsContent value="identity" className="p-2">
        <IdentityTab />
      </TabsContent>
      <TabsContent value="tools" className="p-2">
        <ToolsTab
          openSections={accordionState.tools.sections}
          onSectionsChange={updateToolsSection}
          keysState={accordionState.tools.keys}
          onKeysChange={(items) => updateToolsAccordion('keys', items)}
          addressesState={accordionState.tools.addresses}
          onAddressesChange={(items) => updateToolsAccordion('addresses', items)}
          transactionsState={accordionState.tools.transactions}
          onTransactionsChange={(items) => updateToolsAccordion('transactions', items)}
          dataState={accordionState.tools.data}
          onDataChange={(items) => updateToolsAccordion('data', items)}
          blockchainState={accordionState.tools.blockchain}
          onBlockchainChange={(items) => updateToolsAccordion('blockchain', items)}
        />
      </TabsContent>
      <TabsContent value="help" className="p-2">
        <HelpTab />
      </TabsContent>
    </Tabs>
      </div>
    </VaultProvider>
  )
}

// Removed default export - using named export BitcoinToolsPanel
