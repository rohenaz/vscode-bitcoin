import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { TxAvatar } from './TxAvatar'
import { MoreHorizontal, Copy, Bug, Edit, Trash2, Badge } from 'lucide-react'
import { getVscode } from '../vscode'
import { formatBytes } from '../utils/scriptParser'

export interface DecodeHistoryEntry {
  txid: string
  timestamp: number
  size: number
  inputCount: number
  outputCount: number
  network?: string
  label?: string
}

interface DecodeHistoryProps {
  history: DecodeHistoryEntry[]
  onDecode: (entry: DecodeHistoryEntry) => void
  onDebug: (entry: DecodeHistoryEntry) => void
}

export function DecodeHistory({ history, onDecode, onDebug }: DecodeHistoryProps) {
  const vscode = getVscode()
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<DecodeHistoryEntry | null>(null)
  const [newLabel, setNewLabel] = useState('')

  const handleCopy = (txid: string) => {
    vscode.postMessage({
      type: 'decodeHistory:getRawTx',
      data: { txid, action: 'copy' }
    })
  }

  const handleRename = (entry: DecodeHistoryEntry) => {
    setSelectedEntry(entry)
    setNewLabel(entry.label || '')
    setRenameDialogOpen(true)
  }

  const submitRename = () => {
    if (selectedEntry) {
      vscode.postMessage({
        type: 'transaction:setLabel',
        data: { txid: selectedEntry.txid, label: newLabel }
      })
      setRenameDialogOpen(false)
      setSelectedEntry(null)
      setNewLabel('')
    }
  }

  const handleDelete = (txid: string) => {
    vscode.postMessage({
      type: 'transaction:delete',
      data: { txid }
    })
  }

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString()
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-xs">
        <p>No history yet</p>
        <p className="mt-1">Decoded transactions will appear here</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {history.map((entry) => (
          <Item
            key={entry.txid}
            variant="outline"
            size="sm"
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => onDecode(entry)}
          >
            <ItemMedia>
              <TxAvatar txid={entry.txid} size={32} />
            </ItemMedia>
            <ItemContent>
              <ItemTitle className="flex space-between font-mono text-xs">
                <div className="w-full overflow-clip overflow-hidden text-ellipsis">{entry.label || `${entry.txid.slice(0, 16)}...${entry.txid.slice(-8)}`}</div>
                {entry.network === 'testnet' && (
                  <Badge className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-yellow-500/10 text-yellow-500">
                    testnet
                  </Badge>
                )}
              </ItemTitle>
              <ItemDescription className="text-[10px]">
                {formatBytes(entry.size)} • {entry.inputCount} in / {entry.outputCount} out • {formatTimestamp(entry.timestamp)}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-40" align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuItem onSelect={() => handleCopy(entry.txid)}>
                      <Copy className="h-3 w-3 mr-2" />
                      Copy Raw Tx
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onDebug(entry)}>
                      <Bug className="h-3 w-3 mr-2" />
                      Debug Script
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleRename(entry)}>
                      <Edit className="h-3 w-3 mr-2" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleDelete(entry.txid)} className="text-destructive focus:text-destructive">
                      <Trash2 className="h-3 w-3 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </ItemActions>
          </Item>
        ))}
      </div>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Rename Transaction</DialogTitle>
            <DialogDescription>
              Give this transaction a custom label to easily identify it later.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Enter a label..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    submitRename()
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={submitRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
