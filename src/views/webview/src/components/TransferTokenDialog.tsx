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

type SendState = 'idle' | 'reviewing' | 'sending' | 'success' | 'error'

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
  const [sendState, setSendState] = useState<SendState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [feeEstimate, setFeeEstimate] = useState<any>(null)

  // Reset form when dialog opens/closes or token changes
  useEffect(() => {
    if (open && token) {
      setAmount('')
      setRecipientAddress(isBurn ? ordAddress : '')
      setSendState('idle')
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

  const canReview = !amountError && !addressError && amount && (isBurn || recipientAddress)

  // Handle review - request fee estimate
  const handleReview = async () => {
    if (!canReview || !token) return

    setSendState('reviewing')
    setError(null)

    vscode.postMessage({
      type: 'wallet:transferToken:estimate',
      data: {
        tokenId: token.tokenId,
        protocol: token.protocol,
        amount: parseFloat(amount),
        recipientAddress: isBurn ? ordAddress : recipientAddress
      }
    })
  }

  // Handle back to edit
  const handleBack = () => {
    setSendState('idle')
    setFeeEstimate(null)
  }

  // Send transaction
  const handleConfirm = async () => {
    if (!canReview || !token) return

    setSendState('sending')
    setError(null)

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
  }

  // Listen for responses from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, data } = event.data

      switch (type) {
        case 'wallet:transferToken:estimateResult':
          setFeeEstimate(data)
          break

        case 'wallet:transferToken:success':
          setSendState('success')
          // Close after a brief delay to show success state
          setTimeout(() => {
            onOpenChange(false)
          }, 1500)
          break

        case 'wallet:transferToken:error':
          setError(data.error)
          setSendState('error')
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
          <div className="flex items-center gap-2">
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
            {sendState === 'reviewing' && <Badge variant="secondary">Reviewing</Badge>}
            {sendState === 'sending' && <Badge variant="default">Sending</Badge>}
            {sendState === 'success' && <Badge variant="default" className="bg-green-600">Success</Badge>}
            {sendState === 'error' && <Badge variant="destructive">Failed</Badge>}
          </div>
          <DialogDescription>
            {sendState === 'idle' && (isBurn
              ? 'Burn tokens to remove them from circulation'
              : `Transfer ${tokenName} tokens to another address`)}
            {sendState === 'reviewing' && 'Review transaction details'}
            {sendState === 'sending' && 'Broadcasting transaction...'}
            {sendState === 'success' && 'Transaction sent successfully'}
            {sendState === 'error' && 'Transaction failed'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Input State */}
          {sendState === 'idle' && (
            <>
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
            </>
          )}

          {/* Review State */}
          {sendState === 'reviewing' && feeEstimate && (
            <>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please review the transaction details carefully before confirming.
                </AlertDescription>
              </Alert>

              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Token</div>
                  <div className="flex items-center gap-2 p-2 bg-muted rounded">
                    {token.icon && (
                      <img
                        src={`https://ordfs.network/${token.icon}`}
                        className="h-5 w-5 rounded"
                        alt={tokenName}
                      />
                    )}
                    <span className="font-medium">{tokenName}</span>
                    <Badge variant={token.protocol === 'BSV20' ? 'default' : 'secondary'} className="text-xs">
                      {token.protocol}
                    </Badge>
                  </div>
                </div>

                {!isBurn && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">To</div>
                    <code className="text-xs break-all bg-muted p-2 rounded block">
                      {recipientAddress}
                    </code>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-medium">{amount} {tokenName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transaction Fee</span>
                    <span>{feeEstimate.estimatedFee} sats</span>
                  </div>
                  {feeEstimate.fundingFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Funding Fee</span>
                      <span>{feeEstimate.fundingFee} sats</span>
                    </div>
                  )}
                  <div className="flex justify-between font-medium border-t pt-2">
                    <span>Total Cost</span>
                    <span>{feeEstimate.totalCost} sats</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Sending State */}
          {sendState === 'sending' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-medium">Broadcasting transaction...</p>
                <p className="text-xs text-muted-foreground mt-1">
                  This may take a few moments
                </p>
              </div>
            </div>
          )}

          {/* Error State */}
          {sendState === 'error' && error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          {sendState === 'idle' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleReview} disabled={!canReview}>
                Review
              </Button>
            </>
          )}

          {sendState === 'reviewing' && (
            <>
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button onClick={handleConfirm}>
                {isBurn ? 'Confirm & Burn' : 'Confirm & Send'}
              </Button>
            </>
          )}

          {(sendState === 'success' || sendState === 'error') && (
            <Button onClick={() => onOpenChange(false)} className="w-full">
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
