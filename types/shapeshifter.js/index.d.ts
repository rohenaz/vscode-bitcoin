declare module '@libitx/shapeshifter.js' {
  interface TxoOutput {
    satoshis: number;
    script: string;
  }

  interface TxoInput {
    txid: string;
    vout: number;
    script: string;
    sequence?: number;
  }

  interface TxoTransaction {
    txid: string;
    version: number;
    inputs: TxoInput[];
    outputs: TxoOutput[];
    locktime?: number;
  }

  interface BobCell {
    op: number;
    ops: string;
    h: string;
    b?: string;
    s?: string;
    ii?: number;
    ls?: number;
  }

  interface BobTape {
    cell: BobCell[];
  }

  interface BobTransactionInput {
    i: number;
    e: {
      h: string;
      i: number;
      a?: string;
    };
    tape: BobTape[];
  }

  interface BobTransactionOutput {
    i: number;
    e: {
      v: number;
      a?: string;
    };
    tape: BobTape[];
  }

  interface BobTransaction {
    tx: {
      h: string;
    };
    in: BobTransactionInput[];
    out: BobTransactionOutput[];
  }

  interface ShapeshifterStatic {
    toBob(rawTxHex: string): BobTransaction;
    toTxo(rawTxHex: string): TxoTransaction;
  }

  const Shapeshifter: ShapeshifterStatic;
  export default Shapeshifter;
}
