class MockEventEmitter {
  constructor() {
    this.listeners = [];
  }
  fire(data) {
    for (const listener of this.listeners) {
      listener(data);
    }
  }
  event(listener) {
    this.listeners.push(listener);
    return {
      dispose: () => {
        const idx = this.listeners.indexOf(listener);
        if (idx >= 0) {
          this.listeners.splice(idx, 1);
        }
      },
    };
  }
}
class MockExtensionContext {
  constructor() {
    this.subscriptions = [];
    this.globalState = {
      get: () => undefined,
      update: () => Promise.resolve(),
    };
    this.workspaceState = {
      get: () => undefined,
      update: () => Promise.resolve(),
    };
    this.extensionUri = { fsPath: '' };
    this.storagePath = '';
    this.globalStoragePath = '';
    this.logPath = '';
    this.extensionPath = '';
    this.environmentVariableCollection = {
      replace: () => {},
      persistent: true,
    };
    this.secrets = {
      store: () => Promise.resolve(),
      get: () => Promise.resolve(''),
      delete: () => Promise.resolve(),
    };
  }
  asAbsolutePath(relativePath) {
    return relativePath;
  }
}
// Mock commands
const mockCommands = [
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
const vscode = {
  EventEmitter: MockEventEmitter,
  window: {
    showInformationMessage: async (_message) => {},
    showWarningMessage: async (_message) => {},
    showErrorMessage: async (_message) => {},
    showInputBox: async (_options) => '',
    showQuickPick: async (_items, _options) => '',
    createWebviewPanel: () => ({
      webview: {
        html: '',
        onDidReceiveMessage: () => ({ dispose: () => {} }),
        postMessage: () => Promise.resolve(),
      },
      onDidDispose: () => ({ dispose: () => {} }),
      reveal: () => {},
      dispose: () => {},
    }),
    showTextDocument: async () => {},
    activeTextEditor: {
      document: {
        getText: () => '',
        uri: { fsPath: '' },
      },
      selection: {
        isEmpty: true,
      },
    },
  },
  commands: {
    registerCommand: (_cmd, _callback) => ({
      dispose: () => {},
    }),
    getCommands: async () => mockCommands,
  },
  env: {
    clipboard: {
      writeText: async (_text) => {},
    },
  },
  workspace: {
    workspaceFolders: [
      {
        uri: { fsPath: process.cwd() },
        name: 'test',
        index: 0,
      },
    ],
    openTextDocument: async (_uri) => ({
      getText: () => '',
      save: () => Promise.resolve(),
    }),
    getConfiguration: () => ({
      get: (key) => {
        switch (key) {
          case 'workspace.path':
            return '.bitcoin';
          case 'workspace.detectContentType':
            return true;
          case 'workspace.organizeFolders':
            return true;
          default:
            return undefined;
        }
      },
    }),
    fs: {
      writeFile: async (_uri, _content) => {},
      readFile: async (_uri) => new Uint8Array(),
      createDirectory: async (_uri) => {},
      stat: async (_uri) => ({
        type: 1,
        size: 0,
        ctime: 0,
        mtime: 0,
      }),
      readDirectory: async (_uri) => [],
    },
  },
  ExtensionContext: MockExtensionContext,
  Uri: {
    file: (path) => ({ fsPath: path }),
    parse: (path) => ({ fsPath: path }),
  },
};
globalThis.require = (id) => {
  if (id === 'vscode') return vscode;
  if (id === 'fs')
    return {
      existsSync: () => true,
      mkdirSync: () => {},
      writeFileSync: () => {},
      readFileSync: () => Buffer.from(''),
      readdirSync: () => [],
      statSync: () => ({
        isDirectory: () => true,
        isFile: () => true,
      }),
    };
  throw new Error(`Cannot find module '${id}'`);
};
module.exports = vscode;
//# sourceMappingURL=setup.js.map
