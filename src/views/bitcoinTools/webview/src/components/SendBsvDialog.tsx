import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Loader2, CheckCircle2, XCircle, AlertCircle, ArrowRight } from 'lucide-react'
import { getVscode } from '../vscode'

interface SendBsvDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  spendableBalance: number
  payAddress: string
}

// interface SendBsvResponse {
//   success: boolean
//   txid?: string
//   fee?: number
//   error?: string
//   message?: string
// }

type SendState = 'idle' | 'confirming' | 'broadcasting' | 'success' | 'error'

export function SendBsvDialog({ open, onOpenChange, spendableBalance, payAddress }: SendBsvDialogProps) {
  const vscode = getVscode()

  // Form state
  const [recipientAddress, setRecipientAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [usesSats, setUsesSats] = useState(false)

  // Transaction state
  const [sendState, setSendState] = useState<SendState>('idle')
  const [estimatedFee, setEstimatedFee] = useState(0)
  const [txid, setTxid] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  // Validation
  const [addressError, setAddressError] = useState('')
  const [amountError, setAmountError] = useState('')

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      // Reset after animation completes
      setTimeout(() => {
        setRecipientAddress('')
        setAmount('')
        setUsesSats(false)
        setSendState('idle')
        setEstimatedFee(0)
        setTxid('')
        setErrorMessage('')
        setAddressError('')
        setAmountError('')
      }, 300)
    }
  }, [open])

  // Listen for responses from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, data } = event.data

      if (type === 'wallet:sendBsv:estimate') {
        if (data.success) {
          setEstimatedFee(data.fee || 0)
          setSendState('confirming')
        } else {
          setErrorMessage(data.error || 'Failed to estimate fee')
          setSendState('error')
        }
      }

      if (type === 'wallet:sendBsv:result') {
        if (data.success) {
          setTxid(data.txid || '')
          setSendState('success')
        } else {
          setErrorMessage(data.error || 'Transaction failed')
          setSendState('error')
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Parse amount to satoshis
  const getAmountInSats = (): number => {
    if (!amount) return 0
    const parsed = parseFloat(amount)
    if (isNaN(parsed)) return 0
    return usesSats ? Math.floor(parsed) : Math.floor(parsed * 100000000)
  }

  // Format BSV
  const formatBSV = (satoshis: number): string => {
    return (satoshis / 100000000).toFixed(8)
  }

  // Format sats
  const formatSats = (satoshis: number): string => {
    return satoshis.toLocaleString()
  }

  // Validate address
  const validateAddress = (addr: string): boolean => {
    if (!addr) {
      setAddressError('Address is required')
      return false
    }

    // Basic P2PKH mainnet validation
    if (!/^1[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(addr)) {
      setAddressError('Invalid Bitcoin address')
      return false
    }

    // Check not sending to self
    if (addr === payAddress) {
      setAddressError('Cannot send to your own address')
      return false
    }

    setAddressError('')
    return true
  }

  // Validate amount
  const validateAmount = (): boolean => {
    const sats = getAmountInSats()

    if (!amount || sats <= 0) {
      setAmountError('Amount must be greater than 0')
      return false
    }

    if (sats > spendableBalance) {
      setAmountError('Insufficient balance')
      return false
    }

    setAmountError('')
    return true
  }

  // Toggle BSV/sats
  const toggleUnit = () => {
    if (amount) {
      const sats = getAmountInSats()
      if (usesSats) {
        // Convert to BSV
        setAmount(formatBSV(sats))
      } else {
        // Convert to sats
        setAmount(sats.toString())
      }
    }
    setUsesSats(!usesSats)
  }

  // Set max amount
  const setMaxAmount = () => {
    // Leave room for fee (estimate ~500 sats for typical tx)
    const maxSendable = Math.max(0, spendableBalance - 500)
    if (usesSats) {
      setAmount(maxSendable.toString())
    } else {
      setAmount(formatBSV(maxSendable))
    }
    setAmountError('')
  }

  // Handle send/review
  const handleReview = () => {
    const isAddressValid = validateAddress(recipientAddress)
    const isAmountValid = validateAmount()

    if (isAddressValid && isAmountValid) {
      setSendState('confirming')

      // Request fee estimate from extension
      vscode.postMessage({
        type: 'wallet:sendBsv:estimate',
        data: {
          recipientAddress,
          satoshis: getAmountInSats()
        }
      })
    }
  }

  // Handle confirm send
  const handleConfirm = () => {
    setSendState('broadcasting')

    vscode.postMessage({
      type: 'wallet:sendBsv:send',
      data: {
        recipientAddress,
        satoshis: getAmountInSats()
      }
    })
  }

  // Handle back to edit
  const handleBack = () => {
    setSendState('idle')
    setEstimatedFee(0)
  }

  // Handle close
  const handleClose = () => {
    if (sendState === 'success') {
      // Refresh wallet balance
      vscode.postMessage({ type: 'wallet:refreshBalance' })
    }
    onOpenChange(false)
  }

  // View transaction
  const viewTransaction = () => {
    if (txid) {
      vscode.postMessage({
        command: 'openExternal',
        url: `https://whatsonchain.com/tx/${txid}`
      })
    }
  }

  // Calculate total with fee
  const totalWithFee = getAmountInSats() + estimatedFee

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>Send BSV</DialogTitle>
            {sendState === 'confirming' && <Badge variant="secondary">Reviewing</Badge>}
            {sendState === 'broadcasting' && <Badge variant="default">Sending</Badge>}
            {sendState === 'success' && <Badge variant="default" className="bg-green-600">Success</Badge>}
            {sendState === 'error' && <Badge variant="destructive">Failed</Badge>}
          </div>
          <DialogDescription>
            {sendState === 'idle' && 'Enter recipient and amount'}
            {sendState === 'confirming' && 'Review transaction details'}
            {sendState === 'broadcasting' && 'Broadcasting transaction...'}
            {sendState === 'success' && 'Transaction sent successfully'}
            {sendState === 'error' && 'Transaction failed'}
          </DialogDescription>
        </DialogHeader>

        {/* Form - Input State */}
        {sendState === 'idle' && (
          <div className="space-y-4">
            {/* Recipient Address */}
            <div className="space-y-2">
              <Label htmlFor="recipient">Recipient Address</Label>
              <Input
                id="recipient"
                placeholder="1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
                value={recipientAddress}
                onChange={(e) => {
                  setRecipientAddress(e.target.value)
                  setAddressError('')
                }}
                onBlur={() => validateAddress(recipientAddress)}
                className={addressError ? 'border-red-500' : ''}
              />
              {addressError && (
                <p className="text-xs text-red-500">{addressError}</p>
              )}
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="amount">Amount</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={setMaxAmount}
                  >
                    Max
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={toggleUnit}
                  >
                    {usesSats ? 'sats' : 'BSV'}
                  </Button>
                </div>
              </div>
              <Input
                id="amount"
                type="number"
                step={usesSats ? '1' : '0.00000001'}
                min="0"
                placeholder={usesSats ? '100000' : '0.001'}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value)
                  setAmountError('')
                }}
                onBlur={validateAmount}
                className={amountError ? 'border-red-500' : ''}
              />
              {amountError && (
                <p className="text-xs text-red-500">{amountError}</p>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {usesSats
                    ? formatBSV(getAmountInSats()) + ' BSV'
                    : formatSats(getAmountInSats()) + ' sats'}
                </span>
                <span>Available: {formatBSV(spendableBalance)} BSV</span>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation State */}
        {sendState === 'confirming' && (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please review the transaction details carefully before confirming.
              </AlertDescription>
            </Alert>

            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground mb-1">To</div>
                <code className="text-xs break-all bg-muted p-2 rounded block">
                  {recipientAddress}
                </code>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium">
                    {formatBSV(getAmountInSats())} BSV
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fee</span>
                  <span>{formatBSV(estimatedFee)} BSV</span>
                </div>
                <Separator />
                <div className="flex justify-between font-medium">
                  <span>Total</span>
                  <span>{formatBSV(totalWithFee)} BSV</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span></span>
                  <span>{formatSats(totalWithFee)} sats</span>
                </div>
              </div>

              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Remaining Balance</span>
                <span>{formatBSV(spendableBalance - totalWithFee)} BSV</span>
              </div>
            </div>
          </div>
        )}

        {/* Broadcasting State */}
        {sendState === 'broadcasting' && (
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

        {/* Success State */}
        {sendState === 'success' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-6 space-y-3">
              <div className="rounded-full bg-green-100 dark:bg-green-900/20 p-3">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-500" />
              </div>
              <div className="text-center">
                <p className="font-medium text-lg">Transaction Sent!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {formatBSV(getAmountInSats())} BSV sent successfully
                </p>
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-1">Transaction ID</div>
              <code className="text-xs break-all bg-muted p-2 rounded block">
                {txid}
              </code>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={viewTransaction}
            >
              View on WhatsOnChain
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Error State */}
        {sendState === 'error' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-6 space-y-3">
              <div className="rounded-full bg-red-100 dark:bg-red-900/20 p-3">
                <XCircle className="h-8 w-8 text-red-600 dark:text-red-500" />
              </div>
              <div className="text-center">
                <p className="font-medium text-lg">Transaction Failed</p>
              </div>
            </div>

            <Alert variant="destructive">
              <AlertDescription>
                {errorMessage || 'An unknown error occurred'}
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          {sendState === 'idle' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleReview}>
                Review
              </Button>
            </>
          )}

          {sendState === 'confirming' && (
            <>
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button onClick={handleConfirm}>
                Confirm & Send
              </Button>
            </>
          )}

          {(sendState === 'success' || sendState === 'error') && (
            <Button onClick={handleClose} className="w-full">
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
