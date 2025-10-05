import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import {
  Wallet, RefreshCw, Send, Download, Copy,
  Zap, MapPin, Image, Coins
} from 'lucide-react'
import { getVscode } from '../vscode'
import { cn } from '@/lib/utils'
import { SendBsvDialog } from './SendBsvDialog'
import { ReceiveDialog } from './ReceiveDialog'

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
  nfts: any[];
  tokens: {
    bsv20: any[];
    bsv21: any[];
  };
  isLoading: boolean;
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
    tokens: { bsv20: [], bsv21: [] },
    isLoading: true,
    isVaultLocked: true,
    lastUpdate: 0
  })
  const [showSendDialog, setShowSendDialog] = useState(false)
  const [showReceiveDialog, setShowReceiveDialog] = useState(false)

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, data } = event.data

      switch (type) {
        case 'wallet:stateUpdate':
          console.log('[WalletTab] Received stateUpdate:', {
            isVaultLocked: data.isVaultLocked,
            hasFundingKey: !!data.fundingKey
          })
          setState(prev => ({ ...prev, ...data, isLoading: false }))
          break

        case 'wallet:fundingKeyChanged':
          console.log('[WalletTab] Received fundingKeyChanged:', {
            isVaultLocked: data.isVaultLocked,
            hasFundingKey: !!data.fundingKey
          })
          setState(data)
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

      <div className="wallet-container">
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

        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={state.isLoading}
        >
          <RefreshCw className={cn("h-3 w-3", state.isLoading && "animate-spin")} />
        </Button>
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
            </CardContent>
          </Card>

          {/* Accordion Sections */}
          <Accordion type="multiple" className="w-full">
            {/* Actions Section */}
            <AccordionItem value="actions">
              <AccordionTrigger className="text-xs">
                <div className="flex items-center gap-2">
                  <Zap className="h-3 w-3" />
                  Actions
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start text-xs"
                    onClick={handleSend}
                    disabled={state.balance.spendable === 0}
                  >
                    <Send className="h-3 w-3 mr-2" />
                    Send BSV
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start text-xs"
                    onClick={handleReceive}
                  >
                    <Download className="h-3 w-3 mr-2" />
                    Receive
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* NFTs/Ordinals Section */}
            <AccordionItem value="nfts">
              <AccordionTrigger className="text-xs">
                <div className="flex items-center gap-2">
                  <Image className="h-3 w-3" />
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
                  <div className="grid gap-1">
                    {state.nfts.map((nft, idx) => (
                      <NftCard key={idx} nft={nft} vscode={vscode} />
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Tokens Section */}
            <AccordionItem value="tokens">
              <AccordionTrigger className="text-xs">
                <div className="flex items-center gap-2">
                  <Coins className="h-3 w-3" />
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
                  <div className="space-y-2">
                    {state.tokens.bsv20.length > 0 && (
                      <div>
                        <div className="text-xs font-medium mb-1">BSV-20</div>
                        {state.tokens.bsv20.map((token, idx) => (
                          <TokenCard key={idx} token={token} />
                        ))}
                      </div>
                    )}
                    {state.tokens.bsv21.length > 0 && (
                      <div>
                        <div className="text-xs font-medium mb-1">BSV-21</div>
                        {state.tokens.bsv21.map((token, idx) => (
                          <TokenCard key={idx} token={token} />
                        ))}
                      </div>
                    )}
                  </div>
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

// NFT Card Component
function NftCard({ nft, vscode }: { nft: any; vscode: any }) {
  const contentType = nft.data?.insc?.file?.type || 'unknown'
  const hasImage = contentType.startsWith('image/')
  const origin = nft.origin || `${nft.txid}_${nft.vout}`

  const truncateOutpoint = (outpoint: string): string => {
    if (!outpoint) return ''
    const [txid] = outpoint.split('_')
    return `${txid.slice(0, 8)}...`
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="justify-start text-xs h-auto py-2"
      onClick={() => {
        vscode.postMessage({
          command: 'openExternal',
          url: `https://ordinals.gorillapool.io/inscription/${origin}`
        })
      }}
    >
      <div className="flex items-center gap-2 w-full">
        {hasImage ? (
          <img
            src={`https://ordinals.gorillapool.io/content/${origin}`}
            className="h-8 w-8 rounded object-cover"
            alt="NFT"
          />
        ) : (
          <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
            <Image className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 text-left">
          <div className="font-medium">{truncateOutpoint(origin)}</div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs py-0 h-5">
              {contentType}
            </Badge>
          </div>
        </div>
      </div>
    </Button>
  )
}

// Token Card Component
function TokenCard({ token }: { token: any }) {
  const truncateOutpoint = (outpoint: string): string => {
    if (!outpoint) return ''
    const [txid] = outpoint.split('_')
    return `${txid.slice(0, 8)}...`
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="justify-start text-xs h-auto py-2"
    >
      <div className="flex items-center gap-2 w-full">
        {token.icon ? (
          <img
            src={`https://ordinals.gorillapool.io/content/${token.icon}`}
            className="h-6 w-6 rounded"
            alt={token.tick}
          />
        ) : (
          <div className="h-6 w-6 rounded bg-muted flex items-center justify-center">
            <Coins className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 text-left">
          <div className="font-medium">{token.tick || truncateOutpoint(token.tokenId)}</div>
          <div className="text-xs text-muted-foreground">
            {token.balance.toLocaleString()} {token.tick}
          </div>
        </div>
        <Badge variant={token.protocol === 'BSV20' ? 'default' : 'secondary'} className="text-xs">
          {token.protocol}
        </Badge>
      </div>
    </Button>
  )
}
