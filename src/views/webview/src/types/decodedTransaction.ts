export interface DecodedTransactionInput {
  index: number;
  sourceTXID: string;
  sourceOutputIndex: number;
  unlockingScript: string;
  unlockingScriptAsm: string;
  sequence: number;
  // Resolved from source transaction
  resolved?: boolean;
  lockingScript?: string;
  lockingScriptAsm?: string;
  satoshis?: number;
}

export interface DecodedTransactionOutput {
  index: number;
  satoshis: number;
  lockingScript: string;
  lockingScriptAsm: string;
  spendingTxid?: string;
  spendingVout?: number;
}

export interface DecodedTransaction {
  txid: string;
  version: number;
  lockTime: number;
  size: number;
  network?: string;
  inputs: DecodedTransactionInput[];
  outputs: DecodedTransactionOutput[];
}

export interface ScriptInfo {
  type: 'p2pkh' | 'op_return' | 'run' | 'custom';
  label: string;
  address?: string;
}
