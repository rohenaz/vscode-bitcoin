import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Input } from '@/components/ui/input'
import { KeyCard} from '../components/KeyCard'
import { DesignatedKeysPanel } from '../components/DesignatedKeysPanel'
import { AddKeyDialog } from '../components/AddKeyDialog'
import type { KeyEntry, KeyVaultPayload } from '../types'
import { getVscode } from '../vscode'
import { ArrowDownWideNarrow, ArrowUpWideNarrow } from 'lucide-react'
import '../App.css'

// Declare global payload
declare global {
  interface Window {
    KEYVAULT_PAYLOAD?: KeyVaultPayload;
  }
}

export function KeyVaultPanel() {
  const vscode = getVscode()
  const [keys, setKeys] = useState<KeyEntry[]>([])
  const [searchIndex, setSearchIndex] = useState<Record<string, string[]>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [addKeyDialogOpen, setAddKeyDialogOpen] = useState(false)
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc') // newest first by default

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

      // Handle request to open Add Key dialog
      if (msg.command === 'openAddKeyDialog') {
        setAddKeyDialogOpen(true)
      }

      // Handle request to trigger import
      if (msg.command === 'triggerImport') {
        vscode.postMessage({ command: 'importBackup' })
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Build parent-child hierarchy
  const buildKeyHierarchy = (allKeys: KeyEntry[]): Array<KeyEntry & { children: KeyEntry[] }> => {
    const map: Record<string, KeyEntry & { children: KeyEntry[] }> = {}
    for (const k of allKeys) {
      map[k.id] = { ...k, children: [] }
    }

    const roots: Array<KeyEntry & { children: KeyEntry[] }> = []
    for (const k of allKeys) {
      const parentId = k.metadata?.parentId
      if (parentId && map[parentId]) {
        map[parentId].children.push(map[k.id])
      } else {
        roots.push(map[k.id])
      }
    }

    return roots
  }

  // Filter and sort keys by timestamp
  const filteredAndSorted = (searchQuery.trim() === ''
    ? keys
    : keys.filter(key => {
        const tokens = searchIndex[key.id] || []
        const query = searchQuery.toLowerCase().trim()
        return tokens.some(t => t && t.includes(query))
      })
  ).sort((a, b) => sortOrder === 'desc' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp)

  // Build hierarchy from filtered/sorted keys
  const filteredKeys = buildKeyHierarchy(filteredAndSorted)

  const handleImportBackup = () => {
    vscode.postMessage({ command: 'importBackup' })
  }

  const handleScrollToKey = (keyId: string) => {
    const element = document.getElementById(`key-${keyId}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Briefly highlight the key
      element.style.transition = 'background-color 0.3s'
      element.style.backgroundColor = 'var(--accent)'
      setTimeout(() => {
        element.style.backgroundColor = ''
      }, 1000)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border p-2">
        <div className="flex items-center gap-2">
          <Input
            type="text"
            placeholder="Search keys..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 h-8 text-sm"
          />
          <Button
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            variant="outline"
            size="sm"
            title={sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}
          >
            {sortOrder === 'desc' ? <ArrowDownWideNarrow className="h-4 w-4" /> : <ArrowUpWideNarrow className="h-4 w-4" />}
          </Button>
          <ButtonGroup>
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
          </ButtonGroup>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto">
        {/* Designated Keys Dashboard */}
        <div className="p-2 border-b border-border">
          <DesignatedKeysPanel keys={keys} onScrollToKey={handleScrollToKey} />
        </div>

        {/* Key List */}
        <div className="p-2 space-y-2">
          {filteredKeys.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              {searchQuery ? 'No keys found matching your search' : 'No keys in vault'}
            </div>
          ) : (
            filteredKeys.map(key => (
              <KeyCard key={key.id} keyEntry={key} />
            ))
          )}
        </div>
      </div>

      {/* Dialogs */}
      <AddKeyDialog
        open={addKeyDialogOpen}
        onOpenChange={setAddKeyDialogOpen}
      />
    </div>
  )
}

// Removed default export - using named export KeyVaultPanel
