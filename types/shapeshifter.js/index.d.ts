declare module 'shapeshifter.js' {
  export interface TxoFormat {
    txid: string;
    version: number;
    locktime: number;
    vin: Array<{
      txid: string;
      vout: number;
      scriptSig: {
        hex: string;
        asm: string;
      };
      sequence: number;
    }>;
    vout: Array<{
      value: number;
      n: number;
      scriptPubKey: {
        hex: string;
        asm: string;
        addresses: string[];
        type: string;
      };
    }>;
  }

  export interface BobFormat {
    tx: {
      h: string;
    };
    in: Array<{
      i: number;
      s: string;
      e: {
        h: string;
        i: number;
        s: string;
      };
    }>;
    out: Array<{
      i: number;
      s: string;
      e: {
        v: number;
        i: number;
        s: string;
      };
    }>;
  }

  export default class Shapeshifter {
    static toTxo(rawTxHex: string): TxoFormat;
    static toBob(rawTxHex: string): BobFormat;
  }
} 