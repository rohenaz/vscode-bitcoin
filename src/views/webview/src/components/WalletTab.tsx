import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Item, ItemGroup, ItemContent, ItemTitle, ItemDescription, ItemHeader, ItemMedia, ItemActions } from '@/components/ui/item'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu'
import {
  Wallet, RefreshCw, Send, Download, Copy,
  MapPin, Image, Coins, Flame, FolderOpen, Loader2, X, ExternalLink, Check, FileText, Play, Sparkles, Store
} from 'lucide-react'
import { getVscode } from '../vscode'
import { useVault } from '../contexts/VaultContext'
import { SendBsvDialog } from './SendBsvDialog'
import { ReceiveDialog } from './ReceiveDialog'
import { TransferTokenDialog } from './TransferTokenDialog'
import { TransferOrdinalDialog } from './TransferOrdinalDialog'
import { MintNftDialog } from './MintNftDialog'
import { MarketTab } from './MarketTab'
import { MintBsv21Dialog } from './MintBsv21Dialog'

interface Collection {
  id: string;
  name?: string;
  description?: string;
  icon?: string;
  items: any[];
}

interface WalletState {
  fundingKey: {
    id: string;
    label?: string;
    payAddress: string;
    ordAddress: string;
  } | null;
  hasFundingKey: boolean;
  hasOrdinalsKey: boolean;
  balance: {
    total: number;
    spendable: number;
  };
  nfts: any[];           // Standalone NFTs
  collections: Collection[]; // Grouped collections
  tokens: {
    bsv20: any[];
    bsv21: any[];
  };
  settings: {
    showBsv20: boolean;
    showBsv21: boolean;
    autoBroadcast: boolean;
  };
  loadingStates: {
    balance: boolean;
    nfts: boolean;
    bsv20: boolean;
    bsv21: boolean;
  };
  isVaultLocked: boolean;
  lastUpdate: number;
}

interface WalletTabProps {
  isActive: boolean;
}

export default function WalletTab({ isActive }: WalletTabProps) {
  const vscode = getVscode()
  const { vaultState } = useVault()
  const [state, setState] = useState<WalletState>({
    fundingKey: null,
    hasFundingKey: false,
    hasOrdinalsKey: false,
    balance: { total: 0, spendable: 0 },
    nfts: [],
    collections: [],
    tokens: { bsv20: [], bsv21: [] },
    settings: { showBsv20: false, showBsv21: true, autoBroadcast: false },
    loadingStates: {
      balance: false,
      nfts: false,
      bsv20: false,
      bsv21: false
    },
    isVaultLocked: true,
    lastUpdate: 0
  })
  const [showSendDialog, setShowSendDialog] = useState(false)
  const [showReceiveDialog, setShowReceiveDialog] = useState(false)
  const [showTransferDialog, setShowTransferDialog] = useState(false)
  const [showBurnDialog, setShowBurnDialog] = useState(false)
  const [selectedToken, setSelectedToken] = useState<any>(null)
  // Ordinal selection state
  const [selectedNfts, setSelectedNfts] = useState<Set<string>>(new Set())
  const [showTransferOrdinalDialog, setShowTransferOrdinalDialog] = useState(false)
  // Mint dialog state
  const [showMintNftDialog, setShowMintNftDialog] = useState(false)
  const [showMintBsv21Dialog, setShowMintBsv21Dialog] = useState(false)

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, data } = event.data

      switch (type) {
        case 'wallet:stateUpdate':
          setState(prev => ({ ...prev, ...data }))
          break

        case 'wallet:fundingKeyChanged':
          setState(data)
          break

        case 'wallet:error':
          console.error('Wallet error:', data.error)
          setState(prev => ({
            ...prev,
            loadingStates: {
              balance: false,
              nfts: false,
              bsv20: false,
              bsv21: false
            }
          }))
          break
      }
    }

    window.addEventListener('message', handleMessage)

    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Check vault status and load funding key when tab becomes active
  useEffect(() => {
    if (isActive) {
      vscode.postMessage({ type: 'wallet:checkVaultStatus' })
      vscode.postMessage({ type: 'wallet:getFundingKey' })
    }
  }, [isActive])

  // NOTE: Removed redundant useEffect that watched vaultState changes
  // The backend already handles key changes via onFundingKeyChanged() event
  // which selectively refreshes only balance OR tokens, not both

  const formatBSV = (satoshis: number): string => {
    return (satoshis / 100000000).toFixed(8)
  }

  const formatSats = (satoshis: number): string => {
    return satoshis.toLocaleString()
  }

  const copyAddress = (address: string) => {
    vscode.postMessage({ type: 'copy', value: address })
  }

  const handleSend = () => {
    setShowSendDialog(true)
  }

  const handleReceive = () => {
    setShowReceiveDialog(true)
  }

  const handleRefresh = () => {
    vscode.postMessage({ type: 'wallet:refreshBalance' })
  }

  const openKeyVault = () => {
    vscode.postMessage({ command: 'bitcoin.showKeyVault' })
  }

  // NFT selection handlers
  const toggleNftSelection = (nftId: string) => {
    setSelectedNfts(prev => {
      const next = new Set(prev)
      if (next.has(nftId)) {
        next.delete(nftId)
      } else {
        next.add(nftId)
      }
      return next
    })
  }

  const clearSelection = () => {
    setSelectedNfts(new Set())
  }

  const handleSendSelected = () => {
    setShowTransferOrdinalDialog(true)
  }

  const handleSendSingle = (nft: any) => {
    // Select this NFT and open dialog
    const nftId = `${nft.txid}_${nft.vout}`
    setSelectedNfts(new Set([nftId]))
    setShowTransferOrdinalDialog(true)
  }

  const handleOpenSelected = () => {
    const selected = getSelectedNftsArray()
    selected.forEach(nft => {
      vscode.postMessage({
        command: 'downloadOrdinal',
        origin: nft.origin,
        contentType: nft.contentType
      })
    })
  }

  const handleDecodeSelected = () => {
    const selected = getSelectedNftsArray()
    if (selected.length > 0) {
      // Use the first selected NFT's txid to decode
      vscode.postMessage({
        type: 'wallet:decodeTransaction',
        data: { txid: selected[0].txid }
      })
    }
  }

  const handleEvalSelected = () => {
    const selected = getSelectedNftsArray()
    if (selected.length > 0) {
      // Use the first selected NFT to evaluate its script
      vscode.postMessage({
        type: 'wallet:evaluateScript',
        data: {
          txid: selected[0].txid,
          vout: selected[0].vout
        }
      })
    }
  }

  const getSelectedNftsArray = () => {
    const allNfts = [
      ...state.nfts,
      ...state.collections.flatMap(c => c.items)
    ]
    return allNfts.filter(nft => {
      const nftId = `${nft.txid}_${nft.vout}`
      return selectedNfts.has(nftId)
    })
  }

  return (
    <>
      <SendBsvDialog
        open={showSendDialog}
        onOpenChange={setShowSendDialog}
        spendableBalance={state.balance.spendable}
        payAddress={state.fundingKey?.payAddress || ''}
        autoBroadcast={state.settings.autoBroadcast}
      />

      <ReceiveDialog
        open={showReceiveDialog}
        onOpenChange={setShowReceiveDialog}
        payAddress={state.fundingKey?.payAddress || ''}
        ordAddress={state.fundingKey?.ordAddress || ''}
      />

      <TransferTokenDialog
        open={showTransferDialog}
        onOpenChange={setShowTransferDialog}
        token={selectedToken}
        ordAddress={state.fundingKey?.ordAddress || ''}
        isBurn={false}
      />

      <TransferTokenDialog
        open={showBurnDialog}
        onOpenChange={setShowBurnDialog}
        token={selectedToken}
        ordAddress={state.fundingKey?.ordAddress || ''}
        isBurn={true}
      />

      <TransferOrdinalDialog
        open={showTransferOrdinalDialog}
        onOpenChange={(open) => {
          setShowTransferOrdinalDialog(open)
          if (!open) clearSelection()
        }}
        selectedNfts={getSelectedNftsArray()}
        vscode={vscode}
      />

      {/* Mint Dialogs */}
      <MintNftDialog
        open={showMintNftDialog}
        onOpenChange={setShowMintNftDialog}
        ordAddress={state.fundingKey?.ordAddress || ''}
      />

      <MintBsv21Dialog
        open={showMintBsv21Dialog}
        onOpenChange={setShowMintBsv21Dialog}
        ordAddress={state.fundingKey?.ordAddress || ''}
      />

      <div className="wallet-container relative">
      {/* Header Bar with Key Selection Buttons */}
      <div className="wallet-header flex items-center justify-between mb-2 pb-2 border-b">
        <div className="flex items-center gap-2">
          {/* Wallet (Funding) Key Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              vscode.postMessage({
                type: 'openKeyVault',
                data: { scrollTo: 'WLT' }
              })
            }}
            className="relative"
          >
            <div className="flex items-center gap-2">
              {/* Green indicator for wallet */}
              <div className={`h-2 w-2 rounded-full ${
                state.loadingStates.balance
                  ? 'bg-green-500 animate-pulse'
                  : state.hasFundingKey
                    ? 'bg-green-500'
                    : 'bg-muted-foreground/30'
              }`} />
              <Wallet className="h-3 w-3" />
              <span className="text-xs">
                {state.hasFundingKey ? 'Wallet' : 'No Wallet'}
              </span>
            </div>
          </Button>

          {/* Ordinals Key Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              vscode.postMessage({
                type: 'openKeyVault',
                data: { scrollTo: 'ORD' }
              })
            }}
            className="relative"
          >
            <div className="flex items-center gap-2">
              {/* Blue indicator for ordinals */}
              <div className={`h-2 w-2 rounded-full ${
                (state.loadingStates.nfts || state.loadingStates.bsv20 || state.loadingStates.bsv21)
                  ? 'bg-blue-500 animate-pulse'
                  : state.hasOrdinalsKey
                    ? 'bg-blue-500'
                    : 'bg-muted-foreground/30'
              }`} />
              <Image className="h-3 w-3" />
              <span className="text-xs">
                {state.hasOrdinalsKey ? 'Ordinals' : 'No Ordinals'}
              </span>
            </div>
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>

      {/* Empty State - Vault Locked or No Keys */}
      {!state.fundingKey && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Wallet className="h-12 w-12 text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle>
              {vaultState.isLocked ? 'Vault Locked' : 'No Keys Selected'}
            </EmptyTitle>
            <EmptyDescription>
              {vaultState.isLocked
                ? 'Unlock your Key Vault to access your wallet, ordinals, and tokens'
                : 'Set a funding key or ordinals key in the Key Vault to get started'
              }
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={openKeyVault}>
              {vaultState.isLocked ? 'Unlock Vault' : 'Open Key Vault'}
            </Button>
          </EmptyContent>
        </Empty>
      )}

      {/* Wallet Content - When Key Exists */}
      {state.fundingKey && (
        <>
          {/* Balance Card */}
          <Card className="border-l-0 border-r-0 my-2">
            <CardHeader>
              <CardTitle className="text-xs">Spendable Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-2">
                <div className="text-2xl font-bold">
                  {formatBSV(state.balance.spendable)} <span className="text-sm text-muted-foreground">BSV</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatSats(state.balance.spendable)} sats
                </div>
                {state.balance.total !== state.balance.spendable && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Total: {formatBSV(state.balance.total)} BSV
                  </div>
                )}
              </div>
              <div className="flex justify-center gap-2 mt-4">
                <Button
                  onClick={handleSend}
                  disabled={!state.hasFundingKey || state.balance.spendable === 0}
                  size="sm"
                  title={!state.hasFundingKey ? 'Requires funding key' : undefined}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </Button>
                <Button
                  onClick={handleReceive}
                  variant="outline"
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Receive
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Accordion Sections */}
          <Accordion type="multiple" className="w-full">
            {/* Standalone NFTs Section */}
            <AccordionItem value="nfts">
              <AccordionTrigger className="text-xs">
                <div className="flex items-center gap-2">
                  {state.loadingStates?.nfts ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Image className="h-3 w-3" />
                  )}
                  Ordinals & NFTs
                  <span className="ml-auto text-muted-foreground">
                    ({state.nfts.length})
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {state.nfts.length === 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Image className="h-8 w-8 text-muted-foreground" />
                      </EmptyMedia>
                      <EmptyTitle className="text-sm">No Ordinals</EmptyTitle>
                      <EmptyDescription className="text-xs">
                        You don't have any ordinals or NFTs yet
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <ItemGroup className="grid grid-cols-2 gap-2">
                    {state.nfts.map((nft, idx) => (
                      <NftItem
                        key={idx}
                        nft={nft}
                        vscode={vscode}
                        isSelected={selectedNfts.has(`${nft.txid}_${nft.vout}`)}
                        onToggleSelect={toggleNftSelection}
                        onSend={handleSendSingle}
                        onSendSelected={handleSendSelected}
                        hasSelection={selectedNfts.size > 0}
                      />
                    ))}
                  </ItemGroup>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Collections Section */}
            <AccordionItem value="collections">
              <AccordionTrigger className="text-xs">
                <div className="flex items-center gap-2">
                  {state.loadingStates?.nfts ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <FolderOpen className="h-3 w-3" />
                  )}
                  Collections
                  <span className="ml-auto text-muted-foreground">
                    ({state.collections.length})
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {state.collections.length === 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <FolderOpen className="h-8 w-8 text-muted-foreground" />
                      </EmptyMedia>
                      <EmptyTitle className="text-sm">No Collections</EmptyTitle>
                      <EmptyDescription className="text-xs">
                        You don't have any NFT collections yet
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <Accordion type="multiple" className="w-full">
                    {state.collections.map((collection) => (
                      <AccordionItem key={collection.id} value={collection.id}>
                        <AccordionTrigger className="text-xs py-2">
                          <div className="flex items-center gap-2 w-full">
                            {collection.icon ? (
                              <img
                                src={`https://ordfs.network/${collection.icon}`}
                                className="h-6 w-6 rounded object-cover"
                                alt={collection.name || 'Collection'}
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  // Show fallback icon by replacing with div
                                  const fallback = document.createElement('div');
                                  fallback.className = 'h-6 w-6 rounded bg-muted flex items-center justify-center';
                                  fallback.innerHTML = '<svg class="h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path></svg>';
                                  e.currentTarget.parentElement?.insertBefore(fallback, e.currentTarget);
                                }}
                              />
                            ) : (
                              <div className="h-6 w-6 rounded bg-muted flex items-center justify-center">
                                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 text-left">
                              <div className="font-medium">{collection.name || collection.id.slice(0, 8) + '...'}</div>
                              {collection.description && (
                                <div className="text-xs text-muted-foreground">{collection.description}</div>
                              )}
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {collection.items.length}
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <ItemGroup className="grid grid-cols-2 gap-2 pl-2">
                            {collection.items.map((nft, idx) => (
                              <NftItem
                                key={idx}
                                nft={nft}
                                vscode={vscode}
                                isSelected={selectedNfts.has(`${nft.txid}_${nft.vout}`)}
                                onToggleSelect={toggleNftSelection}
                                onSend={handleSendSingle}
                                onSendSelected={handleSendSelected}
                                hasSelection={selectedNfts.size > 0}
                              />
                            ))}
                          </ItemGroup>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Tokens Section */}
            <AccordionItem value="tokens">
              <AccordionTrigger className="text-xs">
                <div className="flex items-center gap-2">
                  {(state.loadingStates?.bsv20 || state.loadingStates?.bsv21) ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Coins className="h-3 w-3" />
                  )}
                  Tokens
                  <span className="ml-auto text-muted-foreground">
                    ({state.tokens.bsv20.length + state.tokens.bsv21.length})
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {/* Show empty state only if:
                    - No ordinals key, OR
                    - Both token types disabled, OR
                    - Not loading AND both arrays empty
                */}
                {!state.hasOrdinalsKey ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Coins className="h-8 w-8 text-muted-foreground" />
                      </EmptyMedia>
                      <EmptyTitle className="text-sm">No Ordinals Key</EmptyTitle>
                      <EmptyDescription className="text-xs">
                        Set an ordinals key to view tokens
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (!state.settings.showBsv20 && !state.settings.showBsv21) ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Coins className="h-8 w-8 text-muted-foreground" />
                      </EmptyMedia>
                      <EmptyTitle className="text-sm">Tokens Disabled</EmptyTitle>
                      <EmptyDescription className="text-xs">
                        Enable BSV-20 or BSV-21 in settings to view tokens
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (state.tokens.bsv20.length === 0 && state.tokens.bsv21.length === 0 &&
                     !state.loadingStates?.bsv20 && !state.loadingStates?.bsv21) ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Coins className="h-8 w-8 text-muted-foreground" />
                      </EmptyMedia>
                      <EmptyTitle className="text-sm">No Tokens</EmptyTitle>
                      <EmptyDescription className="text-xs">
                        You don't have any BSV-20 or BSV-21 tokens yet
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <Accordion type="multiple" className="w-full pl-2">
                    <AccordionItem value="bsv20">
                      <AccordionTrigger className="text-xs py-2">
                        <div className="flex items-center gap-2">
                          {state.settings.showBsv20 && state.loadingStates?.bsv20 ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Coins className="h-3 w-3" />
                          )}
                          <Badge variant="default" className="text-xs">BSV-20</Badge>
                          {state.settings.showBsv20 && (
                            <span className="text-muted-foreground">({state.tokens.bsv20.length})</span>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        {!state.settings.showBsv20 ? (
                          <div className="text-center py-4 text-muted-foreground text-xs">
                            <p className="mb-2">BSV-20 tokens are disabled</p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                vscode.postMessage({
                                  command: 'openSettings',
                                  setting: 'bitcoin.wallet.showBsv20'
                                })
                              }}
                              className="h-7 text-xs"
                            >
                              Enable in Settings
                            </Button>
                          </div>
                        ) : state.loadingStates?.bsv20 ? (
                          <div className="text-center py-4 text-muted-foreground text-xs">
                            <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                            <p>Loading BSV-20 tokens...</p>
                          </div>
                        ) : state.tokens.bsv20.length === 0 ? (
                          <div className="text-center py-4 text-muted-foreground text-xs">
                            <p>No BSV-20 tokens found</p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {state.tokens.bsv20.map((token, idx) => (
                              <TokenCard
                                key={idx}
                                token={token}
                                onSend={(t) => {
                                  setSelectedToken(t)
                                  setShowTransferDialog(true)
                                }}
                                onBurn={(t) => {
                                  setSelectedToken(t)
                                  setShowBurnDialog(true)
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="bsv21">
                      <AccordionTrigger className="text-xs py-2">
                        <div className="flex items-center gap-2">
                          {state.loadingStates?.bsv21 ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Coins className="h-3 w-3" />
                          )}
                          <Badge variant="secondary" className="text-xs">BSV-21</Badge>
                          {state.settings.showBsv21 && (
                            <span className="text-muted-foreground">({state.tokens.bsv21.length})</span>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        {!state.settings.showBsv21 ? (
                          <div className="text-center py-4 text-muted-foreground text-xs">
                            <p className="mb-2">BSV-21 tokens are disabled</p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                vscode.postMessage({
                                  command: 'openSettings',
                                  setting: 'bitcoin.wallet.showBsv21'
                                })
                              }}
                              className="h-7 text-xs"
                            >
                              Enable in Settings
                            </Button>
                          </div>
                        ) : state.loadingStates?.bsv21 ? (
                          <div className="text-center py-4 text-muted-foreground text-xs">
                            <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                            <p>Loading BSV-21 tokens...</p>
                          </div>
                        ) : state.tokens.bsv21.length === 0 ? (
                          <div className="text-center py-4 text-muted-foreground text-xs">
                            <p>No BSV-21 tokens found</p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {state.tokens.bsv21.map((token, idx) => (
                              <TokenCard
                                key={idx}
                                token={token}
                                onSend={(t) => {
                                  setSelectedToken(t)
                                  setShowTransferDialog(true)
                                }}
                                onBurn={(t) => {
                                  setSelectedToken(t)
                                  setShowBurnDialog(true)
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Mint Section */}
            <AccordionItem value="mint">
              <AccordionTrigger className="text-xs">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3 w-3" />
                  Mint
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {!state.hasOrdinalsKey ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Sparkles className="h-8 w-8 text-muted-foreground" />
                      </EmptyMedia>
                      <EmptyTitle className="text-sm">No Ordinals Key</EmptyTitle>
                      <EmptyDescription className="text-xs">
                        Set an ordinals key to mint NFTs and tokens
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <Accordion type="multiple" className="w-full pl-2">
                    {/* Mint NFT */}
                    <AccordionItem value="mint-nft">
                      <AccordionTrigger className="text-xs py-2">
                        <div className="flex items-center gap-2">
                          <Image className="h-3 w-3" />
                          Mint NFT
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="text-center py-4 text-muted-foreground text-xs">
                          <p className="mb-2">Inscribe any file as an NFT ordinal</p>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => setShowMintNftDialog(true)}
                            className="h-7 text-xs"
                          >
                            <Sparkles className="h-3 w-3 mr-1" />
                            Mint NFT
                          </Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Mint BSV21 Token */}
                    <AccordionItem value="mint-bsv21">
                      <AccordionTrigger className="text-xs py-2">
                        <div className="flex items-center gap-2">
                          <Coins className="h-3 w-3" />
                          Mint BSV21 Token
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="text-center py-4 text-muted-foreground text-xs">
                          <p className="mb-2">Deploy a new BSV-21 token</p>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => setShowMintBsv21Dialog(true)}
                            className="h-7 text-xs"
                          >
                            <Sparkles className="h-3 w-3 mr-1" />
                            Mint Token
                          </Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Market Section */}
            <AccordionItem value="market">
              <AccordionTrigger className="text-xs">
                <div className="flex items-center gap-2">
                  <Store className="h-3 w-3" />
                  Market
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <MarketTab />
              </AccordionContent>
            </AccordionItem>

            {/* Address Section */}
            <AccordionItem value="address">
              <AccordionTrigger className="text-xs">
                <div className="flex items-center gap-2">
                  <MapPin className="h-3 w-3" />
                  Addresses
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Payment Address</div>
                    <div className="flex items-center gap-2 p-2 bg-muted rounded">
                      <code className="text-xs break-all flex-1">{state.fundingKey.payAddress}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyAddress(state.fundingKey!.payAddress)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Ordinals Address</div>
                    <div className="flex items-center gap-2 p-2 bg-muted rounded">
                      <code className="text-xs break-all flex-1">{state.fundingKey.ordAddress}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyAddress(state.fundingKey!.ordAddress)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </>
      )}

      {/* Floating Action Bar for Selected NFTs */}
      {selectedNfts.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-background border rounded-lg shadow-lg p-1.5 flex items-center gap-1 z-50">
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-mono">
            {selectedNfts.size}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenSelected}
            className="h-6 w-6 p-0"
            title="Open selected"
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            onClick={handleSendSelected}
            className="h-6 w-6 p-0"
            title="Send selected"
          >
            <Send className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDecodeSelected}
            className="h-6 w-6 p-0"
            title="Decode transaction"
          >
            <FileText className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleEvalSelected}
            className="h-6 w-6 p-0"
            title="Evaluate script"
          >
            <Play className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={clearSelection}
            className="h-6 w-6 p-0"
            title="Clear selection"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
    </>
  )
}

// NFT Grid Card Component - displays name, inscription #, and content type
function NftItem({
  nft,
  vscode,
  isSelected = false,
  onToggleSelect,
  onSend,
  onSendSelected,
  hasSelection
}: {
  nft: any
  vscode: any
  isSelected?: boolean
  onToggleSelect?: (nftId: string) => void
  onSend?: (nft: any) => void
  onSendSelected?: () => void
  hasSelection?: boolean
}) {
  const contentType = nft.contentType || 'unknown'
  const hasImage = contentType.startsWith('image/')
  const origin = nft.origin
  const displayName = nft.name || (nft.num ? `#${nft.num}` : null)
  const nftId = `${nft.txid}_${nft.vout}`

  const getTypeLabel = (type: string): string => {
    if (type.startsWith('image/')) return type.replace('image/', '').toUpperCase()
    if (type.startsWith('video/')) return type.replace('video/', '').toUpperCase()
    if (type.startsWith('audio/')) return type.replace('audio/', '').toUpperCase()
    if (type.startsWith('text/')) return type.replace('text/', '').toUpperCase()
    if (type === 'application/json') return 'JSON'
    if (type === 'application/pdf') return 'PDF'
    return type
  }

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.classList.add('opacity-20')
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleSelect?.(nftId)
  }

  const handleOpen = () => {
    vscode.postMessage({
      command: 'downloadOrdinal',
      origin: origin,
      contentType: contentType
    })
  }

  const handleSend = () => {
    // If there's a selection (including this item or others), send all selected
    if (hasSelection) {
      onSendSelected?.()
    } else {
      // Otherwise just send this one item
      onSend?.(nft)
    }
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <Item
          variant="outline"
          className={`cursor-pointer relative group ${isSelected ? 'ring-2 ring-primary bg-accent/50' : ''}`}
          onClick={handleClick}
        >
          {isSelected && (
            <div className="absolute top-2 right-2 z-10 bg-primary rounded-full p-0.5">
              <Check className="h-3 w-3 text-primary-foreground" />
            </div>
          )}
          <ItemHeader>
            {hasImage ? (
              <img
                src={`https://ordfs.network/${origin}`}
                className="aspect-square w-full rounded-sm object-cover"
                alt={displayName || 'NFT'}
                onError={handleImageError}
              />
            ) : (
              <div className="aspect-square w-full rounded-sm bg-muted flex flex-col items-center justify-center gap-2">
                <Image className="h-12 w-12 text-muted-foreground" />
                <span className="text-xs text-muted-foreground text-center break-all px-2">
                  {getTypeLabel(contentType)}
                </span>
              </div>
            )}
          </ItemHeader>
          <ItemContent>
            <ItemTitle className="text-xs">{displayName || 'Unknown'}</ItemTitle>
            <ItemDescription className="text-xs text-muted-foreground">
              {getTypeLabel(contentType)}
              {nft.num && ` • #${nft.num}`}
            </ItemDescription>
          </ItemContent>
        </Item>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handleOpen}>
          <ExternalLink className="mr-2 h-4 w-4" />
          Open
        </ContextMenuItem>
        <ContextMenuItem onClick={handleSend}>
          <Send className="mr-2 h-4 w-4" />
          {hasSelection ? `Send Selected` : 'Send'}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleClick}>
          {isSelected ? (
            <>
              <X className="mr-2 h-4 w-4" />
              Deselect
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Select
            </>
          )}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

// Token Card Component
interface TokenCardProps {
  token: any
  onSend: (token: any) => void
  onBurn: (token: any) => void
}

function TokenCard({ token, onSend, onBurn }: TokenCardProps) {
  const vscode = getVscode()
  const [imgError, setImgError] = useState(false)

  const truncateOutpoint = (outpoint: string): string => {
    if (!outpoint) return ''
    const [txid] = outpoint.split('_')
    return `${txid.slice(0, 8)}...`
  }

  // Get display name based on protocol
  const displayName = token.protocol === 'BSV20'
    ? (token.tick || truncateOutpoint(token.tokenId))
    : (token.sym || truncateOutpoint(token.tokenId))

  const displayUnit = token.protocol === 'BSV20' ? token.tick : token.sym

  // Format price display
  const priceDisplay = token.usdPrice
    ? `$${token.usdPrice.toFixed(2)}`
    : token.price
    ? `${token.price} BSV`
    : null

  const handleTokenClick = () => {
    // Open token on 1sat.market
    const origin = token.tokenId || token.id
    if (origin) {
      const protocol = token.protocol === 'BSV20' ? 'bsv20' : 'bsv21'
      const url = `https://1sat.market/market/${protocol}/${origin}`
      vscode.postMessage({ type: 'openExternal', url })
    }
  }

  return (
    <Item size="sm" className="group cursor-pointer hover:bg-accent/50" onClick={handleTokenClick}>
      <ItemMedia>
        {token.icon && !imgError ? (
          <img
            src={`https://ordfs.network/${token.icon}`}
            className="h-8 w-8 rounded object-cover"
            alt={displayName}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
            <Coins className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{displayName}</ItemTitle>
        <ItemDescription>
          {priceDisplay && <span className="text-muted-foreground mr-2">{priceDisplay}</span>}
          {token.balance.toLocaleString()} {displayUnit || ''}
          {token.contract && <span className="ml-2 text-muted-foreground">• {token.contract}</span>}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation()
            onSend(token)
          }}
          title="Send tokens"
        >
          <Send className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation()
            onBurn(token)
          }}
          title="Burn tokens"
        >
          <Flame className="h-3 w-3" />
        </Button>
      </ItemActions>
    </Item>
  )
}
