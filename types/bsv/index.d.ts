// Type definitions for bsv 0.30
// Project: https://github.com/moneybutton/bsv
// Forked From: https://github.com/bitpay/bitcore-lib
// Definitions by: Lautaro Dragan <https://github.com/lautarodragan>
// Definitions extended by: David Case <https://github.com/shruggr>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

// TypeScript Version: 2.2

/// <reference types="node" />

declare module "bsv" {
  export namespace crypto {
    class BN {}

    namespace ECDSA {
      function sign(message: Buffer, key: PrivKey): Signature;
      function verify(
        hashbuf: Buffer,
        sig: Signature,
        pubkey: PubKey,
        endian?: "little"
      ): boolean;
    }

    namespace Hash {
      function sha1(buffer: Buffer): Buffer;
      function sha256(buffer: Buffer): Buffer;
      function sha256sha256(buffer: Buffer): Buffer;
      function sha256ripemd160(buffer: Buffer): Buffer;
      function sha512(buffer: Buffer): Buffer;
      function ripemd160(buffer: Buffer): Buffer;

      function sha256hmac(data: Buffer, key: Buffer): Buffer;
      function sha512hmac(data: Buffer, key: Buffer): Buffer;
    }

    namespace Random {
      function getRandomBuffer(size: number): Buffer;
    }

    namespace Point {}

    class Signature {
      static fromDER(sig: Buffer): Signature;
      static fromString(data: string): Signature;
      SIGHASH_ALL: number;
      toString(): string;
    }
  }

  export namespace Tx {
    class UnspentOutput {
      static fromObject(o: object): UnspentOutput;
      
      readonly address: Address;
      readonly txId: string;
      readonly outputIndex: number;
      readonly script: Script;
      readonly satoshis: number;
      spentTxId: string | null;

      constructor(data: object);

      inspect(): string;
      toObject(): this;
      toString(): string;
    }

    class Output {
      readonly script: Script;
      readonly satoshis: number;
      readonly satoshisBN: crypto.BN;
      spentTxId: string | null;
      constructor(data: object);

      setScript(script: Script | string | Buffer): this;
      inspect(): string;
      toObject(): object;
    }

    class Input {
      readonly prevTxId: Buffer;
      readonly outputIndex: number;
      readonly sequenceNumber: number;
      readonly script: Script;
      output?: Output;
      isValidSignature(tx: Tx, sig: any): boolean;
    }
  }

  export class Tx {
    static fromBuffer(txbuf: Buffer): Tx;
    toJSON(): Object;
    inputs: Tx.Input[];
    outputs: Tx.Output[];
    readonly id: string;
    readonly hash: string;
    readonly inputAmount: number;
    readonly outputAmount: number;
    nid: string;

    constructor(serialized?: any);

    from(utxos: Tx.UnspentOutput | Tx.UnspentOutput[]): this;

    to(address: Address[] | Address | string, amount: number): this;
    change(address: Address | string): this;
    fee(amount: number): this;
    feePerKb(amount: number): this;
    sign(privateKey: PrivKey | string): this;
    applySignature(sig: crypto.Signature): this;
    addInput(input: Tx.Input): this;
    addOutput(output: Tx.Output): this;
    addData(value: Buffer | string): this;
    lockUntilDate(time: Date | number): this;
    lockUntilBlockHeight(height: number): this;

    hasWitnesses(): boolean;
    getFee(): number;
    getChangeOutput(): Tx.Output | null;
    getLockTime(): Date | number;

    verify(): string | boolean;
    isCoinbase(): boolean;

    enableRBF(): this;
    isRBF(): boolean;

    inspect(): string;
    serialize(): string;

    toObject(): any;
    toBuffer(): Buffer;

    verify(): boolean | string;
    isFullySigned(): boolean;
  }

  export class ECIES {
    constructor(opts?: any, algorithm?: string);

    privateKey(privateKey: PrivKey): ECIES;
    publicKey(publicKey: PubKey): ECIES;
    encrypt(message: string | Buffer): Buffer;
    decrypt(encbuf: Buffer): Buffer;
  }
  export class Block {
    hash: string;
    height: number;
    Txs: Tx[];
    header: {
      time: number;
      prevHash: string;
    };

    constructor(data: Buffer | object);
  }

  export class PrivKey {
    constructor(key?: string, network?: Networks.Network);

    readonly publicKey: PubKey;
    readonly compressed: boolean;
    readonly network: Networks.Network;

    toAddress(): Address;
    toPubKey(): PubKey;
    toString(): string;
    toObject(): object;
    toJSON(): object;
    toHex(): string;
    toBigNumber(): any; //BN;
    toBuffer(): Buffer;
    inspect(): string;
    validate(): PrivKey;

    static fromString(str: string): PrivKey;
    static fromRandom(netowrk?: string): PrivKey;
    static fromBuffer(buf: Buffer, network: string): PrivKey;
    static fromHex(hex: string): PrivKey;
    static getValidationError(data: string): any | null;
  }

  export class PubKey {
    constructor(source: string, extra?: object);

    //readonly point: Point;
    readonly compressed: boolean;
    readonly network: Networks.Network;

    toDER(): Buffer;
    toObject(): object;
    toBuffer(): Buffer;
    toAddress(network?: string | Networks.Network): Address;
    toString(): string;
    toHex(): string;
    inspect(): string;

    static fromPrivKey(privateKey: PrivKey): PubKey;
    static fromBuffer(buf: Buffer, strict: boolean): PubKey;
    static fromDER(buf: Buffer, strict: boolean): PubKey;
    //static fromPoint(point: Point, compressed: boolean): PubKey;
    //static fromX(odd: boolean, x: Point): PubKey;
    static fromString(str: string): PubKey;
    static fromHex(hex: string): PubKey;
    static getValidationError(data: string): any | null;
    static isValid(data: string): boolean;
  }

  export class Message {
    constructor(message: string | Buffer);

    readonly messageBuffer: Buffer;

    sign(privateKey: PrivKey): string;
    verify(address: string | Address, signature: string): boolean;
    toObject(): object;
    toJSON(): string;
    toString(): string;
    inspect(): string;

    static sign(message: string | Buffer, privateKey: PrivKey): string;
    static verify(
      message: string | Buffer,
      address: string | Address,
      signature: string
    ): boolean;
    static MAGIC_BYTES: Buffer;
    static magicHash(): string;
    static fromString(str: string): Message;
    static fromJSON(json: string): Message;
    static fromObject(obj: object): Message;
  }

  export class Bip39 {
    constructor(
      mnemonic?: string,
      seed?: string | Array<string>,
      wordList?: Array<string>
    );

    readonly wordList: Array<string>;
    readonly phrase: string;

    toSeed(passphrase?: string): Buffer;
    toBip32(passphrase: string, network: string | number): Bip32;
    toString(): string;
    inspect(): string;

    static fromRandom(wordlist?: Array<string>): Bip39;
    static fromString(mnemonic: String, wordList?: Array<string>): Bip39;
    static isValid(mnemonic: String, wordList?: Array<string>): boolean;
    static fromSeed(seed: Buffer, wordlist: Array<string>): Bip39;
  }

  export class Bip32 {
    constructor(data?: string | Buffer | object);
    // readonly Bip32: Bip32;

    readonly xprivkey: Buffer;
    readonly xpubkey: Buffer;
    readonly network: Networks.Network;
    readonly depth: number;
    readonly privKey: PrivKey;
    readonly pubKey: PubKey;
    readonly fingerPrint: Buffer;

    derive(arg: string | number, hardened?: boolean): Bip32;
    deriveChild(arg: string | number, hardened?: boolean): Bip32;
    deriveNonCompliantChild(arg: string | number, hardened?: boolean): Bip32;

    toString(): string;
    toObject(): object;
    toJSON(): object;
    toBuffer(): Buffer;
    toHex(): string;
    inspect(): string;
    toPublic(): Bip32;

    static fromRandom(): Bip32;
    static fromString(str: string): Bip32;
    static fromObject(obj: object): Bip32;
    static fromSeed(hexa: string | Buffer): Bip32;
    static fromBuffer(buf: Buffer): Bip32;
    static fromHex(hex: string): Bip32;
    static isValidPath(arg: string | number, hardened: boolean): boolean;
    static isValidSerialized(
      data: string | Buffer,
      network?: string | Networks.Network
    ): boolean;
    static getSerializedError(
      data: string | Buffer,
      network?: string | Networks.Network
    ): any | null;

    // readonly xpubkey: Buffer;
    // readonly network: Networks.Network;
    // readonly depth: number;
    // readonly publicKey: PubKey;
    // readonly fingerPrint: Buffer;

    derive(arg: string | number, hardened?: boolean): Bip32;
    deriveChild(arg: string | number, hardened?: boolean): Bip32;

    toString(): string;
    toObject(): object;
    toJSON(): object;
    toBuffer(): Buffer;
    toHex(): string;
    inspect(): string;

    static fromString(str: string): Bip32;
    static fromObject(obj: object): Bip32;
    static fromBuffer(buf: Buffer): Bip32;
    static fromHex(hex: string): Bip32;

    static fromBip32(Bip32: Bip32): Bip32;
    static isValidPath(arg: string | number): boolean;
    static isValidSerialized(
      data: string | Buffer,
      network?: string | Networks.Network
    ): boolean;
    static getSerializedError(
      data: string | Buffer,
      network?: string | Networks.Network
    ): any | null;
  }

  export namespace Constants {
    type PrivKey = number;

    type Mainnet = {
      privkey: PrivKey;
    };

    const mainnet: Mainnet;
  }

  export namespace Script {
    const types: {
      DATA_OUT: string;
    };
    function buildMultisigOut(
      publicKeys: PubKey[],
      threshold: number,
      opts: object
    ): Script;
    function buildWitnessMultisigOutFromScript(script: Script): Script;
    function buildMultisigIn(
      pubkeys: PubKey[],
      threshold: number,
      signatures: Buffer[],
      opts: object
    ): Script;
    function buildP2SHMultisigIn(
      pubkeys: PubKey[],
      threshold: number,
      signatures: Buffer[],
      opts: object
    ): Script;
    function buildPubKeyHashOut(address: Address): Script;
    function buildPubKeyOut(pubkey: PubKey): Script;
    function buildDataOut(data: string | Buffer, encoding?: string): Script;
    function buildScriptHashOut(script: Script): Script;
    function buildPubKeyIn(
      signature: crypto.Signature | Buffer,
      sigtype: number
    ): Script;
    function buildPubKeyHashIn(
      publicKey: PubKey,
      signature: crypto.Signature | Buffer,
      sigtype: number
    ): Script;

    function fromAddress(address: string | Address): Script;

    function empty(): Script;
    namespace Interpreter {
      const SCRIPT_ENABLE_SIGHASH_FORKID: any;
    }

    function Interpreter(): {
      verify: (
        inputScript: Script,
        outputScript: Script,
        txn: Tx,
        nin: Number,
        flags: any,
        satoshisBN: crypto.BN
      ) => boolean;
    };
  }

  export class Script {
    constructor();

    set(obj: object): this;

    toBuffer(): Buffer;
    toASM(): string;
    toString(): string;
    toHex(): string;

    isPubKeyHashOut(): boolean;
    isPubKeyHashIn(): boolean;

    getPubKey(): Buffer;
    getPubKeyHash(): Buffer;

    isPubKeyOut(): boolean;
    isPubKeyIn(): boolean;

    isScriptHashOut(): boolean;
    isWitnessScriptHashOut(): boolean;
    isWitnessPubKeyHashOut(): boolean;
    isWitnessProgram(): boolean;
    isScriptHashIn(): boolean;
    isMultisigOut(): boolean;
    isMultisigIn(): boolean;
    isDataOut(): boolean;
    isSafeDataOut(): boolean;

    getData(): Buffer;
    isPushOnly(): boolean;

    classify(): string;
    classifyInput(): string;
    classifyOutput(): string;

    isStandard(): boolean;

    prepend(obj: any): this;
    add(obj: any): this;

    hasCodeseparators(): boolean;
    removeCodeseparators(): this;

    equals(script: Script): boolean;

    getAddressInfo(): Address | boolean;
    findAndDelete(script: Script): this;
    checkMinimalPush(i: number): boolean;
    getSignatureOperationsCount(accurate: boolean): number;

    toAddress(network?: string): Address;

    static fromString(data: string): Script;
    fromString(data: string): Script

    static fromBitcoindString(data: string): Script;
    fromBitcoindString(data: string): Script

    static fromBuffer(data: Buffer): Script;
    fromBuffer(data: Buffer): Script
    
    toAsmString(): string;

  }

  export interface Util {
    readonly buffer: {
      reverse(a: any): any;
    };
  }

  export namespace Networks {
    interface Network {
      readonly name: string;
      readonly alias: string;
    }

    const livenet: Network;
    const mainnet: Network;
    const testnet: Network;

    function add(data: any): Network;
    function remove(network: Network): void;
    function get(
      args: string | number | Network,
      keys: string | string[]
    ): Network;
  }

  export class Address {
    readonly hashBuffer: Buffer;
    readonly network: Networks.Network;
    readonly type: string;

    constructor(
      data: Buffer | Uint8Array | string | object,
      network?: Networks.Network | string,
      type?: string
    );

    static fromPubKey(pubKey: PubKey): Address;
  }

  export class Unit {
    static fromBTC(amount: number): Unit;
    static fromMilis(amount: number): Unit;
    static fromBits(amount: number): Unit;
    static fromSatoshis(amount: number): Unit;

    constructor(amount: number, unitPreference: string);

    toBTC(): number;
    toMilis(): number;
    toBits(): number;
    toSatoshis(): number;
  }
}
