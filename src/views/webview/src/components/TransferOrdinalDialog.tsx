import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, Send, AlertCircle } from 'lucide-react'

interface TransferOrdinalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedNfts: any[]
  vscode: any
}

interface EstimateResult {
  success: boolean
  fee?: number
  estimatedSize?: number
  error?: string
}

interface TransferResult {
  success: boolean
  txid?: string
  fee?: number
  error?: string
}

export function TransferOrdinalDialog({
  open,
  onOpenChange,
  selectedNfts,
  vscode
}: TransferOrdinalDialogProps) {
  const [recipientAddress, setRecipientAddress] = useState('')
  const [estimate, setEstimate] = useState<EstimateResult | null>(null)
  const [estimating, setEstimating] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<TransferResult | null>(null)

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setRecipientAddress('')
      setEstimate(null)
      setResult(null)
      setEstimating(false)
      setSending(false)
    }
  }, [open])

  // Listen for estimate results
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data

      if (message.type === 'ordinal:transfer:estimateResult') {
        setEstimating(false)
        setEstimate(message.data)
      } else if (message.type === 'ordinal:transfer:result') {
        setSending(false)
        setResult(message.data)

        if (message.data.success) {
          // Close dialog after successful send
          setTimeout(() => {
            onOpenChange(false)
          }, 2000)
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onOpenChange])

  const handleEstimate = () => {
    if (!recipientAddress) return

    setEstimating(true)
    setEstimate(null)
    setResult(null)

    vscode.postMessage({
      type: 'ordinal:transfer:estimate',
      data: {
        nfts: selectedNfts,
        recipientAddress
      }
    })
  }

  const handleSend = () => {
    if (!recipientAddress || !estimate?.success) return

    setSending(true)
    setResult(null)

    vscode.postMessage({
      type: 'ordinal:transfer:send',
      data: {
        nfts: selectedNfts,
        recipientAddress
      }
    })
  }

  const isValidAddress = recipientAddress.match(/^1[a-km-zA-HJ-NP-Z1-9]{25,34}$/)
  const canEstimate = isValidAddress && !estimating && !sending
  const canSend = estimate?.success && !estimating && !sending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Send Ordinals</DialogTitle>
          <DialogDescription>
            Send {selectedNfts.length} ordinal{selectedNfts.length !== 1 ? 's' : ''} to a recipient address
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Selected NFTs Summary */}
          <div className="flex flex-wrap gap-2">
            {selectedNfts.slice(0, 5).map((nft, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {nft.name || `#${nft.num}` || 'NFT'}
              </Badge>
            ))}
            {selectedNfts.length > 5 && (
              <Badge variant="secondary" className="text-xs">
                +{selectedNfts.length - 5} more
              </Badge>
            )}
          </div>

          {/* Recipient Address */}
          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient Address</Label>
            <Input
              id="recipient"
              placeholder="1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              onBlur={handleEstimate}
              disabled={sending}
            />
            {recipientAddress && !isValidAddress && (
              <p className="text-xs text-destructive">Invalid Bitcoin address</p>
            )}
          </div>

          {/* Estimate Button */}
          {!estimate && canEstimate && (
            <Button
              onClick={handleEstimate}
              disabled={!canEstimate}
              variant="outline"
              className="w-full"
            >
              Estimate Fee
            </Button>
          )}

          {/* Estimating */}
          {estimating && (
            <div className="flex items-center justify-center gap-2 py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Estimating fee...</span>
            </div>
          )}

          {/* Estimate Result */}
          {estimate && estimate.success && (
            <Alert>
              <AlertDescription className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Fee:</span>
                  <span className="font-mono">{estimate.fee} sats</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Size:</span>
                  <span className="font-mono">~{estimate.estimatedSize} bytes</span>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Estimate Error */}
          {estimate && !estimate.success && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {estimate.error || 'Failed to estimate fee'}
              </AlertDescription>
            </Alert>
          )}

          {/* Send Result */}
          {result && (
            <Alert variant={result.success ? 'default' : 'destructive'}>
              {result.success ? (
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">Transaction sent successfully!</p>
                    <p className="text-xs font-mono">{result.txid?.slice(0, 16)}...</p>
                  </div>
                </AlertDescription>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {result.error || 'Failed to send transaction'}
                  </AlertDescription>
                </>
              )}
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!canSend}
          >
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send {selectedNfts.length} Ordinal{selectedNfts.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
