import { Button } from '@/components/ui/button'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { TxAvatar } from './TxAvatar'
import { Eye, Copy } from 'lucide-react'
import { getVscode } from '../vscode'
import { formatBytes, truncateTxid } from '../utils/scriptParser'

export interface DecodeHistoryEntry {
  txid: string
  rawTx: string
  timestamp: number
  size: number
  inputCount: number
  outputCount: number
}

interface DecodeHistoryProps {
  history: DecodeHistoryEntry[]
  onDecode: (entry: DecodeHistoryEntry) => void
}

export function DecodeHistory({ history, onDecode }: DecodeHistoryProps) {
  const vscode = getVscode()

  const handleCopy = (rawTx: string, txid: string) => {
    vscode.postMessage({ type: 'copy', value: rawTx })
    vscode.postMessage({
      type: 'showInfo',
      data: { message: `Raw transaction copied for ${truncateTxid(txid)}` }
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
        <p>No decode history yet</p>
        <p className="mt-1">Decoded transactions will appear here</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {history.map((entry) => (
        <Item key={entry.txid} variant="outline" size="sm">
          <ItemMedia>
            <TxAvatar txid={entry.txid} size={32} />
          </ItemMedia>
          <ItemContent>
            <ItemTitle className="font-mono text-xs">
              {truncateTxid(entry.txid)}
            </ItemTitle>
            <ItemDescription className="text-[10px]">
              {formatBytes(entry.size)} • {entry.inputCount} in / {entry.outputCount} out • {formatTimestamp(entry.timestamp)}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => handleCopy(entry.rawTx, entry.txid)}
              title="Copy raw transaction"
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() => onDecode(entry)}
              title="Decode transaction"
            >
              <Eye className="h-3 w-3 mr-1" />
              Decode
            </Button>
          </ItemActions>
        </Item>
      ))}
    </div>
  )
}
