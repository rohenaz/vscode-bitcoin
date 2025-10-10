import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ButtonGroup, ButtonGroupSeparator } from '@/components/ui/button-group'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { KeyEntry } from '../types'
import { getVscode } from '../vscode'
import { PrivateKey } from '@bsv/sdk'

interface KeyCardProps {
  keyEntry: KeyEntry
}

export function KeyCard({ keyEntry }: KeyCardProps) {
  const vscode = getVscode()
  const [revealing, setRevealing] = useState(false)
  const [hovering, setHovering] = useState(false)

  const isTestnet = keyEntry.metadata?.network === 'testnet'

  const handleCommand = (command: string) => {
    console.log('[KeyCard] Sending command:', command, 'for key:', keyEntry.id)
    vscode.postMessage({ command, id: keyEntry.id })
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  // Derive address or BAP ID for display
  const deriveAddressOrId = (): string | null => {
    // For identity keys, show BAP ID
    if (keyEntry.isIdentityKey) {
      if (keyEntry.metadata?.bapIds) {
        try {
          const idsObj = JSON.parse(keyEntry.metadata.bapIds)
          const idsList = idsObj.ids || []
          if (idsList.length > 0) return idsList[0].idKey || null
        } catch (e) {}
      }
      if (keyEntry.metadata?.bapId) {
        return keyEntry.metadata.bapId
      }
    }

    // For WIF keys, derive and show address
    if (keyEntry.type === 'wif') {
      try {
        const pk = PrivateKey.fromWif(keyEntry.value)
        const isTestnet = keyEntry.metadata?.network === 'testnet'
        return pk.toAddress(isTestnet ? 'testnet' : 'mainnet')
      } catch (e) {
        return null
      }
    }

    return null
  }

  const customTruncate = (val: string): string => {
    if (val.length <= 10) return val
    const hiddenCount = val.length - 8
    const dots = '.'.repeat(hiddenCount)
    return val.slice(0, 4) + dots + val.slice(-4)
  }

  const addressOrId = deriveAddressOrId()
  const masked = '•'.repeat(Math.min(keyEntry.value.length, 64))

  let displayValue = addressOrId || masked
  if (hovering) displayValue = customTruncate(keyEntry.value)
  if (revealing) displayValue = keyEntry.value

  // Get badge color class based on key type using chart colors
  const getKeyTypeBadgeClass = (type: string): string => {
    switch (type) {
      case 'wif':
      case 'wif-testnet':
        return 'bg-chart-1/20 text-chart-1 border-chart-1/30'
      case 'private':
        return 'bg-chart-2/20 text-chart-2 border-chart-2/30'
      case 'public':
        return 'bg-chart-3/20 text-chart-3 border-chart-3/30'
      case 'mnemonic':
        return 'bg-chart-4/20 text-chart-4 border-chart-4/30'
      case 'hdprivate':
        return 'bg-chart-5/20 text-chart-5 border-chart-5/30'
      case 'hdpublic':
        return 'bg-chart-1/20 text-chart-1 border-chart-1/30'
      case 'encryption':
        return 'bg-chart-5/20 text-chart-5 border-chart-5/30'
      default:
        return 'bg-secondary/20 text-secondary-foreground border-secondary/30'
    }
  }

  return (
    <TooltipProvider>
      <Card className="max-w-full overflow-hidden">
        <CardHeader className="min-w-0">
          <CardTitle className="flex items-center gap-2">
            <Badge variant="outline" className={`text-xs uppercase ${getKeyTypeBadgeClass(keyEntry.type)}`}>{keyEntry.type}</Badge>
            {isTestnet && <Badge variant="outline" className="text-xs">Testnet</Badge>}
            <div
              className="cursor-pointer hover:opacity-70"
              onClick={() => {
                vscode.postMessage({
                  command: 'requestEditLabel',
                  id: keyEntry.id,
                  currentLabel: keyEntry.label || ''
                })
              }}
              title="Click to edit label"
            >
              {keyEntry.label || 'Unlabeled'}
            </div>
          </CardTitle>

          <CardAction>
            <div className="flex items-center gap-1">
              {(keyEntry.type === 'wif' || keyEntry.type === 'private' || keyEntry.type === 'encryption') && (
                <ToggleGroup
                  type="multiple"
                  variant="outline"
                  size="sm"
                  value={[
                    keyEntry.isEncryptionKey ? 'encryption' : null,
                    keyEntry.isFundingKey ? 'wallet' : null,
                    keyEntry.isOrdinalsKey ? 'ordinals' : null,
                    keyEntry.isIdentityKey ? 'identity' : null,
                  ].filter(Boolean) as string[]}
                  onValueChange={(values: string[]) => {
                    const wasEncryption = keyEntry.isEncryptionKey
                    const wasFunding = keyEntry.isFundingKey
                    const wasOrdinals = keyEntry.isOrdinalsKey
                    const wasIdentity = keyEntry.isIdentityKey

                    const isEncryption = values.includes('encryption')
                    const isFunding = values.includes('wallet')
                    const isOrdinals = values.includes('ordinals')
                    const isIdentity = values.includes('identity')

                    if (isEncryption !== wasEncryption) {
                      handleCommand(isEncryption ? 'setEncryptionKey' : 'clearEncryptionKey')
                    }
                    if (isFunding !== wasFunding) {
                      handleCommand(isFunding ? 'setFundingKey' : 'clearFundingKey')
                    }
                    if (isOrdinals !== wasOrdinals) {
                      handleCommand(isOrdinals ? 'setOrdinalsKey' : 'clearOrdinalsKey')
                    }
                    if (isIdentity !== wasIdentity) {
                      handleCommand(isIdentity ? 'setIdentityKey' : 'clearIdentityKey')
                    }
                  }}
                >
                  <ToggleGroupItem
                    value="encryption"
                    aria-label="Toggle encryption"
                    title={keyEntry.isEncryptionKey ? 'Clear encryption key' : 'Set as encryption key'}
                    className="text-xs data-[state=on]:bg-chart-5/20 data-[state=on]:text-chart-5"
                  >
                    ENC
                  </ToggleGroupItem>

                  {keyEntry.type === 'wif' && (
                    <>
                      <ToggleGroupItem
                        value="wallet"
                        aria-label="Toggle wallet"
                        title={keyEntry.isFundingKey ? 'Clear wallet key' : 'Set as wallet key'}
                        className="text-xs data-[state=on]:bg-chart-3/20 data-[state=on]:text-chart-3"
                      >
                        WLT
                      </ToggleGroupItem>

                      <ToggleGroupItem
                        value="ordinals"
                        aria-label="Toggle ordinals"
                        title={keyEntry.isOrdinalsKey ? 'Clear ordinals key' : 'Set as ordinals key'}
                        className="text-xs data-[state=on]:bg-chart-1/20 data-[state=on]:text-chart-1"
                      >
                        ORD
                      </ToggleGroupItem>

                      <ToggleGroupItem
                        value="identity"
                        aria-label="Toggle identity"
                        title={keyEntry.isIdentityKey ? 'Clear identity key' : 'Set as identity key'}
                        className="text-xs data-[state=on]:bg-chart-2/20 data-[state=on]:text-chart-2"
                      >
                        ID
                      </ToggleGroupItem>
                    </>
                  )}
                </ToggleGroup>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCommand('deleteKey')}
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  >
                    ✕
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete key</TooltipContent>
              </Tooltip>
            </div>
          </CardAction>
        </CardHeader>

        <CardContent className="min-w-0">
          <div
            className="flex items-center gap-2 bg-muted rounded cursor-pointer select-none min-w-0 overflow-hidden"
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => {
              setHovering(false)
              setRevealing(false)
            }}
            onMouseDown={() => setRevealing(true)}
            onMouseUp={() => setRevealing(false)}
            title="Hover to preview, hold to reveal full key"
          >
            <div className="flex-1 font-mono text-xs overflow-hidden overflow-ellipsis whitespace-nowrap min-w-0 max-w-full">
              <span className="inline-block max-w-full overflow-hidden overflow-ellipsis">
                {displayValue}
              </span>
            </div>

            <ButtonGroup className="flex-shrink-0">
              {renderFormatButtons(keyEntry, handleCommand)}
            </ButtonGroup>
          </div>

          <div className="flex items-center justify-between gap-2 mt-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{formatDate(keyEntry.timestamp)}</span>
              {renderMetadata(keyEntry)}
            </div>
            <div className="flex items-center gap-1.5">
              {renderActionButtons(keyEntry, handleCommand)}
            </div>
          </div>
        </CardContent>

        {keyEntry.children && keyEntry.children.length > 0 && (
          <div className="ml-4 mt-2 space-y-2">
            {keyEntry.children.map(child => (
              <KeyCard key={child.id} keyEntry={child} />
            ))}
          </div>
        )}
      </Card>
    </TooltipProvider>
  )
}

function renderFormatButtons(key: KeyEntry, handleCommand: (cmd: string) => void) {
  switch (key.type) {
    case 'mnemonic':
      return (
        <ButtonGroup>
          <Button size="sm" variant="outline" onClick={() => handleCommand('copyWords')} title="Copy mnemonic words">WORDS</Button>
          <Button size="sm" variant="outline" onClick={() => handleCommand('copyXprv')} title="Copy extended private key">XPRV</Button>
          <Button size="sm" variant="outline" onClick={() => handleCommand('copyXpub')} title="Copy extended public key">XPUB</Button>
        </ButtonGroup>
      )

    case 'wif':
      const testnet = key.metadata?.network === 'testnet'
      return (
        <ButtonGroup>
          <Button size="sm" variant="outline" onClick={() => handleCommand('copyWif')} title="Copy WIF format">WIF</Button>
          <Button size="sm" variant="outline" onClick={() => handleCommand('copyHex')} title="Copy hex format">HEX</Button>
          <Button size="sm" variant="outline" onClick={() => handleCommand(testnet ? 'copyTAddress' : 'copyAddress')} title={testnet ? 'Copy testnet address' : 'Copy Bitcoin address'}>
            {testnet ? 'TADDR' : 'ADDR'}
          </Button>
        </ButtonGroup>
      )

    case 'private':
    case 'encryption':
      return (
        <ButtonGroup>
          <Button size="sm" variant="outline" onClick={() => handleCommand('copyWif')} title="Copy WIF format">WIF</Button>
          <Button size="sm" variant="outline" onClick={() => handleCommand('copyHex')} title="Copy hex format">HEX</Button>
        </ButtonGroup>
      )

    case 'public':
      return (
        <ButtonGroup>
          <Button size="sm" variant="outline" onClick={() => handleCommand('copyHex')} title="Copy hex format">HEX</Button>
          <Button size="sm" variant="outline" onClick={() => handleCommand('copyAddress')} title="Copy Bitcoin address">ADDR</Button>
          <Button size="sm" variant="outline" onClick={() => handleCommand('p2pkhScript')} title="Copy P2PKH script">P2PKH</Button>
        </ButtonGroup>
      )

    case 'hdprivate':
      return (
        <ButtonGroup>
          <Button size="sm" variant="outline" onClick={() => handleCommand('copyXprv')} title="Copy extended private key">XPRV</Button>
          <Button size="sm" variant="outline" onClick={() => handleCommand('copyXpub')} title="Copy extended public key">XPUB</Button>
        </ButtonGroup>
      )

    case 'hdpublic':
      return (
        <ButtonGroup>
          <Button size="sm" variant="outline" onClick={() => handleCommand('copyXpub')} title="Copy extended public key">XPUB</Button>
        </ButtonGroup>
      )
  }

  return null
}

function renderActionButtons(key: KeyEntry, handleCommand: (cmd: string) => void) {
  const buttons: React.ReactElement[] = []
  const isSinglePriv = key.type === 'wif' || key.type === 'private' || key.type === 'encryption'
  const isHdType = key.type === 'hdprivate' || key.type === 'hdpublic' || key.type === 'mnemonic'

  // Single private key derivation buttons
  if (isSinglePriv) {
    buttons.push(
      <Button key="pub" size="sm" variant="outline" onClick={() => handleCommand('publicChild')} title="Derive public key">PUB</Button>,
      <ButtonGroupSeparator key="sep1" />,
      <Button key="type42" size="sm" variant="outline" onClick={() => handleCommand('type42Child')} title="Derive Type-42 child key">Type42</Button>
    )
  }

  // HD key derivation buttons
  if (isHdType) {
    buttons.push(
      <Button key="bip32" size="sm" variant="outline" onClick={() => handleCommand('bip32Child')} title="Derive BIP32 child key">BIP32</Button>
    )
  }

  // Add xPub derive button for hdprivate keys
  if (key.type === 'hdprivate') {
    buttons.push(
      <ButtonGroupSeparator key="sep-xpub" />,
      <Button key="xpub" size="sm" variant="outline" onClick={() => handleCommand('publicChild')} title="Derive extended public key child">xPub</Button>
    )
  }

  // Add separator before advanced buttons if we have derivation buttons
  if (buttons.length > 0) {
    // WIF keys: add Split/Shares button
    if (key.type === 'wif') {
      buttons.push(<ButtonGroupSeparator key="sep-advanced" />)
      if (key.keyShares && key.keyShares.length > 0) {
        buttons.push(
          <Button key="shares-view" size="sm" variant="outline" onClick={() => handleCommand('viewKeyShares')} title="View key shares">Shares</Button>
        )
      } else {
        buttons.push(
          <Button key="shares-gen" size="sm" variant="outline" onClick={() => handleCommand('generateKeyShares')} title="Split key into shares (Shamir's Secret Sharing)">Split</Button>
        )
      }
    }
  } else {
    // No derivation buttons, just add advanced buttons without separator
    if (key.type === 'wif') {
      if (key.keyShares && key.keyShares.length > 0) {
        buttons.push(
          <Button key="shares-view" size="sm" variant="outline" onClick={() => handleCommand('viewKeyShares')} title="View key shares">Shares</Button>
        )
      } else {
        buttons.push(
          <Button key="shares-gen" size="sm" variant="outline" onClick={() => handleCommand('generateKeyShares')} title="Split key into shares (Shamir's Secret Sharing)">Split</Button>
        )
      }
    }

    if (key.type === 'public') {
      buttons.push(
        <Button key="woc" size="sm" variant="outline" onClick={() => handleCommand('viewOnChain')} title="View on WhatsOnChain">WoC</Button>
      )
    }
  }

  if (buttons.length === 0) return null

  return (
    <ButtonGroup>
      {buttons}
    </ButtonGroup>
  )
}

function renderMetadata(key: KeyEntry) {
  if (!key.metadata) return null

  const items: React.ReactElement[] = []

  // Vanity prefix
  if (key.metadata.vanityPrefix) {
    items.push(
      <Tooltip key="vanity">
        <TooltipTrigger>
          <Badge variant="outline" className="text-xs">
            {key.metadata.vanityPrefix}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>Vanity prefix ({key.metadata.attempts || '?'} attempts)</TooltipContent>
      </Tooltip>
    )
  }

  // BIP32 derivation path
  if (key.metadata.bip32Path) {
    items.push(
      <Tooltip key="path">
        <TooltipTrigger>
          <Badge variant="outline" className="text-xs font-mono">
            {key.metadata.bip32Path}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>BIP32 derivation path</TooltipContent>
      </Tooltip>
    )
  }

  // Type-42 info
  if (key.metadata.type42Invoice) {
    items.push(
      <Tooltip key="type42">
        <TooltipTrigger>
          <Badge variant="outline" className="text-xs font-mono">
            {key.metadata.type42Invoice}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          Type-42 derived key
          {key.metadata.type42OtherPub && (
            <div className="text-xs mt-1 font-mono">
              Pub: {key.metadata.type42OtherPub.slice(0, 16)}...
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    )
  }

  // 1Sat role
  if (key.metadata.oneSatRole) {
    items.push(
      <Badge key="role" variant="outline" className="text-xs capitalize">
        {key.metadata.oneSatRole}
      </Badge>
    )
  }

  // Backup type
  if (key.metadata.backupType) {
    items.push(
      <Tooltip key="backup">
        <TooltipTrigger>
          <Badge variant="outline" className="text-xs">
            {key.metadata.backupType.replace('legacy-', '')}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>Imported from {key.metadata.backupType} backup</TooltipContent>
      </Tooltip>
    )
  }

  // Reconstructed from shares
  if (key.metadata.reconstructedAt) {
    items.push(
      <Tooltip key="reconstructed">
        <TooltipTrigger>
          <Badge variant="outline" className="text-xs">
            Reconstructed
          </Badge>
        </TooltipTrigger>
        <TooltipContent>From {key.metadata.fromShares || '?'} shares at {new Date(key.metadata.reconstructedAt).toLocaleString()}</TooltipContent>
      </Tooltip>
    )
  }

  // Parent key reference
  if (key.metadata.parentId && key.metadata.derivedFrom) {
    items.push(
      <Badge key="derived" variant="outline" className="text-xs capitalize">
        ← {key.metadata.derivedFrom}
      </Badge>
    )
  }

  return items.length > 0 ? <>{items}</> : null
}
