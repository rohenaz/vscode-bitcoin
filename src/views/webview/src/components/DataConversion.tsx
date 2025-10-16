import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { useState, useEffect } from 'react'
import { getVscode } from '../vscode'

type DataFormat = 'binary' | 'hex' | 'base64' | 'utf8' | 'decimal'

export default function DataConversion() {
  const vscode = getVscode()
  const [inputValue, setInputValue] = useState('')
  const [outputValue, setOutputValue] = useState('')
  const [fromFormat, setFromFormat] = useState<DataFormat>('hex')
  const [toFormat, setToFormat] = useState<DataFormat>('base64')
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data

      if (message.type === 'initialize') {
        if (message.input) setInputValue(message.input)
        if (message.fromFormat) setFromFormat(message.fromFormat)
        else if (message.detectedFormat) setFromFormat(message.detectedFormat)
        if (message.toFormat) setToFormat(message.toFormat)
        if (message.value) setOutputValue(message.value)
      } else if (message.type === 'result') {
        setOutputValue(message.value)
        showStatus('Conversion succeeded')
      } else if (message.type === 'detected') {
        if (message.format) {
          setFromFormat(message.format)
          selectDifferentFormat(message.format)
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  useEffect(() => {
    if (inputValue) {
      const trimmed = inputValue.trim()
      if (trimmed) {
        vscode.postMessage({ type: 'detect', input: trimmed })
      }
    }
  }, [inputValue, vscode])

  useEffect(() => {
    if (inputValue && fromFormat && toFormat) {
      handleConvert()
    }
  }, [inputValue, fromFormat, toFormat])

  const showStatus = (msg: string) => {
    setStatusMessage(msg)
    setTimeout(() => setStatusMessage(''), 2000)
  }

  const selectDifferentFormat = (currentFormat: DataFormat) => {
    const formats: DataFormat[] = ['binary', 'hex', 'base64', 'utf8', 'decimal']
    const different = formats.find(f => f !== currentFormat)
    if (different) setToFormat(different)
  }

  const handleConvert = () => {
    if (!inputValue || !fromFormat || !toFormat) return
    vscode.postMessage({
      type: 'convert',
      input: inputValue,
      fromFormat,
      toFormat
    })
  }

  const handleCopy = () => {
    if (!outputValue) return
    vscode.postMessage({ type: 'copy', value: outputValue })
    showStatus('Copied to clipboard')
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData('text') || ''
    const trimmed = pastedText.trim()
    e.preventDefault()
    const target = e.target as HTMLTextAreaElement
    const start = target.selectionStart
    const end = target.selectionEnd
    setInputValue(inputValue.substring(0, start) + trimmed + inputValue.substring(end))
  }

  const handleBlur = () => {
    const trimmed = inputValue.trim()
    if (trimmed !== inputValue) setInputValue(trimmed)
  }

  return (
    <Card className="border-l-0 border-r-0">
      <CardContent className="space-y-2">
        <div className="space-y-1">
          <Label>Input Data</Label>
        <Textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onPaste={handlePaste}
          onBlur={handleBlur}
          placeholder="Paste or type data to convert"
          className="font-mono text-xs min-h-[150px] max-h-[400px]"
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Select value={fromFormat} onValueChange={(value) => setFromFormat(value as DataFormat)}>
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="binary">Binary</SelectItem>
              <SelectItem value="decimal">Decimal</SelectItem>
              <SelectItem value="hex">Hex</SelectItem>
              <SelectItem value="base64">Base64</SelectItem>
              <SelectItem value="utf8">UTF-8</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-muted-foreground">→</span>
          <Select value={toFormat} onValueChange={(value) => setToFormat(value as DataFormat)}>
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="binary">Binary</SelectItem>
              <SelectItem value="decimal">Decimal</SelectItem>
              <SelectItem value="hex">Hex</SelectItem>
              <SelectItem value="base64">Base64</SelectItem>
              <SelectItem value="utf8">UTF-8</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="secondary" className="w-full" onClick={handleConvert}>
          Convert
        </Button>
      </div>

      <div className="space-y-1">
        <Label>Output</Label>
        <Textarea
          value={outputValue}
          readOnly
          placeholder="Converted output will appear here"
          className="font-mono text-xs min-h-[150px] max-h-[400px]"
        />
        <Button variant="secondary" className="w-full" onClick={handleCopy} disabled={!outputValue}>
          Copy
        </Button>
      </div>

        {statusMessage && (
          <div className="text-center text-sm py-2 rounded-md bg-muted text-muted-foreground">
            {statusMessage}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
