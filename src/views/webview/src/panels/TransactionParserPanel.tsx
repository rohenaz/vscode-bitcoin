import { useState, useEffect } from 'react'
import { Copy, Check, AlertTriangle, ScanBarcode, Trash2 } from 'lucide-react'
import { PanelHeader } from '../components/PanelHeader'
import { InputGroup, InputGroupAddon, InputGroupTextarea, InputGroupButton, InputGroupText } from '../components/ui/input-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip'
import { getVscode } from '../vscode'
import '../App.css'

interface ParsedField {
  name: string
  startByte: number
  endByte: number
  hex: string
  value: string | number | bigint
  color: string
  error?: string
  description?: string
  asm?: string
}

interface ParseResult {
  fields: ParsedField[]
  totalBytes: number
  errors: string[]
  warnings: string[]
}

export function TransactionParserPanel() {
  const vscode = getVscode()
  const [rawTxHex, setRawTxHex] = useState('')
  const [lastParsedHex, setLastParsedHex] = useState('')
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Initial setup
  useEffect(() => {
    document.documentElement.classList.add('dark')

    // Remove initial loading spinner
    const loader = document.getElementById('initial-loader')
    if (loader) {
      loader.style.opacity = '0'
      loader.style.transition = 'opacity 0.3s'
      setTimeout(() => loader.remove(), 300)
    }

    // Load initial data if provided
    const initialData = window.INITIAL_DATA as any
    if (initialData?.rawTxHex) {
      setRawTxHex(initialData.rawTxHex)
      parseTransaction(initialData.rawTxHex)
    }
  }, [])

  // Handle messages from backend
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data

      if (message.type === 'transaction:parsed' && message.data) {
        setParseResult(message.data)
        setError(null)
      } else if (message.type === 'transaction:parse:error' && message.data?.error) {
        setError(message.data.error)
        setParseResult(null)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const parseTransaction = (hex: string) => {
    if (!hex.trim()) {
      setParseResult(null)
      setError(null)
      return
    }

    setLastParsedHex(hex.trim())
    vscode.postMessage({
      type: 'transaction:parse',
      data: { rawTx: hex }
    })
  }

  const handleParse = () => {
    parseTransaction(rawTxHex)
  }

  const handleClear = () => {
    setRawTxHex('')
    setLastParsedHex('')
    setParseResult(null)
    setError(null)
  }

  const handleDecode = () => {
    if (!rawTxHex.trim()) return
    vscode.postMessage({
      type: 'transaction:openInWindow',
      data: { rawTxHex: rawTxHex.trim() }
    })
  }

  const formatHex = (hex: string, maxLength: number = 64): string => {
    if (hex.length <= maxLength) return hex
    return `${hex.slice(0, maxLength - 3)}...`
  }

  const formatValue = (value: string | number | bigint): string => {
    if (typeof value === 'bigint') {
      return value.toString()
    }
    return String(value)
  }

  const copyToClipboard = async (text: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(fieldId)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleScrollToField = (fieldIndex: number) => {
    const element = document.getElementById(`field-${fieldIndex}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Briefly highlight the field
      element.style.transition = 'background-color 0.3s'
      element.style.backgroundColor = 'var(--accent)'
      setTimeout(() => {
        element.style.backgroundColor = ''
      }, 1000)
    }
  }

  const isValid = parseResult &&
    parseResult.errors.length === 0 &&
    parseResult.warnings.length === 0 &&
    !parseResult.fields.some(field => field.error)

  const hasIssues = parseResult && (
    parseResult.errors.length > 0 ||
    parseResult.warnings.length > 0 ||
    parseResult.fields.some(field => field.error)
  )

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <PanelHeader
        title="Transaction Parser"
        subtitle={parseResult ? `${parseResult.totalBytes} bytes` : '0 bytes'}
        validationStatus={
          isValid ? 'valid' : hasIssues ? 'invalid' : null
        }
        action={
          isValid ? {
            label: 'Decode',
            onClick: handleDecode
          } : undefined
        }
      />

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Input Section */}
        <InputGroup>
          <InputGroupTextarea
            id="tx-hex-input"
            value={rawTxHex}
            onChange={(e) => setRawTxHex(e.target.value)}
            placeholder="Enter raw transaction hex..."
            className="min-h-[200px] font-mono text-sm"
          />
          <InputGroupAddon align="block-end" className="border-t">
            <InputGroupText>
              {rawTxHex.trim() ? `${rawTxHex.replace(/\s/g, '').length / 2} bytes` : 'No data'}
            </InputGroupText>
            <InputGroupButton
              onClick={handleParse}
              disabled={!rawTxHex.trim() || rawTxHex.trim() === lastParsedHex}
              variant="default"
              className="ml-auto"
            >
              Parse Transaction
            </InputGroupButton>
          </InputGroupAddon>
          <InputGroupAddon align="block-start" className="border-b">
            <InputGroupText className="font-medium">
              <ScanBarcode className="w-4 h-4" />
              Transaction Parser
            </InputGroupText>
            <InputGroupButton
              onClick={handleClear}
              disabled={!rawTxHex.trim()}
              variant="ghost"
              size="icon-xs"
              className="ml-auto"
              title="Clear input"
            >
              <Trash2 className="w-4 h-4" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>

        {/* Byte Map Visualization - Always shown */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">Byte Map</h3>
          <div className="bg-card border border-border rounded-md p-4">
            <div className="flex w-full gap-0.5">
              {parseResult ? (
                parseResult.fields.map((field, idx) => {
                  const byteCount = field.endByte - field.startByte
                  const widthPercent = (byteCount / parseResult.totalBytes) * 100

                  return (
                    <Tooltip key={idx}>
                      <TooltipTrigger asChild>
                        <div
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => handleScrollToField(idx)}
                          style={{
                            width: `${widthPercent}%`,
                            minWidth: '4px',
                            height: '40px',
                            backgroundColor: field.color,
                            opacity: field.error ? 0.5 : 1
                          }}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <div className="font-medium">{field.name}</div>
                        <div className="text-xs opacity-80">
                          Bytes {field.startByte}-{field.endByte} ({byteCount} bytes)
                        </div>
                        <div className="text-xs opacity-60 mt-1">Click to view details</div>
                      </TooltipContent>
                    </Tooltip>
                  )
                })
              ) : (
                <div className="w-full h-10 bg-muted rounded" />
              )}
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive rounded-md animate-in fade-in duration-200">
            <p className="text-sm text-destructive font-medium">Error</p>
            <p className="text-sm text-destructive/90 mt-1">{error}</p>
          </div>
        )}

        {/* Parse Result */}
        {parseResult && (
          <>

            {/* Errors and Warnings */}
            {(parseResult.errors.length > 0 || parseResult.warnings.length > 0) && (
              <div className="space-y-2 animate-in fade-in duration-200">
                {parseResult.errors.length > 0 && (
                  <div className="p-3 bg-destructive/10 border border-destructive rounded-md">
                    <p className="text-sm font-medium text-destructive mb-1">Errors</p>
                    <ul className="text-sm text-destructive/90 space-y-1">
                      {parseResult.errors.map((err, idx) => (
                        <li key={idx}>• {err}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {parseResult.warnings.length > 0 && (
                  <div className="p-3 bg-accent/50 border border-accent rounded-md">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4 text-accent-foreground" />
                      <p className="text-sm font-medium text-accent-foreground">Warnings</p>
                    </div>
                    <ul className="text-sm text-accent-foreground/90 space-y-1 ml-6">
                      {parseResult.warnings.map((warn, idx) => (
                        <li key={idx}>• {warn}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Field List */}
            <div className="space-y-2 animate-in fade-in duration-200">
              <h3 className="text-sm font-medium text-foreground">Parsed Fields</h3>
              <div className="space-y-2">
                {parseResult.fields.map((field, idx) => (
                  <div
                    key={idx}
                    id={`field-${idx}`}
                    className={`bg-card border rounded-md p-3 transition-colors ${
                      field.error ? 'border-destructive' : 'border-border'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Color indicator */}
                      <div
                        className="w-3 h-3 rounded-sm flex-shrink-0 mt-1"
                        style={{ backgroundColor: field.color }}
                      />

                      {/* Field info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <h4 className="text-sm font-medium text-foreground">{field.name}</h4>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            Bytes {field.startByte}-{field.endByte}
                          </span>
                        </div>

                        {field.description && (
                          <p className="text-sm text-muted-foreground mt-1">{field.description}</p>
                        )}

                        <div className="mt-2 space-y-1">
                          <div className="text-xs text-muted-foreground">Value:</div>
                          <div className="flex items-start gap-2">
                            <div className="flex-1 text-sm font-mono text-foreground bg-muted px-2 py-1 rounded break-all">
                              {formatValue(field.value)}
                            </div>
                            <button
                              onClick={() => copyToClipboard(formatValue(field.value), `value-${idx}`)}
                              className="flex-shrink-0 p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                              title="Copy value"
                            >
                              {copiedField === `value-${idx}` ? (
                                <Check className="w-4 h-4 text-primary" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        {field.asm && (
                          <div className="mt-2 space-y-1">
                            <div className="text-xs text-muted-foreground">ASM:</div>
                            <div className="flex items-start gap-2">
                              <div className="flex-1 text-xs font-mono text-foreground bg-muted px-2 py-1 rounded break-all">
                                {field.asm}
                              </div>
                              <button
                                onClick={() => copyToClipboard(field.asm || '', `asm-${idx}`)}
                                className="flex-shrink-0 p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                                title="Copy ASM"
                              >
                                {copiedField === `asm-${idx}` ? (
                                  <Check className="w-4 h-4 text-primary" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {field.hex && (
                          <div className="mt-2 space-y-1">
                            <div className="text-xs text-muted-foreground">Hex:</div>
                            <div className="flex items-start gap-2">
                              <div className="flex-1 text-xs font-mono text-foreground bg-muted px-2 py-1 rounded break-all">
                                {formatHex(field.hex)}
                              </div>
                              <button
                                onClick={() => copyToClipboard(field.hex, `hex-${idx}`)}
                                className="flex-shrink-0 p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                                title="Copy full hex"
                              >
                                {copiedField === `hex-${idx}` ? (
                                  <Check className="w-4 h-4 text-primary" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {field.error && (
                          <div className="mt-2 flex items-start gap-2 text-sm text-destructive">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>{field.error}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
