import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { Copy } from 'lucide-react'
import type { KeyEntry } from '../types'
import { getVscode } from '../vscode'
import { PrivateKey } from '@bsv/sdk'
import { BAP, MemberID } from 'bsv-bap'

interface DesignatedKeysPanelProps {
  keys: KeyEntry[]
  onScrollToKey?: (keyId: string) => void
}

export function DesignatedKeysPanel({ keys, onScrollToKey }: DesignatedKeysPanelProps) {
  const vscode = getVscode()
  const encryptionKey = keys.find(k => k.isEncryptionKey)
  const walletKey = keys.find(k => k.isFundingKey)
  const ordinalsKey = keys.find(k => k.isOrdinalsKey)
  const identityKey = keys.find(k => k.isIdentityKey)

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const handleClear = (command: string, keyId: string) => {
    vscode.postMessage({ command, id: keyId })
  }

  const deriveAddress = (key: KeyEntry): string | null => {
    if (key.type === 'wif') {
      try {
        const pk = PrivateKey.fromWif(key.value)
        const isTestnet = key.metadata?.network === 'testnet'
        return pk.toAddress(isTestnet ? 'testnet' : 'mainnet')
      } catch (e) {
        return null
      }
    }
    return null
  }

  const getBapId = (key: KeyEntry): string | null => {
    try {
      // Check for BAP master key (has multiple bapIds)
      if (key.metadata?.bapIds) {
        try {
          // Initialize BAP based on key type
          let bap: BAP
          if (key.type === 'hdprivate') {
            // Legacy BIP32 mode - use xprv string
            bap = new BAP(key.value)
          } else {
            // Type 42 mode - use rootPk
            bap = new BAP({ rootPk: key.value })
          }

          bap.importIds(key.metadata.bapIds)
          const ids = bap.listIds()
          if (ids.length > 0) {
            // Return the first identity key
            return ids[0]
          }
        } catch (e) {
          console.warn('Failed to resolve BAP master identity:', e)
        }
      }

      // Check for BAP member key (has single bapId)
      if (key.metadata?.bapId) {
        try {
          const member = MemberID.fromBackup({
            wif: key.value,
            id: key.metadata.bapId
          })
          return member.identityKey || null
        } catch (e) {
          console.warn('Failed to resolve BAP member identity:', e)
        }
      }

      // Fallback: derive idKey from WIF for new identity keys without BAP data
      if (key.type === 'wif') {
        try {
          const bap = new BAP({ rootPk: key.value })
          const identity = bap.newId('temp')
          return identity.getIdentityKey() || null
        } catch (e) {
          console.warn('Failed to derive identity key:', e)
        }
      }
    } catch (e) {
      console.error('Error in getBapId:', e)
    }

    return null
  }

  const slots = [
    {
      key: encryptionKey,
      label: 'ENC',
      title: 'Encryption',
      color: 'bg-chart-5/20 text-chart-5 border-chart-5/30',
      clearCommand: 'clearEncryptionKey',
      getValue: (k: KeyEntry) => k.label || 'Unlabeled'
    },
    {
      key: walletKey,
      label: 'WLT',
      title: 'Wallet',
      color: 'bg-chart-3/20 text-chart-3 border-chart-3/30',
      clearCommand: 'clearFundingKey',
      getValue: (k: KeyEntry) => deriveAddress(k)
    },
    {
      key: ordinalsKey,
      label: 'ORD',
      title: 'Ordinals',
      color: 'bg-chart-1/20 text-chart-1 border-chart-1/30',
      clearCommand: 'clearOrdinalsKey',
      getValue: (k: KeyEntry) => deriveAddress(k)
    },
    {
      key: identityKey,
      label: 'ID',
      title: 'Identity',
      color: 'bg-chart-2/20 text-chart-2 border-chart-2/30',
      clearCommand: 'clearIdentityKey',
      getValue: (k: KeyEntry) => getBapId(k)
    },
  ]

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {slots.map(slot => (
        <Card
          key={slot.label}
          className={`group overflow-hidden ${slot.key && onScrollToKey ? 'cursor-pointer hover:bg-accent/50' : ''}`}
          onClick={() => slot.key && onScrollToKey && onScrollToKey(slot.key.id)}
        >
          <CardHeader className="p-2 pb-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className={`text-xs ${slot.color}`}>
                  {slot.label}
                </Badge>
                <span className="text-xs text-muted-foreground">{slot.title}</span>
              </div>
              {slot.key && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleClear(slot.clearCommand, slot.key!.id)
                  }}
                  className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Clear designation"
                >
                  ✕
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-2 pt-0">
            {slot.key ? (
              <div className="flex items-center gap-1">
                <div className="text-xs font-mono truncate flex-1 min-w-0">
                  {slot.getValue(slot.key) || 'N/A'}
                </div>
                {slot.getValue(slot.key) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(slot.getValue(slot.key!)!)}
                    className="h-6 w-6 p-0 shrink-0"
                    title="Copy"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ) : (
              <Empty className="border-0 p-1 min-h-0">
                <EmptyMedia variant="icon" className="mb-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </EmptyMedia>
                <EmptyDescription className="text-xs">
                  Not set
                </EmptyDescription>
              </Empty>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
