import { Routes, Route, Navigate } from 'react-router-dom'
import { TransactionDecoderPanel } from './panels/TransactionDecoderPanel'
import { ScriptDebuggerPanel } from './panels/ScriptDebuggerPanel'
import { KeyVaultPanel } from './panels/KeyVaultPanel'
import { BitcoinToolsPanel } from './panels/BitcoinToolsPanel'

export function AppRoutes() {
  return (
    <Routes>
      {/* Bitcoin Tools - sidebar view */}
      <Route path="/tools" element={<BitcoinToolsPanel />} />

      {/* Key Vault */}
      <Route path="/vault" element={<KeyVaultPanel />} />

      {/* Transaction Decoder Routes */}
      <Route path="/decoder" element={<TransactionDecoderPanel />} />
      <Route path="/decoder/:txid" element={<TransactionDecoderPanel />} />

      {/* Script Debugger Routes */}
      <Route path="/debugger" element={<ScriptDebuggerPanel />} />
      <Route path="/debugger/:network/:txid" element={<ScriptDebuggerPanel />} />
      <Route path="/debugger/:network/:txid/:inputIndex" element={<ScriptDebuggerPanel />} />

      {/* Default redirect based on panel type */}
      <Route path="*" element={<Navigate to={getDefaultRoute()} replace />} />
    </Routes>
  )
}

/**
 * Determine the default route based on the panel type set by the backend
 */
function getDefaultRoute(): string {
  const panelType = window.PANEL_TYPE || 'bitcoin-tools'

  switch (panelType) {
    case 'key-vault':
      return '/vault'
    case 'bitcoin-tools':
      return '/tools'
    case 'transaction-decoder':
      return '/decoder'
    case 'script-executor':
      return '/debugger'
    default:
      return '/tools'
  }
}

/**
 * Get the initial route entry for MemoryRouter based on panel type and initial data
 */
export function getInitialRouterEntry(): string {
  const panelType = window.PANEL_TYPE || 'bitcoin-tools'
  const initialData = (window as any).INITIAL_DATA

  // If we have initial data, construct the appropriate route
  if (initialData) {
    switch (panelType) {
      case 'transaction-decoder':
        if (initialData.txid) {
          return `/decoder/${initialData.txid}`
        }
        break
      case 'script-executor':
        const network = initialData.network || 'main'
        if (initialData.txid && initialData.inputIndex !== undefined) {
          return `/debugger/${network}/${initialData.txid}/${initialData.inputIndex}`
        } else if (initialData.txid) {
          return `/debugger/${network}/${initialData.txid}`
        }
        break
    }
  }

  // Fall back to default route
  return getDefaultRoute()
}
