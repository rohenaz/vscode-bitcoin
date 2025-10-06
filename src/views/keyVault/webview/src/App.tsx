import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { KeyCard } from './components/KeyCard'
import { AddKeyDialog } from './components/AddKeyDialog'
import { ReconstructSharesDialog } from './components/ReconstructSharesDialog'
import type { KeyEntry, KeyVaultPayload } from './types'
import { getVscode } from './vscode'
import './App.css'

// Declare global payload
declare global {
  interface Window {
    KEYVAULT_PAYLOAD?: KeyVaultPayload;
  }
}

function App() {
  const vscode = getVscode()
  const [keys, setKeys] = useState<KeyEntry[]>([])
  const [searchIndex, setSearchIndex] = useState<Record<string, string[]>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [addKeyDialogOpen, setAddKeyDialogOpen] = useState(false)
  const [sharesDialogOpen, setSharesDialogOpen] = useState(false)

  // Load initial payload
  useEffect(() => {
    if (window.KEYVAULT_PAYLOAD) {
      setKeys(window.KEYVAULT_PAYLOAD.keys || [])
      setSearchIndex(window.KEYVAULT_PAYLOAD.searchIndex || {})
    }

    // Remove initial loading spinner
    const loader = document.getElementById('initial-loader')
    if (loader) {
      loader.style.opacity = '0'
      loader.style.transition = 'opacity 0.3s'
      setTimeout(() => loader.remove(), 300)
    }

    // Apply dark mode
    document.documentElement.classList.add('dark')
  }, [])

  // Handle messages from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data

      // Handle vault refresh (keys changed)
      if (msg.command === 'refreshKeys' && msg.keys) {
        setKeys(msg.keys)
        if (msg.searchIndex) {
          setSearchIndex(msg.searchIndex)
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Filter keys based on search
  const filteredKeys = searchQuery.trim() === ''
    ? keys
    : keys.filter(key => {
        const tokens = searchIndex[key.id] || []
        const query = searchQuery.toLowerCase().trim()
        return tokens.some(t => t && t.includes(query))
      })

  const handleImportBackup = () => {
    vscode.postMessage({ command: 'importBackup' })
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Fixed Header */}
      <div className="flex-none p-4 pb-3 border-b border-border">
        <div className="flex flex-col gap-3">
          <Input
            type="text"
            placeholder="Search keys..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />

          <div className="flex gap-2">
            <Button
              onClick={() => setAddKeyDialogOpen(true)}
              variant="default"
              size="sm"
            >
              Add Key
            </Button>
            <Button
              onClick={handleImportBackup}
              variant="secondary"
              size="sm"
            >
              Import
            </Button>
            <Button
              onClick={() => setSharesDialogOpen(true)}
              variant="secondary"
              size="sm"
            >
              Combine Shares
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable Key List */}
      <ScrollArea className="flex-1">
        <div className="p-4 pt-3 space-y-3">
          {filteredKeys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No keys found matching your search' : 'No keys in vault'}
            </div>
          ) : (
            filteredKeys.map(key => (
              <KeyCard key={key.id} keyEntry={key} />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Dialogs */}
      <AddKeyDialog
        open={addKeyDialogOpen}
        onOpenChange={setAddKeyDialogOpen}
      />
      <ReconstructSharesDialog
        open={sharesDialogOpen}
        onOpenChange={setSharesDialogOpen}
      />
    </div>
  )
}

export default App
