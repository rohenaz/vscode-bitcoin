import { useState, useEffect, useMemo } from 'react'
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
import { Loader2, AlertCircle, Send, Flame } from 'lucide-react'
import { getVscode } from '../vscode'

interface Token {
  protocol: 'BSV20' | 'BSV21'
  tokenId: string
  tick?: string
  sym?: string
  balance: number
  decimals: number
  icon?: string
}

interface TransferTokenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  token: Token | null
  ordAddress: string
  isBurn?: boolean
}

export function TransferTokenDialog({
  open,
  onOpenChange,
  token,
  ordAddress,
  isBurn = false
}: TransferTokenDialogProps) {
  const vscode = getVscode()
  const [amount, setAmount] = useState('')
  const [recipientAddress, setRecipientAddress] = useState('')
  const [isEstimating, setIsEstimating] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feeEstimate, setFeeEstimate] = useState<any>(null)

  // Reset form when dialog opens/closes or token changes
  useEffect(() => {
    if (open && token) {
      setAmount('')
      setRecipientAddress(isBurn ? ordAddress : '')
      setError(null)
      setFeeEstimate(null)
    }
  }, [open, token, isBurn, ordAddress])

  // Calculate decimal places for input
  const step = useMemo(() => {
    if (!token) return '1'
    if (token.decimals === 0) return '1'
    return `0.${'0'.repeat(token.decimals - 1)}1`
  }, [token])

  // Validate amount
  const amountError = useMemo(() => {
    if (!amount || !token) return null
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      return 'Amount must be greater than 0'
    }
    if (numAmount > token.balance) {
      return `Insufficient balance. You have ${token.balance.toLocaleString()} ${token.tick || token.sym}`
    }
    // Check decimal places
    const decimalPlaces = (amount.split('.')[1] || '').length
    if (decimalPlaces > token.decimals) {
      return `Maximum ${token.decimals} decimal places allowed`
    }
    return null
  }, [amount, token])

  // Validate address
  const addressError = useMemo(() => {
    if (isBurn) return null // No address validation for burning
    if (!recipientAddress) return null
    // Basic validation - starts with 1 and is ~34 characters
    if (!/^1[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(recipientAddress)) {
      return 'Invalid Bitcoin address'
    }
    return null
  }, [recipientAddress, isBurn])

  const canEstimate = !amountError && !addressError && amount && (isBurn || recipientAddress)

  // Estimate fee
  const handleEstimate = async () => {
    if (!canEstimate || !token) return

    setIsEstimating(true)
    setError(null)

    try {
      vscode.postMessage({
        type: 'wallet:transferToken:estimate',
        data: {
          tokenId: token.tokenId,
          protocol: token.protocol,
          amount: parseFloat(amount),
          recipientAddress: isBurn ? ordAddress : recipientAddress
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to estimate fee')
      setIsEstimating(false)
    }
  }

  // Send transaction
  const handleSend = async () => {
    if (!canEstimate || !token) return

    setIsSending(true)
    setError(null)

    try {
      vscode.postMessage({
        type: 'wallet:transferToken:send',
        data: {
          tokenId: token.tokenId,
          protocol: token.protocol,
          amount: parseFloat(amount),
          recipientAddress: isBurn ? ordAddress : recipientAddress,
          isBurn
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send transaction')
      setIsSending(false)
    }
  }

  // Listen for responses from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, data } = event.data

      switch (type) {
        case 'wallet:transferToken:estimateResult':
          setFeeEstimate(data)
          setIsEstimating(false)
          break

        case 'wallet:transferToken:success':
          setIsSending(false)
          onOpenChange(false)
          // TODO: Show success notification with txid
          break

        case 'wallet:transferToken:error':
          setError(data.error)
          setIsSending(false)
          setIsEstimating(false)
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onOpenChange])

  if (!token) return null

  const tokenName = token.tick || token.sym || token.tokenId

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isBurn ? (
              <>
                <Flame className="h-4 w-4" />
                Burn {tokenName}
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send {tokenName}
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isBurn
              ? 'Burn tokens to remove them from circulation'
              : `Transfer ${tokenName} tokens to another address`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Token Info */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              {token.icon && (
                <img
                  src={`https://ordfs.network/${token.icon}`}
                  className="h-6 w-6 rounded"
                  alt={tokenName}
                />
              )}
              <div>
                <div className="font-medium text-sm">{tokenName}</div>
                <div className="text-xs text-muted-foreground">
                  Balance: {token.balance.toLocaleString()}
                </div>
              </div>
            </div>
            <Badge variant={token.protocol === 'BSV20' ? 'default' : 'secondary'}>
              {token.protocol}
            </Badge>
          </div>

          {/* Amount Input */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="amount">Amount</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => setAmount(token.balance.toString())}
              >
                Max
              </Button>
            </div>
            <Input
              id="amount"
              type="number"
              placeholder={`0.${'0'.repeat(token.decimals)}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              step={step}
              min={step}
              max={token.balance}
            />
            {amountError && (
              <p className="text-sm text-destructive">{amountError}</p>
            )}
          </div>

          {/* Recipient Address (not shown for burn) */}
          {!isBurn && (
            <div className="grid gap-2">
              <Label htmlFor="address">Recipient Address</Label>
              <Input
                id="address"
                type="text"
                placeholder="1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
              />
              {addressError && (
                <p className="text-sm text-destructive">{addressError}</p>
              )}
            </div>
          )}

          {/* Fee Estimate */}
          {feeEstimate && (
            <Alert>
              <AlertDescription>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span>Transaction Fee:</span>
                    <span className="font-medium">{feeEstimate.estimatedFee} sats</span>
                  </div>
                  {feeEstimate.fundingFee > 0 && (
                    <div className="flex justify-between">
                      <span>Funding Fee:</span>
                      <span className="font-medium">{feeEstimate.fundingFee} sats</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-1">
                    <span>Total Cost:</span>
                    <span className="font-medium">{feeEstimate.totalCost} sats</span>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Cancel
          </Button>
          {!feeEstimate ? (
            <Button
              onClick={handleEstimate}
              disabled={!canEstimate || isEstimating}
            >
              {isEstimating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Estimate Fee
            </Button>
          ) : (
            <Button
              onClick={handleSend}
              disabled={isSending || !!amountError || !!addressError}
            >
              {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isBurn ? 'Burn Tokens' : 'Send Tokens'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
