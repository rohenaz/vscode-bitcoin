import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Item, ItemGroup, ItemContent, ItemTitle, ItemDescription, ItemHeader, ItemMedia, ItemActions } from '@/components/ui/item'
import {
  Wallet, RefreshCw, Send, Download, Copy,
  MapPin, Image, Coins, Flame, FolderOpen, Loader2
} from 'lucide-react'
import { getVscode } from '../vscode'
import { SendBsvDialog } from './SendBsvDialog'
import { ReceiveDialog } from './ReceiveDialog'
import { TransferTokenDialog } from './TransferTokenDialog'

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
  isLoading: boolean;
  loadingStates?: {
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
  const [state, setState] = useState<WalletState>({
    fundingKey: null,
    balance: { total: 0, spendable: 0 },
    nfts: [],
    collections: [],
    tokens: { bsv20: [], bsv21: [] },
    isLoading: true,
    isVaultLocked: true,
    lastUpdate: 0
  })
  const [showSendDialog, setShowSendDialog] = useState(false)
  const [showReceiveDialog, setShowReceiveDialog] = useState(false)
  const [showTransferDialog, setShowTransferDialog] = useState(false)
  const [showBurnDialog, setShowBurnDialog] = useState(false)
  const [selectedToken, setSelectedToken] = useState<any>(null)
  // Force re-render key based on vault lock state to ensure UI updates
  const [renderKey, setRenderKey] = useState(0)

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, data } = event.data

      switch (type) {
        case 'wallet:stateUpdate':
          console.log('[WalletTab] Received stateUpdate:', {
            isVaultLocked: data.isVaultLocked,
            hasFundingKey: !!data.fundingKey,
            isLoading: data.isLoading
          })
          setState(prev => {
            // Force re-render if vault lock state changed
            if (prev.isVaultLocked !== data.isVaultLocked) {
              setRenderKey(k => k + 1)
            }
            return { ...prev, ...data }
          })
          break

        case 'wallet:fundingKeyChanged':
          console.log('[WalletTab] Received fundingKeyChanged:', {
            isVaultLocked: data.isVaultLocked,
            hasFundingKey: !!data.fundingKey,
            isLoading: data.isLoading
          })
          setState(data)
          setRenderKey(k => k + 1) // Force re-render on funding key change
          break

        case 'wallet:error':
          console.error('Wallet error:', data.error)
          setState(prev => ({ ...prev, isLoading: false }))
          break
      }
    }

    window.addEventListener('message', handleMessage)

    // Request initial state
    vscode.postMessage({ type: 'wallet:getFundingKey' })

    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Check vault status when tab becomes active
  useEffect(() => {
    if (isActive) {
      vscode.postMessage({ type: 'wallet:checkVaultStatus' })
    }
  }, [isActive])

  const formatBSV = (satoshis: number): string => {
    return (satoshis / 100000000).toFixed(8)
  }

  const formatSats = (satoshis: number): string => {
    return satoshis.toLocaleString()
  }

  const truncateAddress = (address: string): string => {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-6)}`
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

  return (
    <>
      <SendBsvDialog
        open={showSendDialog}
        onOpenChange={setShowSendDialog}
        spendableBalance={state.balance.spendable}
        payAddress={state.fundingKey?.payAddress || ''}
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

      <div key={renderKey} className="wallet-container">
      {/* Header Bar */}
      <div className="wallet-header flex items-center justify-between mb-2 pb-2 border-b">
        <Button
          variant="outline"
          size="sm"
          onClick={openKeyVault}
        >
          <Wallet className="h-3 w-3 mr-2" />
          {state.fundingKey?.label || truncateAddress(state.fundingKey?.payAddress || '') || "Select Key"}
        </Button>

        {state.isLoading ? (
          <div className="flex items-center gap-2 px-2">
            <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Loading...</span>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Empty State - Vault Locked or No Funding Key */}
      {!state.fundingKey && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Wallet className="h-12 w-12 text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle>
              {state.isVaultLocked ? 'Vault Locked' : 'No Funding Key Selected'}
            </EmptyTitle>
            <EmptyDescription>
              {state.isVaultLocked
                ? 'Unlock your Key Vault to access your wallet, ordinals, and tokens'
                : 'Set a funding key in the Key Vault to view your wallet, ordinals, and tokens'
              }
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={openKeyVault}>
              {state.isVaultLocked ? 'Unlock Vault' : 'Open Key Vault'}
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
              <div className="grid grid-cols-3 gap-2 mt-4">
                <Button
                  onClick={handleSend}
                  disabled={state.balance.spendable === 0}
                  size="sm"
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
                      <NftItem key={idx} nft={nft} vscode={vscode} />
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
                              <NftItem key={idx} nft={nft} vscode={vscode} />
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
                {state.tokens.bsv20.length === 0 && state.tokens.bsv21.length === 0 ? (
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
                  <Accordion type="multiple" className="w-full">
                    {(state.tokens.bsv20.length > 0 || state.loadingStates?.bsv20) && (
                      <AccordionItem value="bsv20">
                        <AccordionTrigger className="text-xs py-2">
                          <div className="flex items-center gap-2">
                            {state.loadingStates?.bsv20 ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Coins className="h-3 w-3" />
                            )}
                            <Badge variant="default" className="text-xs">BSV-20</Badge>
                            <span className="text-muted-foreground">({state.tokens.bsv20.length})</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
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
                        </AccordionContent>
                      </AccordionItem>
                    )}
                    {(state.tokens.bsv21.length > 0 || state.loadingStates?.bsv21) && (
                      <AccordionItem value="bsv21">
                        <AccordionTrigger className="text-xs py-2">
                          <div className="flex items-center gap-2">
                            {state.loadingStates?.bsv21 ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Coins className="h-3 w-3" />
                            )}
                            <Badge variant="secondary" className="text-xs">BSV-21</Badge>
                            <span className="text-muted-foreground">({state.tokens.bsv21.length})</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
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
                        </AccordionContent>
                      </AccordionItem>
                    )}
                  </Accordion>
                )}
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
    </div>
    </>
  )
}

// NFT Grid Card Component - displays name, inscription #, and content type
function NftItem({ nft, vscode }: { nft: any; vscode: any }) {
  const contentType = nft.contentType || 'unknown'
  const hasImage = contentType.startsWith('image/')
  const origin = nft.origin
  const displayName = nft.name || (nft.num ? `#${nft.num}` : null)

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

  const handleOpenInVscode = () => {
    vscode.postMessage({
      command: 'downloadOrdinal',
      origin: origin,
      contentType: contentType
    })
  }

  return (
    <Item variant="outline" className="cursor-pointer" onClick={handleOpenInVscode}>
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
  )
}

// Token Card Component
interface TokenCardProps {
  token: any
  onSend: (token: any) => void
  onBurn: (token: any) => void
}

function TokenCard({ token, onSend, onBurn }: TokenCardProps) {
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

  return (
    <Item size="sm" className="group">
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
