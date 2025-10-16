import { useState, useEffect, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, Sparkles, Upload, X, Settings } from 'lucide-react'
import { getVscode } from '../vscode'

interface MintBsv21DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ordAddress: string  // Used in dialog but not in component logic
}

type MintState = 'idle' | 'minting' | 'success' | 'error'

export function MintBsv21Dialog({
  open,
  onOpenChange
}: MintBsv21DialogProps) {
  const vscode = getVscode()

  // Form state
  const [symbol, setSymbol] = useState('')
  const [maxSupply, setMaxSupply] = useState('21000000')
  const [decimals, setDecimals] = useState<number | undefined>(undefined)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Icon state
  const [selectedIcon, setSelectedIcon] = useState<File | null>(null)
  const [iconPreview, setIconPreview] = useState<string | null>(null)

  // Mint state
  const [mintState, setMintState] = useState<MintState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [txid, setTxid] = useState('')

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSymbol('')
      setMaxSupply('21000000')
      setDecimals(undefined)
      setShowAdvanced(false)
      setSelectedIcon(null)
      setIconPreview(null)
      setMintState('idle')
      setError(null)
      setTxid('')
    }
  }, [open])

  // Handle icon selection
  const handleIconChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate it's an image
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    // Validate size (max 100KB)
    if (file.size > 100 * 1024) {
      setError('Icon must be smaller than 100KB')
      return
    }

    setSelectedIcon(file)
    setError(null)

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setIconPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }, [])

  // Validation
  const symbolError = useMemo(() => {
    if (!symbol) return null
    if (symbol.length > 255) {
      return 'Symbol must be 255 characters or less'
    }
    return null
  }, [symbol])

  const maxSupplyError = useMemo(() => {
    if (!maxSupply) return 'Max supply is required'
    const num = Number(maxSupply)
    if (isNaN(num) || num <= 0) {
      return 'Max supply must be a positive number'
    }
    if (!Number.isInteger(num)) {
      return 'Max supply must be a whole number'
    }
    return null
  }, [maxSupply])

  const decimalsError = useMemo(() => {
    if (decimals === undefined) return null
    if (decimals < 0 || decimals > 18) {
      return 'Decimals must be between 0 and 18'
    }
    return null
  }, [decimals])

  const canMint = symbol && maxSupply && selectedIcon && !symbolError && !maxSupplyError && !decimalsError

  // Mint BSV21 token
  const handleMint = async () => {
    if (!canMint || !selectedIcon) return

    setMintState('minting')
    setError(null)

    // Read icon as base64
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64Data = (reader.result as string).split(',')[1]
      vscode.postMessage({
        type: 'wallet:mintBsv21',
        data: {
          symbol,
          iconData: base64Data,
          iconType: selectedIcon.type,
          maxSupply: Number(maxSupply),
          decimals: decimals !== undefined ? decimals : 8
        }
      })
    }
    reader.readAsDataURL(selectedIcon)
  }

  // Listen for responses from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, data } = event.data

      switch (type) {
        case 'wallet:mintBsv21:success':
          setTxid(data.txid)
          setMintState('success')
          // Close after a brief delay to show success state
          setTimeout(() => {
            onOpenChange(false)
          }, 2000)
          break

        case 'wallet:mintBsv21:error':
          setError(data.error)
          setMintState('error')
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Mint BSV21 Token
            </DialogTitle>
            {mintState === 'minting' && <Badge variant="default">Minting</Badge>}
            {mintState === 'success' && <Badge variant="default" className="bg-green-600">Success</Badge>}
            {mintState === 'error' && <Badge variant="destructive">Failed</Badge>}
          </div>
          <DialogDescription>
            Deploy a new BSV-21 token with icon and initial supply
          </DialogDescription>
        </DialogHeader>

        {mintState === 'idle' && (
          <div className="space-y-4">
            {/* Symbol */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="symbol">Symbol</Label>
                <span className="text-xs text-muted-foreground">Not required to be unique</span>
              </div>
              <Input
                id="symbol"
                placeholder="e.g. PEPE"
                value={symbol}
                onChange={(e) => {
                  // Prevent spaces and newlines
                  const val = e.target.value.replace(/[\s\n]/g, '')
                  setSymbol(val)
                }}
                maxLength={255}
                className={symbolError ? 'border-destructive' : ''}
              />
              {symbolError && (
                <p className="text-xs text-destructive">{symbolError}</p>
              )}
            </div>

            {/* Icon Upload */}
            <div className="space-y-2">
              <Label htmlFor="icon">Icon</Label>
              <div className="flex items-center gap-4">
                {iconPreview ? (
                  <div className="relative h-20 w-20 rounded-lg overflow-hidden border bg-muted">
                    <img src={iconPreview} alt="Icon preview" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIcon(null)
                        setIconPreview(null)
                      }}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <div className="h-20 w-20 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center bg-muted/50">
                    <Upload className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <Input
                    id="icon"
                    type="file"
                    accept="image/*"
                    onChange={handleIconChange}
                  />
                  <p className="text-xs text-muted-foreground">
                    Max 100KB, square image recommended
                  </p>
                </div>
              </div>
            </div>

            {/* Max Supply */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="maxSupply">Max Supply</Label>
                <span className="text-xs text-muted-foreground">Whole coins</span>
              </div>
              <Input
                id="maxSupply"
                type="text"
                placeholder="21000000"
                value={maxSupply}
                onChange={(e) => {
                  // Only allow digits
                  const val = e.target.value.replace(/[^\d]/g, '')
                  setMaxSupply(val)
                }}
                className={maxSupplyError ? 'border-destructive' : ''}
              />
              {maxSupplyError && (
                <p className="text-xs text-destructive">{maxSupplyError}</p>
              )}
            </div>

            {/* Advanced Options */}
            <div className="space-y-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="h-8 text-xs"
              >
                <Settings className="h-3 w-3 mr-1" />
                {showAdvanced ? 'Hide' : 'Show'} Advanced Options
              </Button>

              {showAdvanced && (
                <div className="space-y-2 pl-4 border-l-2">
                  <Label htmlFor="decimals">Decimal Precision</Label>
                  <Input
                    id="decimals"
                    type="number"
                    min={0}
                    max={18}
                    placeholder="8 (default)"
                    value={decimals !== undefined ? decimals : ''}
                    onChange={(e) => {
                      const val = e.target.value
                      setDecimals(val === '' ? undefined : parseInt(val))
                    }}
                    className={decimalsError ? 'border-destructive' : ''}
                  />
                  {decimalsError && (
                    <p className="text-xs text-destructive">{decimalsError}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Number of decimal places (0-18). Default is 8.
                  </p>
                </div>
              )}
            </div>

            {/* Info */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                BSV-21 tokens are immediately indexed. The entire supply will be minted to your ordinals address.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {mintState === 'minting' && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <p className="text-sm text-muted-foreground">Deploying your token...</p>
          </div>
        )}

        {mintState === 'success' && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-4">
              <Sparkles className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm font-medium mb-2">Token Deployed Successfully!</p>
            <p className="text-xs text-muted-foreground mb-1">{symbol}</p>
            {txid && (
              <p className="text-xs text-muted-foreground font-mono">{txid.slice(0, 16)}...</p>
            )}
          </div>
        )}

        {mintState === 'error' && error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          {mintState === 'idle' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleMint} disabled={!canMint}>
                Mint
              </Button>
            </>
          )}

          {(mintState === 'success' || mintState === 'error') && (
            <Button onClick={() => onOpenChange(false)} className="w-full">
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
