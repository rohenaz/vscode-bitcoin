import type { ScriptInfo } from '../types/decodedTransaction'
import { LockingScript, Utils, Hash } from '@bsv/sdk'

const { toBase58Check } = Utils

export function extractP2PKHAddress(lockingScriptHex: string): string | null {
  try {
    const script = LockingScript.fromHex(lockingScriptHex)
    const asm = script.toASM()

    // Check if it's a P2PKH script
    if (!asm.startsWith('OP_DUP OP_HASH160')) {
      return null
    }

    // Extract the 20-byte public key hash from chunks[2]
    const data = script.chunks[2]?.data
    if (!data || data.length !== 20) {
      return null
    }

    // Convert to base58check address
    return toBase58Check(data)
  } catch (error) {
    console.error('Failed to extract P2PKH address:', error)
    return null
  }
}

export function extractAddressFromUnlockingScript(unlockingScriptHex: string): string | null {
  try {
    const script = LockingScript.fromHex(unlockingScriptHex)

    // For typical P2PKH unlocking script, the public key is in chunks[1]
    // Format: <signature> <pubkey>
    const pubKeyData = script.chunks[1]?.data
    if (!pubKeyData || pubKeyData.length !== 33) {
      return null
    }

    // Hash the public key to get the address
    const hash = Hash.ripemd160(pubKeyData)
    return toBase58Check(hash)
  } catch (error) {
    console.error('Failed to extract address from unlocking script:', error)
    return null
  }
}

export function detectScriptType(scriptAsm: string): ScriptInfo {
  // OP_RETURN detection
  if (
    scriptAsm.startsWith('OP_RETURN') ||
    scriptAsm.startsWith('OP_FALSE OP_RETURN') ||
    scriptAsm.startsWith('OP_0 OP_RETURN') ||
    scriptAsm.startsWith('0 OP_RETURN')
  ) {
    const parts = scriptAsm.slice(0, 25).split(' ')
    // 'run' in hex is '72756e'
    const isRun = parts[2] === '72756e'
    return {
      type: isRun ? 'run' : 'op_return',
      label: isRun ? 'Run (OP_RETURN)' : 'OP_RETURN'
    }
  }

  // P2PKH detection
  if (scriptAsm.startsWith('OP_DUP OP_HASH160')) {
    // The address would need to be extracted on the extension side with @bsv/sdk
    // For now, we'll just mark it as P2PKH
    return {
      type: 'p2pkh',
      label: 'P2PKH',
      address: undefined // Will be populated by extension
    }
  }

  // Custom script
  const truncated = scriptAsm.length > 50
    ? `${scriptAsm.slice(0, 20)}...${scriptAsm.slice(-20)}`
    : scriptAsm

  return {
    type: 'custom',
    label: `Script: ${truncated}`
  }
}

export function truncateTxid(txid: string): string {
  if (!txid || txid.length < 12) return txid
  return `${txid.slice(0, 6)}...${txid.slice(-6)}`
}

export function formatSatoshis(satoshis: number): string {
  if (satoshis > 100000) {
    return `${(satoshis / 100000000).toFixed(8)} BSV`
  }
  return `${satoshis.toLocaleString()} sats`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  return `${(bytes / 1024).toFixed(2)} KB`
}
