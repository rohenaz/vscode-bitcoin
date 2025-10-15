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
import { BAP, MemberID } from 'bsv-bap'

interface KeyCardProps {
  keyEntry: KeyEntry
}

export function KeyCard({ keyEntry }: KeyCardProps) {
  const vscode = getVscode()
  const [revealing, setRevealing] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [buttonHoverFormat, setButtonHoverFormat] = useState<string | null>(null)

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
    try {
      // For identity keys, resolve BAP identity key using bsv-bap library
      if (keyEntry.isIdentityKey) {
        // Check for BAP master key (has multiple bapIds)
        if (keyEntry.metadata?.bapIds) {
          try {
            // Initialize BAP based on key type
            let bap: BAP
            if (keyEntry.type === 'hdprivate') {
              // Legacy BIP32 mode - use xprv string
              bap = new BAP(keyEntry.value)
            } else {
              // Type 42 mode - use rootPk
              bap = new BAP({ rootPk: keyEntry.value })
            }

            bap.importIds(keyEntry.metadata.bapIds)
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
        if (keyEntry.metadata?.bapId) {
          try {
            const member = MemberID.fromBackup({
              wif: keyEntry.value,
              id: keyEntry.metadata.bapId
            })
            return member.identityKey || null
          } catch (e) {
            console.warn('Failed to resolve BAP member identity:', e)
          }
        }

        // Fallback: derive idKey from WIF for new identity keys without BAP data
        if (keyEntry.type === 'wif') {
          try {
            const bap = new BAP({ rootPk: keyEntry.value })
            const identity = bap.newId('temp')
            return identity.getIdentityKey() || null
          } catch (e) {
            console.warn('Failed to derive identity key:', e)
          }
        }
      }

      // For WIF keys (non-identity), derive and show address
      if (keyEntry.type === 'wif') {
        try {
          const pk = PrivateKey.fromWif(keyEntry.value)
          const isTestnet = keyEntry.metadata?.network === 'testnet'
          return pk.toAddress(isTestnet ? 'testnet' : 'mainnet')
        } catch (e) {
          return null
        }
      }
    } catch (e) {
      console.error('Error in deriveAddressOrId:', e)
    }

    return null
  }

  const customTruncate = (val: string): string => {
    if (val.length <= 10) return val
    const hiddenCount = val.length - 8
    const dots = '.'.repeat(hiddenCount)
    return val.slice(0, 4) + dots + val.slice(-4)
  }

  const getFormatValue = (format: string): string => {
    try {
      switch (format) {
        case 'words':
          if (keyEntry.type === 'mnemonic') {
            return keyEntry.value
          }
          break
        case 'wif':
          if (keyEntry.type === 'wif' || keyEntry.type === 'private' || keyEntry.type === 'encryption') {
            return keyEntry.value
          }
          break
        case 'hex':
          if (keyEntry.type === 'wif' || keyEntry.type === 'private' || keyEntry.type === 'encryption') {
            const pk = PrivateKey.fromWif(keyEntry.value)
            return pk.toHex()
          }
          if (keyEntry.type === 'public') {
            return keyEntry.value
          }
          break
        case 'address':
        case 'taddress':
          if (keyEntry.type === 'wif') {
            const pk = PrivateKey.fromWif(keyEntry.value)
            const isTestnet = keyEntry.metadata?.network === 'testnet'
            return pk.toAddress(isTestnet ? 'testnet' : 'mainnet')
          }
          break
      }
    } catch (e) {
      console.error('Failed to derive format value:', e)
    }
    return ''
  }

  const addressOrId = deriveAddressOrId()
  const masked = '•'.repeat(Math.min(keyEntry.value.length, 64))

  let displayValue = addressOrId || masked
  if (hovering) displayValue = customTruncate(keyEntry.value)
  if (revealing) displayValue = keyEntry.value
  // Show button format value when hovering over format buttons
  if (buttonHoverFormat) {
    const formatValue = getFormatValue(buttonHoverFormat)
    if (formatValue) displayValue = formatValue
  }

  // Get badge color class - use designated key color if applicable, otherwise default key type color
  const getKeyTypeBadgeClass = (type: string): string => {
    // Check if this is a designated key and use its color
    if (keyEntry.isEncryptionKey) {
      return 'bg-chart-5/20 text-chart-5 border-chart-5/30' // ENC color
    }
    if (keyEntry.isFundingKey) {
      return 'bg-chart-3/20 text-chart-3 border-chart-3/30' // WLT color
    }
    if (keyEntry.isOrdinalsKey) {
      return 'bg-chart-1/20 text-chart-1 border-chart-1/30' // ORD color
    }
    if (keyEntry.isIdentityKey) {
      return 'bg-chart-2/20 text-chart-2 border-chart-2/30' // ID color
    }

    // Otherwise use default key type color
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
      case 'keyshare':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      default:
        return 'bg-secondary/20 text-secondary-foreground border-secondary/30'
    }
  }

  return (
    <TooltipProvider>
      <Card id={`key-${keyEntry.id}`} className="max-w-full overflow-hidden">
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
            className="flex items-center gap-2 bg-muted rounded cursor-pointer select-none min-w-0 overflow-hidden p-1.5"
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => {
              setHovering(false)
              setRevealing(false)
              setButtonHoverFormat(null)
            }}
            onMouseDown={() => setRevealing(true)}
            onMouseUp={() => setRevealing(false)}
            title="Hover to preview, hold to reveal full key"
          >
            <div className="flex-1 font-mono text-xs overflow-hidden overflow-ellipsis whitespace-nowrap min-w-0 flex items-center">
              {displayValue}
            </div>

            <ButtonGroup className="flex-shrink-0">
              {renderFormatButtons(keyEntry, handleCommand, setButtonHoverFormat)}
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

function renderFormatButtons(key: KeyEntry, handleCommand: (cmd: string) => void, setButtonHoverFormat: (format: string | null) => void) {

  switch (key.type) {
    case 'keyshare':
      return (
        <ButtonGroup>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(key.value)
                  // Show a toast or notification
                }}
                className="min-w-[32px]"
              >
                CP
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy share value</TooltipContent>
          </Tooltip>
        </ButtonGroup>
      )

    case 'mnemonic':
      return (
        <ButtonGroup>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-sm"
                variant="outline"
                onClick={() => handleCommand('copyWords')}
                onMouseEnter={() => setButtonHoverFormat('words')}
                onMouseLeave={() => setButtonHoverFormat(null)}
                className="min-w-[32px]"
              >
                WD
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy mnemonic words</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-sm"
                variant="outline"
                onClick={() => handleCommand('copyXprv')}
                className="min-w-[32px]"
              >
                XV
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy extended private key</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-sm"
                variant="outline"
                onClick={() => handleCommand('copyXpub')}
                className="min-w-[32px]"
              >
                XU
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy extended public key</TooltipContent>
          </Tooltip>
        </ButtonGroup>
      )

    case 'wif':
      const testnet = key.metadata?.network === 'testnet'
      return (
        <ButtonGroup>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-sm"
                variant="outline"
                onClick={() => handleCommand('copyWif')}
                onMouseEnter={() => setButtonHoverFormat('wif')}
                onMouseLeave={() => setButtonHoverFormat(null)}
                className="min-w-[32px]"
              >
                WF
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy WIF format</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-sm"
                variant="outline"
                onClick={() => handleCommand('copyHex')}
                onMouseEnter={() => setButtonHoverFormat('hex')}
                onMouseLeave={() => setButtonHoverFormat(null)}
                className="min-w-[32px]"
              >
                HX
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy hex format</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-sm"
                variant="outline"
                onClick={() => handleCommand(testnet ? 'copyTAddress' : 'copyAddress')}
                onMouseEnter={() => setButtonHoverFormat(testnet ? 'taddress' : 'address')}
                onMouseLeave={() => setButtonHoverFormat(null)}
                className="min-w-[32px]"
              >
                {testnet ? 'TA' : 'AD'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{testnet ? 'Copy testnet address' : 'Copy Bitcoin address'}</TooltipContent>
          </Tooltip>
        </ButtonGroup>
      )

    case 'private':
    case 'encryption':
      return (
        <ButtonGroup>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-sm"
                variant="outline"
                onClick={() => handleCommand('copyWif')}
                onMouseEnter={() => setButtonHoverFormat('wif')}
                onMouseLeave={() => setButtonHoverFormat(null)}
                className="min-w-[32px]"
              >
                WF
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy WIF format</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-sm"
                variant="outline"
                onClick={() => handleCommand('copyHex')}
                onMouseEnter={() => setButtonHoverFormat('hex')}
                onMouseLeave={() => setButtonHoverFormat(null)}
                className="min-w-[32px]"
              >
                HX
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy hex format</TooltipContent>
          </Tooltip>
        </ButtonGroup>
      )

    case 'public':
      return (
        <ButtonGroup>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-sm"
                variant="outline"
                onClick={() => handleCommand('copyHex')}
                onMouseEnter={() => setButtonHoverFormat('hex')}
                onMouseLeave={() => setButtonHoverFormat(null)}
                className="min-w-[32px]"
              >
                HX
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy hex format</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-sm"
                variant="outline"
                onClick={() => handleCommand('copyAddress')}
                className="min-w-[32px]"
              >
                AD
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy Bitcoin address</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-sm"
                variant="outline"
                onClick={() => handleCommand('p2pkhScript')}
                className="min-w-[32px]"
              >
                PK
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy P2PKH script</TooltipContent>
          </Tooltip>
        </ButtonGroup>
      )

    case 'hdprivate':
      return (
        <ButtonGroup>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-sm"
                variant="outline"
                onClick={() => handleCommand('copyXprv')}
                className="min-w-[32px]"
              >
                XV
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy extended private key</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-sm"
                variant="outline"
                onClick={() => handleCommand('copyXpub')}
                className="min-w-[32px]"
              >
                XU
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy extended public key</TooltipContent>
          </Tooltip>
        </ButtonGroup>
      )

    case 'hdpublic':
      return (
        <ButtonGroup>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-sm"
                variant="outline"
                onClick={() => handleCommand('copyXpub')}
                className="min-w-[32px]"
              >
                XU
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy extended public key</TooltipContent>
          </Tooltip>
        </ButtonGroup>
      )
  }

  return null
}

function renderActionButtons(key: KeyEntry, handleCommand: (cmd: string) => void) {
  const buttons: React.ReactElement[] = []
  const isSinglePriv = key.type === 'wif' || key.type === 'private' || key.type === 'encryption'
  const isHdType = key.type === 'hdprivate' || key.type === 'hdpublic' || key.type === 'mnemonic'
  const hasBapData = key.metadata?.bapIds || key.metadata?.bapId

  // For keyshare types, just show delete button
  if (key.type === 'keyshare') {
    return null // Delete button is always shown in header
  }

  // BAP Identity button (if key has BAP data)
  if (hasBapData) {
    buttons.push(
      <Button key="bap" size="sm" variant="outline" onClick={() => handleCommand('viewBapIdentities')} title="View BAP identities" className="bg-chart-2/10 hover:bg-chart-2/20">BAP</Button>
    )
    // Add separator if there will be more buttons
    if (isSinglePriv || isHdType) {
      buttons.push(<ButtonGroupSeparator key="sep-bap" />)
    }
  }

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
    // WIF keys: add Split button
    if (key.type === 'wif') {
      buttons.push(<ButtonGroupSeparator key="sep-advanced" />)
      buttons.push(
        <Button key="shares-gen" size="sm" variant="outline" onClick={() => handleCommand('generateKeyShares')} title="Split key into shares (Shamir's Secret Sharing)">Split</Button>
      )
    }
  } else {
    // No derivation buttons, just add advanced buttons without separator
    if (key.type === 'wif') {
      buttons.push(
        <Button key="shares-gen" size="sm" variant="outline" onClick={() => handleCommand('generateKeyShares')} title="Split key into shares (Shamir's Secret Sharing)">Split</Button>
      )
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

  // BAP Identity info
  if (key.metadata.bapIds) {
    try {
      const idsObj = JSON.parse(key.metadata.bapIds)
      const idsList = idsObj.ids || []
      if (idsList.length > 0) {
        // Try to resolve the first identity key
        let resolvedIdKey: string | null = null
        try {
          const bap = new BAP({ rootPk: key.value })
          bap.importIds(key.metadata.bapIds)
          const ids = bap.listIds()
          if (ids.length > 0) {
            const identity = bap.getId(ids[0])
            if (identity) {
              resolvedIdKey = identity.getIdentityKey()
            }
          }
        } catch (e) {
          // Silent fail
        }

        items.push(
          <Tooltip key="bap-master">
            <TooltipTrigger>
              <Badge variant="outline" className="text-xs bg-chart-2/20 text-chart-2 border-chart-2/30">
                BAP Master ({idsList.length})
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div>BAP Master Key with {idsList.length} identit{idsList.length === 1 ? 'y' : 'ies'}</div>
              {idsList[0]?.idName && <div className="text-xs mt-1">First: {idsList[0].idName}</div>}
              {resolvedIdKey && <div className="text-xs mt-1 font-mono">{resolvedIdKey}</div>}
            </TooltipContent>
          </Tooltip>
        )
      }
    } catch (e) {
      // Silent fail - malformed JSON
    }
  } else if (key.metadata.bapId) {
    // Try to resolve member identity key
    let resolvedIdKey: string | null = null
    try {
      const member = MemberID.fromBackup({
        wif: key.value,
        id: key.metadata.bapId
      })
      resolvedIdKey = member.identityKey
    } catch (e) {
      // Silent fail
    }

    items.push(
      <Tooltip key="bap-member">
        <TooltipTrigger>
          <Badge variant="outline" className="text-xs bg-chart-2/20 text-chart-2 border-chart-2/30">
            BAP Member
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div>BAP Member Identity</div>
          <div className="text-xs mt-1 font-mono">{resolvedIdKey || key.metadata.bapId}</div>
        </TooltipContent>
      </Tooltip>
    )
  }

  // Keyshare metadata (for share entries themselves)
  if (key.type === 'keyshare') {
    items.push(
      <Tooltip key="keyshare-info">
        <TooltipTrigger>
          <Badge variant="outline" className="text-xs bg-purple-500/20 text-purple-400 border-purple-500/30">
            {key.metadata.shareIndex} of {key.metadata.shareTotal}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div>Shamir Secret Share</div>
          <div className="text-xs mt-1">From: {key.metadata.parentLabel || 'Unknown'}</div>
          <div className="text-xs">Threshold: {key.metadata.shareThreshold} required</div>
          {key.metadata.generatedAt && (
            <div className="text-xs">Generated: {new Date(key.metadata.generatedAt).toLocaleString()}</div>
          )}
        </TooltipContent>
      </Tooltip>
    )
  }

  // Parent key with shares generated
  if (key.metadata.sharesGenerated) {
    items.push(
      <Tooltip key="has-shares">
        <TooltipTrigger>
          <Badge variant="outline" className="text-xs bg-purple-500/20 text-purple-400 border-purple-500/30">
            Split into {key.metadata.sharesCount} shares
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div>Shamir Secret Sharing</div>
          <div className="text-xs mt-1">{key.metadata.sharesCount} shares generated</div>
          <div className="text-xs">Threshold: {key.metadata.sharesThreshold} required to reconstruct</div>
          <div className="text-xs">Generated: {new Date(key.metadata.sharesGenerated).toLocaleString()}</div>
        </TooltipContent>
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
