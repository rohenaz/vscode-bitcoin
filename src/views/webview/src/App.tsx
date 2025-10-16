import './App.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { AppRoutes, getInitialRouterEntry } from './router'

// Declare global panel type and initial data
declare global {
  interface Window {
    PANEL_TYPE?: 'key-vault' | 'bitcoin-tools' | 'transaction-decoder' | 'transaction-parser' | 'script-executor';
    INITIAL_DATA?: {
      txid?: string;
      inputIndex?: number;
      rawTxHex?: string;
      [key: string]: any;
    };
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
  // Get the initial route based on panel type and initial data
  const initialEntry = getInitialRouterEntry()

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

export default App
