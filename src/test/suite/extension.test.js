var __importDefault =
  (this && this.__importDefault) ||
  ((mod) => (mod && mod.__esModule ? mod : { default: mod }));
Object.defineProperty(exports, '__esModule', { value: true });
// Import setup to ensure VS Code mock is loaded first
const setup_1 = __importDefault(require('../../../setup'));
const extension_1 = require('../../extension');
const bun_test_1 = require('bun:test');
const sdk_1 = require('@bsv/sdk');
const bmapjs_1 = require('bmapjs');
const bpu_ts_1 = require('bpu-ts');
// Mock ExtensionContext
const mockContext = {
  subscriptions: [],
  extensionPath: '',
  globalState: {
    get: (_key) => undefined,
    update: (_key, _value) => Promise.resolve(),
    keys: () => [],
    setKeysForSync: (_keys) => {},
  },
  workspaceState: {
    get: (_key) => undefined,
    update: (_key, _value) => Promise.resolve(),
    keys: () => [],
    setKeysForSync: (_keys) => {},
  },
  environmentVariableCollection: {},
  extensionUri: {},
  storageUri: undefined,
  globalStorageUri: {},
  logUri: {},
  extensionMode: 1,
  extension: {
    id: 'test',
    extensionKind: 1,
    extensionUri: {},
    extensionPath: '',
    isActive: true,
    packageJSON: {},
    exports: undefined,
    activate: () => Promise.resolve(),
  },
  asAbsolutePath: (relativePath) => relativePath,
  storagePath: undefined,
  globalStoragePath: '',
  logPath: '',
};
(0, bun_test_1.describe)('Bitcoin Extension Tests', () => {
  // Extension activation test
  (0, bun_test_1.test)('Extension activation', async () => {
    await (0, extension_1.activate)(mockContext);
    (0, bun_test_1.expect)(mockContext.subscriptions).toHaveLength(28); // One for each command
  });
  // Basic functionality tests
  (0, bun_test_1.test)('HD key generation and derivation', () => {
    // Test HD key generation
    const hdKey = sdk_1.HD.fromRandom();
    (0, bun_test_1.expect)(hdKey).toBeDefined();
    (0, bun_test_1.expect)(hdKey.toString()).toMatch(/^xprv/);
    // Test derivation
    const child = hdKey.derive("m/44'/0'/0'/0/0");
    (0, bun_test_1.expect)(child).toBeDefined();
    (0, bun_test_1.expect)(child.toString()).toMatch(/^xprv/);
    // Test public derivation
    const hdPub = hdKey.toPublic();
    (0, bun_test_1.expect)(hdPub).toBeDefined();
    (0, bun_test_1.expect)(hdPub.toString()).toMatch(/^xpub/);
  });
  (0, bun_test_1.test)('Private key operations', () => {
    // Test random generation
    const privKey = sdk_1.PrivateKey.fromRandom();
    (0, bun_test_1.expect)(privKey).toBeDefined();
    (0, bun_test_1.expect)(privKey.toWif()).toMatch(
      /^[KL][1-9A-HJ-NP-Za-km-z]{51}/,
    );
    // Test WIF conversion
    const wif = privKey.toWif();
    const fromWif = sdk_1.PrivateKey.fromWif(wif);
    (0, bun_test_1.expect)(fromWif.toString()).toBe(privKey.toString());
    // Test hex conversion
    const hex = privKey.toString();
    const fromHex = sdk_1.PrivateKey.fromString(hex);
    (0, bun_test_1.expect)(fromHex.toString()).toBe(hex);
  });
  (0, bun_test_1.test)('Public key operations', () => {
    // Test public key derivation
    const privKey = sdk_1.PrivateKey.fromRandom();
    const pubKey = privKey.toPublicKey();
    (0, bun_test_1.expect)(pubKey).toBeDefined();
    (0, bun_test_1.expect)(pubKey.toString()).toMatch(/^0[2-3][0-9A-Fa-f]{64}/);
    // Test public key from string
    const pubKeyStr = pubKey.toString();
    const fromStr = sdk_1.PublicKey.fromString(pubKeyStr);
    (0, bun_test_1.expect)(fromStr.toString()).toBe(pubKeyStr);
  });
  (0, bun_test_1.test)('Script operations', () => {
    const privKey = sdk_1.PrivateKey.fromRandom();
    const pubKey = privKey.toPublicKey();
    // Test P2PKH script creation
    const script = sdk_1.Script.fromASM(
      `OP_DUP OP_HASH160 ${sdk_1.Utils.toHex(
        sdk_1.Utils.toArray(pubKey.toHash()),
      )} OP_EQUALVERIFY OP_CHECKSIG`,
    );
    (0, bun_test_1.expect)(script).toBeDefined();
    (0, bun_test_1.expect)(script.toASM()).toContain('OP_DUP OP_HASH160');
    // Test script to ASM conversion
    const asm = script.toASM();
    const fromAsm = sdk_1.Script.fromASM(asm);
    (0, bun_test_1.expect)(fromAsm.toHex()).toBe(script.toHex());
  });
  (0, bun_test_1.test)('Address generation and validation', () => {
    // Test P2PKH address from private key
    const privKey = sdk_1.PrivateKey.fromRandom();
    const pubKey = privKey.toPublicKey();
    const script = sdk_1.Script.fromASM(
      `OP_DUP OP_HASH160 ${sdk_1.Utils.toHex(
        sdk_1.Utils.toArray(pubKey.toHash()),
      )} OP_EQUALVERIFY OP_CHECKSIG`,
    );
    const address = sdk_1.Utils.toBase58Check(
      sdk_1.Utils.toArray(script.toHex()),
    );
    (0, bun_test_1.expect)(address).toBeDefined();
    (0, bun_test_1.expect)(address).toMatch(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}/);
    // Test address from WIF
    const wif = privKey.toWif();
    const fromWif = sdk_1.PrivateKey.fromWif(wif);
    const addressFromWif = sdk_1.Utils.toBase58Check(
      sdk_1.Utils.toArray(
        sdk_1.Script.fromASM(
          `OP_DUP OP_HASH160 ${sdk_1.Utils.toHex(
            sdk_1.Utils.toArray(fromWif.toPublicKey().toHash()),
          )} OP_EQUALVERIFY OP_CHECKSIG`,
        ).toHex(),
      ),
    );
    (0, bun_test_1.expect)(addressFromWif).toBe(address);
    // Test address from HD key
    const hdKey = sdk_1.HD.fromRandom();
    const child = hdKey.derive("m/44'/0'/0'/0/0");
    const childPrivKey = sdk_1.PrivateKey.fromHex(child.privKey.toString());
    const childPubKey = childPrivKey.toPublicKey();
    const addressFromHD = sdk_1.Utils.toBase58Check(
      sdk_1.Utils.toArray(
        sdk_1.Script.fromASM(
          `OP_DUP OP_HASH160 ${sdk_1.Utils.toHex(
            sdk_1.Utils.toArray(childPubKey.toHash()),
          )} OP_EQUALVERIFY OP_CHECKSIG`,
        ).toHex(),
      ),
    );
    (0, bun_test_1.expect)(addressFromHD).toMatch(
      /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}/,
    );
  });
  (0, bun_test_1.test)('Transaction operations', () => {
    // Test transaction creation
    const tx = new sdk_1.Transaction();
    (0, bun_test_1.expect)(tx).toBeDefined();
    (0, bun_test_1.expect)(tx.inputs).toHaveLength(0);
    (0, bun_test_1.expect)(tx.outputs).toHaveLength(0);
    // Test input/output addition
    const privKey = sdk_1.PrivateKey.fromRandom();
    const pubKey = privKey.toPublicKey();
    const sourceTx = new sdk_1.Transaction();
    sourceTx.addOutput({
      lockingScript: sdk_1.Script.fromASM(
        `OP_DUP OP_HASH160 ${sdk_1.Utils.toHex(
          sdk_1.Utils.toArray(pubKey.toHash()),
        )} OP_EQUALVERIFY OP_CHECKSIG`,
      ),
      satoshis: 2000,
    });
    tx.addInput({
      sourceTransaction: sourceTx,
      sourceOutputIndex: 0,
      unlockingScript: sdk_1.Script.fromASM(
        `OP_DUP OP_HASH160 ${sdk_1.Utils.toHex(
          sdk_1.Utils.toArray(pubKey.toHash()),
        )} OP_EQUALVERIFY OP_CHECKSIG`,
      ),
    });
    tx.addOutput({
      lockingScript: sdk_1.Script.fromASM(
        `OP_DUP OP_HASH160 ${sdk_1.Utils.toHex(
          sdk_1.Utils.toArray(pubKey.toHash()),
        )} OP_EQUALVERIFY OP_CHECKSIG`,
      ),
      satoshis: 1000,
    });
    (0, bun_test_1.expect)(tx.inputs).toHaveLength(1);
    (0, bun_test_1.expect)(tx.outputs).toHaveLength(1);
  });
  (0, bun_test_1.test)('Mnemonic operations', () => {
    // Test mnemonic generation
    const mnemonic = sdk_1.Mnemonic.fromRandom();
    (0, bun_test_1.expect)(mnemonic).toBeDefined();
    (0, bun_test_1.expect)(mnemonic.toString().split(' ').length).toBe(12);
    // Test seed generation
    const seed = mnemonic.toSeed();
    (0, bun_test_1.expect)(seed).toBeDefined();
    // Test HD key from mnemonic
    const hdKey = sdk_1.HD.fromSeed(seed);
    (0, bun_test_1.expect)(hdKey).toBeDefined();
    (0, bun_test_1.expect)(hdKey.toString()).toMatch(/^xprv/);
  });
  // Command registration tests
  (0, bun_test_1.test)('Command registration', async () => {
    const registeredCommands = await setup_1.default.commands.getCommands();
    const expectedCommands = [
      'bitcoin.asmFromScript',
      'bitcoin.addressFromWIF',
      'bitcoin.addressFromPublicKey',
      'bitcoin.addressFromPrivateKey',
      'bitcoin.addressFromHDPublicKey',
      'bitcoin.addressFromHDPrivateKey',
      'bitcoin.generatePublicKey',
      'bitcoin.generatePrivateKey',
      'bitcoin.generateHDPublicKey',
      'bitcoin.getUtxosForAddress',
      'bitcoin.xPubFromxPriv',
      'bitcoin.extendedPrivateKeyFromMnemonic',
      'bitcoin.generateHDPrivateKey',
      'bitcoin.generateMnemonic',
      'bitcoin.generateWIF',
      'bitcoin.getTx',
      'bitcoin.publicKeyFromPrivateKey',
      'bitcoin.decodeRawTx',
      'bitcoin.rawTxToBob',
      'bitcoin.convertData',
      'bitcoin.showKeyVault',
      'bitcoin.test',
      'bitcoin.detectAndConvert',
      'bitcoin.handleOutput',
      'bitcoin.encrypt',
      'bitcoin.decrypt',
      'bitcoin.lookupBapProfile',
      'bitcoin.fetchOrdinalsInscription',
    ];
    for (const cmd of expectedCommands) {
      (0, bun_test_1.expect)(registeredCommands).toContain(cmd);
    }
    (0, bun_test_1.expect)(registeredCommands).toHaveLength(28);
  });
  // Error handling tests
  (0, bun_test_1.test)('Invalid private key handling', () => {
    (0, bun_test_1.expect)(() =>
      sdk_1.PrivateKey.fromString('invalid'),
    ).toThrow('Invalid character in invalid');
  });
  (0, bun_test_1.test)('Invalid public key handling', () => {
    (0, bun_test_1.expect)(() => sdk_1.PublicKey.fromString('invalid')).toThrow(
      'Unknown point format',
    );
  });
  (0, bun_test_1.test)('Invalid WIF handling', () => {
    (0, bun_test_1.expect)(() => sdk_1.PrivateKey.fromWif('invalid')).toThrow(
      'Invalid base58 character',
    );
  });
  (0, bun_test_1.test)('Invalid transaction hex handling', () => {
    const tx = sdk_1.Transaction.fromHex('invalid');
    // SDK returns an empty transaction for invalid hex
    (0, bun_test_1.expect)(tx.inputs).toHaveLength(0);
    (0, bun_test_1.expect)(tx.outputs).toHaveLength(0);
    (0, bun_test_1.expect)(tx.toHex()).toBe('00000a00000000000000'); // Version 10 (0x0a), no inputs, no outputs
  });
  (0, bun_test_1.test)('Invalid mnemonic handling', () => {
    const mnemonic = sdk_1.Mnemonic.fromString('invalid mnemonic phrase');
    // SDK returns an invalid mnemonic object
    (0, bun_test_1.expect)(mnemonic.isValid()).toBe(false);
    (0, bun_test_1.expect)(() => mnemonic.toSeed()).toThrow(
      'Mnemonic does not pass the check',
    );
  });
  // Transaction format conversion tests
  (0, bun_test_1.test)('Transaction format conversion', async () => {
    // Create a valid transaction for testing
    const tx = new sdk_1.Transaction();
    const privKey = sdk_1.PrivateKey.fromRandom();
    const pubKey = privKey.toPublicKey();
    // Create a source transaction with funding
    const sourceTx = new sdk_1.Transaction();
    sourceTx.addOutput({
      lockingScript: sdk_1.Script.fromASM(
        `OP_DUP OP_HASH160 ${sdk_1.Utils.toHex(
          sdk_1.Utils.toArray(pubKey.toHash()),
        )} OP_EQUALVERIFY OP_CHECKSIG`,
      ),
      satoshis: 2000,
    });
    // Create a spending transaction
    tx.addInput({
      sourceTransaction: sourceTx,
      sourceOutputIndex: 0,
      unlockingScript: sdk_1.Script.fromASM(
        `OP_DUP OP_HASH160 ${sdk_1.Utils.toHex(
          sdk_1.Utils.toArray(pubKey.toHash()),
        )} OP_EQUALVERIFY OP_CHECKSIG`,
      ),
    });
    tx.addOutput({
      lockingScript: sdk_1.Script.fromASM(
        `OP_DUP OP_HASH160 ${sdk_1.Utils.toHex(
          sdk_1.Utils.toArray(pubKey.toHash()),
        )} OP_EQUALVERIFY OP_CHECKSIG`,
      ),
      satoshis: 1000,
    });
    // Test hex format
    const txHex = tx.toHex();
    (0, bun_test_1.expect)(txHex).toBeDefined();
    (0, bun_test_1.expect)(txHex.length).toBeGreaterThan(0);
    // Test BEEF format (requires source transactions)
    const beefTx = tx.toBEEF();
    (0, bun_test_1.expect)(beefTx).toBeDefined();
    (0, bun_test_1.expect)(beefTx.length).toBeGreaterThan(0);
    // Test EF format
    const efTx = tx.toEF();
    (0, bun_test_1.expect)(efTx).toBeDefined();
    (0, bun_test_1.expect)(efTx.length).toBeGreaterThan(0);
    // Test BOB format
    const bob = await (0, bpu_ts_1.parse)({
      tx: { r: txHex },
      split: [{ token: { op: 106 }, include: 'l' }, { token: { s: '|' } }],
    });
    (0, bun_test_1.expect)(bob).toBeDefined();
    (0, bun_test_1.expect)(bob.tx).toBeDefined();
    (0, bun_test_1.expect)(bob.in).toHaveLength(1);
    (0, bun_test_1.expect)(bob.out).toHaveLength(1);
    console.log('Parsed BOB:', JSON.stringify(bob, null, 2));
    // Test BMAP format
    console.log('Transforming transaction with bmapjs...');
    const bmapResult = await (0, bmapjs_1.TransformTx)(
      bob,
      bmapjs_1.allProtocols.map((p) => p.name),
    );
    (0, bun_test_1.expect)(bmapResult).toBeDefined();
    (0, bun_test_1.expect)(bmapResult.tx).toBeDefined();
  });
  // Data conversion tests
  (0, bun_test_1.describe)('Data Conversion', () => {
    (0, bun_test_1.test)('Format detection', () => {
      // Test hex detection
      (0, bun_test_1.expect)((0, extension_1.detectFormat)('48656c6c6f')).toBe(
        'hex',
      );
      (0, bun_test_1.expect)((0, extension_1.detectFormat)('not-hex-123')).toBe(
        'unknown',
      );
      // Test base64 detection
      (0, bun_test_1.expect)((0, extension_1.detectFormat)('SGVsbG8=')).toBe(
        'base64',
      );
      (0, bun_test_1.expect)((0, extension_1.detectFormat)('not-base64!')).toBe(
        'unknown',
      );
      // Test binary array detection
      (0, bun_test_1.expect)(
        (0, extension_1.detectFormat)('[72,101,108,108,111]'),
      ).toBe('binary');
      (0, bun_test_1.expect)(
        (0, extension_1.detectFormat)('[1,2,invalid]'),
      ).toBe('unknown');
    });
    (0, bun_test_1.test)('Hex conversions', () => {
      const hex = '48656c6c6f'; // "Hello" in hex
      // Hex to base64
      (0, bun_test_1.expect)(
        (0, extension_1.convertData)(hex, 'hex', 'base64'),
      ).toBe('SGVsbG8=');
      // Hex to binary
      (0, bun_test_1.expect)(
        (0, extension_1.convertData)(hex, 'hex', 'binary'),
      ).toBe('[72,101,108,108,111]');
    });
    (0, bun_test_1.test)('Base64 conversions', () => {
      const base64 = 'SGVsbG8='; // "Hello" in base64
      // Base64 to hex
      (0, bun_test_1.expect)(
        (0, extension_1.convertData)(base64, 'base64', 'hex'),
      ).toBe('48656c6c6f');
      // Base64 to binary
      (0, bun_test_1.expect)(
        (0, extension_1.convertData)(base64, 'base64', 'binary'),
      ).toBe('[72,101,108,108,111]');
    });
    (0, bun_test_1.test)('Binary array conversions', () => {
      const binary = '[72,101,108,108,111]'; // "Hello" as byte array
      // Binary to hex
      (0, bun_test_1.expect)(
        (0, extension_1.convertData)(binary, 'binary', 'hex'),
      ).toBe('48656c6c6f');
      // Binary to base64
      (0, bun_test_1.expect)(
        (0, extension_1.convertData)(binary, 'binary', 'base64'),
      ).toBe('SGVsbG8=');
    });
    (0, bun_test_1.test)('Error handling', () => {
      // Invalid hex
      (0, bun_test_1.expect)(() =>
        (0, extension_1.convertData)('not-hex', 'hex', 'base64'),
      ).toThrow();
      // Invalid base64
      (0, bun_test_1.expect)(() =>
        (0, extension_1.convertData)('not-base64!', 'base64', 'hex'),
      ).toThrow();
      // Invalid binary array
      (0, bun_test_1.expect)(() =>
        (0, extension_1.convertData)('[1,2,invalid]', 'binary', 'hex'),
      ).toThrow();
      // Invalid format types
      (0, bun_test_1.expect)(() =>
        (0, extension_1.convertData)('48656c6c6f', 'hex', 'invalid-format'),
      ).toThrow('Unsupported output format');
      (0, bun_test_1.expect)(() =>
        (0, extension_1.convertData)('48656c6c6f', 'invalid-format', 'hex'),
      ).toThrow('Unsupported input format');
    });
    (0, bun_test_1.test)('Round trip conversions', () => {
      const originalHex = '48656c6c6f';
      // Hex -> Base64 -> Hex
      (0, bun_test_1.expect)(
        (0, extension_1.convertData)(
          (0, extension_1.convertData)(originalHex, 'hex', 'base64'),
          'base64',
          'hex',
        ),
      ).toBe(originalHex);
      // Hex -> Binary -> Hex
      (0, bun_test_1.expect)(
        (0, extension_1.convertData)(
          (0, extension_1.convertData)(originalHex, 'hex', 'binary'),
          'binary',
          'hex',
        ),
      ).toBe(originalHex);
      // Base64 -> Binary -> Base64
      const originalBase64 = 'SGVsbG8=';
      (0, bun_test_1.expect)(
        (0, extension_1.convertData)(
          (0, extension_1.convertData)(originalBase64, 'base64', 'binary'),
          'binary',
          'base64',
        ),
      ).toBe(originalBase64);
    });
  });
});
//# sourceMappingURL=extension.test.js.map
