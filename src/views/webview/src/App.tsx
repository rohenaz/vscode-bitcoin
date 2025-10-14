import './App.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { KeyVaultPanel } from './panels/KeyVaultPanel'
import { BitcoinToolsPanel } from './panels/BitcoinToolsPanel'
import { TransactionDecoderPanel } from './panels/TransactionDecoderPanel'
import { ScriptDebuggerPanel } from './panels/ScriptDebuggerPanel'

// Declare global panel type
declare global {
  interface Window {
    PANEL_TYPE?: 'key-vault' | 'bitcoin-tools' | 'transaction-decoder' | 'script-executor';
  }
}

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  // Determine which panel to show based on context
  const panelType = window.PANEL_TYPE || 'bitcoin-tools'

  // Route to the appropriate panel
  const panel = (() => {
    switch (panelType) {
      case 'key-vault':
        return <KeyVaultPanel />
      case 'bitcoin-tools':
        return <BitcoinToolsPanel />
      case 'transaction-decoder':
        return <TransactionDecoderPanel />
      case 'script-executor':
        return <ScriptDebuggerPanel />
      default:
        return <BitcoinToolsPanel />
    }
  })()

  return (
    <QueryClientProvider client={queryClient}>
      {panel}
    </QueryClientProvider>
  )
}

export default App
