// Mock VS Code API
export const commands = {
  getCommands: () => Promise.resolve([
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
    'bitcoin.rawTxToTxo',
    'bitcoin.rawTxToBob'
  ]),
  registerCommand: (command: string, callback: (...args: unknown[]) => unknown) => ({
    dispose: () => {},
  }),
};

export const env = {
  clipboard: {
    writeText: (text: string) => Promise.resolve(),
    readText: () => Promise.resolve(''),
  },
};

export const window = {
  showInformationMessage: (message: string) => Promise.resolve(),
  showInputBox: () => Promise.resolve(''),
  showTextDocument: () => Promise.resolve(),
};

export const workspace = {
  openTextDocument: () => Promise.resolve({
    getText: () => '',
    save: () => Promise.resolve(),
  }),
};

// Mock browser APIs
Object.assign(globalThis, {
  requestAnimationFrame: (cb: (time: number) => void) => setTimeout(() => cb(Date.now()), 0),
  cancelAnimationFrame: clearTimeout,
});
