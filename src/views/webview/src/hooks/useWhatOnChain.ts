import { useQuery, useMutation } from '@tanstack/react-query'
import { getVscode } from '../vscode'

const vscode = getVscode()

/**
 * Fetch transaction hex from WhatOnChain
 */
export function useTransactionHex(txid: string | null, network: string = 'mainnet') {
  return useQuery({
    queryKey: ['transaction', 'hex', network, txid],
    queryFn: async () => {
      if (!txid) throw new Error('No txid provided')

      return new Promise<string>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Request timeout'))
        }, 30000)

        const handler = (event: MessageEvent) => {
          const message = event.data

          if (message.type === 'whatsonchain:transactionHex:success' && message.txid === txid) {
            clearTimeout(timeoutId)
            window.removeEventListener('message', handler)
            resolve(message.data)
          } else if (message.type === 'whatsonchain:transactionHex:error' && message.txid === txid) {
            clearTimeout(timeoutId)
            window.removeEventListener('message', handler)
            reject(new Error(message.error))
          }
        }

        window.addEventListener('message', handler)

        vscode.postMessage({
          type: 'whatsonchain:fetchTransactionHex',
          txid,
          network
        })
      })
    },
    enabled: !!txid,
  })
}

/**
 * Fetch transaction details (includes spending info)
 */
export function useTransactionDetails(txid: string | null, network: string = 'mainnet') {
  return useQuery({
    queryKey: ['transaction', 'details', network, txid],
    queryFn: async () => {
      if (!txid) throw new Error('No txid provided')

      return new Promise<any>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Request timeout'))
        }, 30000)

        const handler = (event: MessageEvent) => {
          const message = event.data

          if (message.type === 'whatsonchain:transactionDetails:success' && message.txid === txid) {
            clearTimeout(timeoutId)
            window.removeEventListener('message', handler)
            resolve(message.data)
          } else if (message.type === 'whatsonchain:transactionDetails:error' && message.txid === txid) {
            clearTimeout(timeoutId)
            window.removeEventListener('message', handler)
            reject(new Error(message.error))
          }
        }

        window.addEventListener('message', handler)

        vscode.postMessage({
          type: 'whatsonchain:fetchTransactionDetails',
          txid,
          network
        })
      })
    },
    enabled: !!txid,
  })
}

/**
 * Check if transaction exists on chain
 */
export function useTransactionExists(txid: string | null, network: string = 'mainnet') {
  return useQuery({
    queryKey: ['transaction', 'exists', network, txid],
    queryFn: async () => {
      if (!txid) throw new Error('No txid provided')

      return new Promise<boolean>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Request timeout'))
        }, 30000)

        const handler = (event: MessageEvent) => {
          const message = event.data

          if (message.type === 'whatsonchain:transactionExists:success' && message.txid === txid) {
            clearTimeout(timeoutId)
            window.removeEventListener('message', handler)
            resolve(message.data.exists)
          } else if (message.type === 'whatsonchain:transactionExists:error' && message.txid === txid) {
            clearTimeout(timeoutId)
            window.removeEventListener('message', handler)
            reject(new Error(message.error))
          }
        }

        window.addEventListener('message', handler)

        vscode.postMessage({
          type: 'whatsonchain:checkTransactionExists',
          txid,
          network
        })
      })
    },
    enabled: !!txid,
  })
}

/**
 * Resolve transaction inputs by fetching source transactions
 */
export function useResolvedInputs(txid: string | null, inputs: any[], network: string = 'mainnet') {
  return useQuery({
    queryKey: ['transaction', 'inputs', network, txid, inputs.length],
    queryFn: async () => {
      if (!txid || !inputs.length) throw new Error('No inputs to resolve')

      return new Promise<any[]>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Request timeout'))
        }, 60000) // Longer timeout for multiple fetches

        const handler = (event: MessageEvent) => {
          const message = event.data

          if (message.type === 'whatsonchain:inputsResolved:success' && message.txid === txid) {
            clearTimeout(timeoutId)
            window.removeEventListener('message', handler)
            resolve(message.data)
          } else if (message.type === 'whatsonchain:inputsResolved:error' && message.txid === txid) {
            clearTimeout(timeoutId)
            window.removeEventListener('message', handler)
            reject(new Error(message.error))
          }
        }

        window.addEventListener('message', handler)

        vscode.postMessage({
          type: 'whatsonchain:resolveInputs',
          txid,
          inputs,
          network
        })
      })
    },
    enabled: !!txid && inputs.length > 0,
  })
}

/**
 * Broadcast transaction mutation
 */
export function useBroadcastTransaction() {
  return useMutation({
    mutationFn: async ({ rawTx, network = 'mainnet' }: { rawTx: string; network?: string }) => {
      return new Promise<{ success: boolean; txid?: string; error?: string }>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Broadcast timeout'))
        }, 30000)

        const handler = (event: MessageEvent) => {
          const message = event.data

          if (message.type === 'whatsonchain:broadcast:result') {
            clearTimeout(timeoutId)
            window.removeEventListener('message', handler)

            if (message.data.success) {
              resolve(message.data)
            } else {
              reject(new Error(message.data.error || 'Broadcast failed'))
            }
          }
        }

        window.addEventListener('message', handler)

        vscode.postMessage({
          type: 'whatsonchain:broadcastTransaction',
          rawTx,
          network
        })
      })
    },
  })
}
