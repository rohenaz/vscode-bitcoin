import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getVscode } from '../vscode'

interface VaultState {
  isLocked: boolean
  totalKeys: number
  hasEncryptionKey: boolean
  hasFundingKey: boolean
  hasOrdinalsKey: boolean
  hasIdentityKey: boolean
  fundingKeyAddress?: string
  lastUpdate: number
}

interface VaultContextType {
  vaultState: VaultState
  refreshVault: () => void
}

const VaultContext = createContext<VaultContextType | undefined>(undefined)

export function VaultProvider({ children }: { children: ReactNode }) {
  const vscode = getVscode()
  const [vaultState, setVaultState] = useState<VaultState>({
    isLocked: true,
    totalKeys: 0,
    hasEncryptionKey: false,
    hasFundingKey: false,
    hasOrdinalsKey: false,
    hasIdentityKey: false,
    lastUpdate: 0
  })

  const refreshVault = () => {
    vscode.postMessage({ type: 'vault:getStats' })
  }

  useEffect(() => {
    // Initial request
    refreshVault()

    const handleMessage = (event: MessageEvent) => {
      const { type, data } = event.data

      if (type === 'vault:stats') {
        setVaultState(prev => ({
          ...prev,
          ...data,
          lastUpdate: Date.now()
        }))
      }

      // Refresh on vault-related events
      if (type === 'vault:unlocked' || type === 'vault:locked' || type === 'vault:keyAdded' || type === 'vault:keyRemoved') {
        refreshVault()
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  return (
    <VaultContext.Provider value={{ vaultState, refreshVault }}>
      {children}
    </VaultContext.Provider>
  )
}

export function useVault() {
  const context = useContext(VaultContext)
  if (!context) {
    throw new Error('useVault must be used within VaultProvider')
  }
  return context
}
