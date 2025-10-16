import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Item, ItemMedia, ItemContent, ItemHeader, ItemTitle, ItemDescription, ItemFooter } from '@/components/ui/item'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Loader2, Store, Image, Coins, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { getVscode } from '../vscode'
import type { OrdUtxo, MarketData } from '../../../../services/marketService'

type AssetType = 'ordinals' | 'bsv20' | 'bsv21'

// Union type for market listings (matches 1sat-website types)
type MarketListing = OrdUtxo | MarketData

interface MarketState {
  ordinals: OrdUtxo[]
  bsv20: MarketData[]
  bsv21: MarketData[]
  loading: {
    ordinals: boolean
    bsv20: boolean
    bsv21: boolean
  }
  error: {
    ordinals: string | null
    bsv20: string | null
    bsv21: string | null
  }
}

export function MarketTab() {
  const vscode = getVscode()
  const [activeTab, setActiveTab] = useState<AssetType>('ordinals')
  const [marketState, setMarketState] = useState<MarketState>({
    ordinals: [],
    bsv20: [],
    bsv21: [],
    loading: {
      ordinals: false,
      bsv20: false,
      bsv21: false
    },
    error: {
      ordinals: null,
      bsv20: null,
      bsv21: null
    }
  })

  // Fetch market data when tab changes
  useEffect(() => {
    if (marketState[activeTab].length === 0 && !marketState.loading[activeTab]) {
      fetchMarketData(activeTab)
    }
  }, [activeTab])

  const fetchMarketData = (assetType: AssetType) => {
    setMarketState(prev => ({
      ...prev,
      loading: { ...prev.loading, [assetType]: true },
      error: { ...prev.error, [assetType]: null }
    }))

    vscode.postMessage({
      type: 'market:getListings',
      data: {
        assetType,
        limit: 100,
        sort: 'most_recent_sale',
        dir: 'desc'
      }
    })
  }

  const handleListingClick = (listing: MarketListing, assetType: AssetType) => {
    const protocol = assetType === 'bsv20' ? 'bsv20' : assetType === 'bsv21' ? 'bsv21' : 'ord'
    // For tokens (MarketData), use id. For ordinals (OrdUtxo), use outpoint
    const id = assetType === 'ordinals'
      ? (listing as OrdUtxo).outpoint
      : (listing as MarketData).id
    vscode.postMessage({
      type: 'openExternal',
      url: `https://1sat.market/market/${protocol}/${id}`
    })
  }

  // Listen for market data updates
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, data } = event.data

      if (type === 'market:listings') {
        setMarketState(prev => ({
          ...prev,
          [data.assetType]: data.listings,
          loading: { ...prev.loading, [data.assetType]: false }
        }))
      } else if (type === 'market:error') {
        setMarketState(prev => ({
          ...prev,
          loading: { ...prev.loading, [data.assetType]: false },
          error: { ...prev.error, [data.assetType]: data.error }
        }))
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const formatPrice = (satoshis: number) => {
    const bsv = satoshis / 100000000
    if (bsv >= 1) {
      return `${bsv.toLocaleString(undefined, { maximumFractionDigits: 2 })} BSV`
    }
    return `${satoshis.toLocaleString()} sats`
  }

  const formatMarketCap = (marketCap: number) => {
    if (marketCap >= 1000000) {
      return `${(marketCap / 1000000).toFixed(2)}M BSV`
    } else if (marketCap >= 1000) {
      return `${(marketCap / 1000).toFixed(2)}K BSV`
    }
    return `${marketCap.toFixed(2)} BSV`
  }

  const formatPctChange = (pctChange: number) => {
    if (pctChange > 0) {
      return (
        <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          +{pctChange.toFixed(2)}%
        </span>
      )
    } else if (pctChange < 0) {
      return (
        <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
          <TrendingDown className="h-3 w-3" />
          {pctChange.toFixed(2)}%
        </span>
      )
    }
    return (
      <span className="text-muted-foreground flex items-center gap-1">
        <Minus className="h-3 w-3" />
        0.00%
      </span>
    )
  }

  const renderMarketListings = (assetType: AssetType) => {
    const { loading, error } = marketState
    const listings = marketState[assetType]

    if (loading[assetType]) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )
    }

    if (error[assetType]) {
      return (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Store className="h-8 w-8 text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle className="text-sm">Error Loading Market</EmptyTitle>
            <EmptyDescription className="text-xs">{error[assetType]}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )
    }

    if (listings.length === 0) {
      return (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Store className="h-8 w-8 text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle className="text-sm">No Market Listings</EmptyTitle>
            <EmptyDescription className="text-xs">
              No {assetType} listings available
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )
    }

    return (
      <div className="space-y-1">
        {listings.map((listing, index) => {
          const isOrdinal = assetType === 'ordinals'
          const ordListing = isOrdinal ? (listing as OrdUtxo) : null
          const tokenListing = !isOrdinal ? (listing as MarketData) : null

          // Get display values based on type
          const displayIcon = tokenListing?.icon
          const displayTitle = isOrdinal
            ? `Ordinal #${ordListing?.origin?.num || ordListing?.outpoint.slice(0, 8)}`
            : (tokenListing?.tick || tokenListing?.sym || tokenListing?.id.slice(0, 8))
          const displayPrice = isOrdinal ? ordListing?.satoshis || 0 : tokenListing?.price || 0
          const displaySubtext = isOrdinal
            ? `${ordListing?.outpoint.slice(0, 8)}...`
            : formatMarketCap(tokenListing?.marketCap || 0)
          const key = isOrdinal ? ordListing?.outpoint : tokenListing?.id

          return (
            <Item
              key={`${key}-${index}`}
              size="sm"
              className="cursor-pointer hover:bg-accent/50"
              onClick={() => handleListingClick(listing, assetType)}
            >
              <ItemMedia>
                {displayIcon ? (
                  <img
                    src={`https://ordfs.network/${displayIcon}`}
                    className="h-8 w-8 rounded object-cover"
                    alt={displayTitle}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                      target.nextElementSibling?.classList.remove('hidden')
                    }}
                  />
                ) : null}
                <div className={`h-8 w-8 rounded bg-muted flex items-center justify-center ${displayIcon ? 'hidden' : ''}`}>
                  {isOrdinal ? (
                    <Image className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Coins className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </ItemMedia>
              <ItemContent>
                <ItemHeader>
                  <ItemTitle className="text-xs">
                    {displayTitle}
                  </ItemTitle>
                  <ItemDescription className="text-xs">
                    {formatPrice(displayPrice)}
                  </ItemDescription>
                </ItemHeader>
                <ItemFooter className="text-xs text-muted-foreground flex items-center justify-between">
                  <span>{displaySubtext}</span>
                  {!isOrdinal && tokenListing?.pctChange !== undefined && (
                    <span className="flex items-center gap-1">
                      {formatPctChange(tokenListing.pctChange)}
                    </span>
                  )}
                </ItemFooter>
              </ItemContent>
            </Item>
          )
        })}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AssetType)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ordinals" className="text-xs">
            <Image className="h-3 w-3 mr-1" />
            Ordinals
          </TabsTrigger>
          <TabsTrigger value="bsv20" className="text-xs">
            <Coins className="h-3 w-3 mr-1" />
            BSV20
          </TabsTrigger>
          <TabsTrigger value="bsv21" className="text-xs">
            <Coins className="h-3 w-3 mr-1" />
            BSV21
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ordinals" className="flex-1 overflow-auto">
          {renderMarketListings('ordinals')}
        </TabsContent>

        <TabsContent value="bsv20" className="flex-1 overflow-auto">
          {renderMarketListings('bsv20')}
        </TabsContent>

        <TabsContent value="bsv21" className="flex-1 overflow-auto">
          {renderMarketListings('bsv21')}
        </TabsContent>
      </Tabs>
    </div>
  )
}
