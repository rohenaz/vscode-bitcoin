class MockEventEmitter<T> {
  private listeners: Array<(e: T) => void> = [];

  fire(data: T): void {
    for (const listener of this.listeners) {
      listener(data);
    }
  }

  event(listener: (e: T) => void): { dispose: () => void } {
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
  subscriptions: { dispose(): void }[] = [];
  globalState = { get: () => undefined, update: () => Promise.resolve() };
  workspaceState = { get: () => undefined, update: () => Promise.resolve() };
  extensionUri = { fsPath: '' };
  asAbsolutePath(relativePath: string): string {
    return relativePath;
  }
  storagePath = '';
  globalStoragePath = '';
  logPath = '';
  extensionPath = '';
  environmentVariableCollection = { replace: () => {}, persistent: true };
  secrets = {
    store: () => Promise.resolve(),
    get: () => Promise.resolve(''),
    delete: () => Promise.resolve(),
  };
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

interface VSCodeOptions {
  placeHolder?: string;
  prompt?: string;
  value?: string;
  password?: boolean;
  ignoreFocusOut?: boolean;
}

interface VSCodeQuickPickOptions {
  placeHolder?: string;
  ignoreFocusOut?: boolean;
  matchOnDescription?: boolean;
  matchOnDetail?: boolean;
}

const executedCommands: string[] = [];

const vscode = {
  EventEmitter: MockEventEmitter,
  window: {
    showInformationMessage: async () => {},
    showWarningMessage: async (_message: string) => {},
    showErrorMessage: async (_message: string, ..._items: string[]): Promise<string> => 'Error',
    showInputBox: async (_options: VSCodeOptions) => '',
    showQuickPick: async (_items: string[], _options: VSCodeQuickPickOptions) =>
      '',
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
    registerCommand: (_cmd: string, _callback: () => void) => ({
      dispose: () => {},
    }),
    executeCommand: async (command: string) => {
      executedCommands.push(command);
      return command;
    },
    getCommands: async () => mockCommands,
  },
  env: {
    clipboard: {
      writeText: async (_text: string) => {},
      readText: async () => '',
    },
  },
  workspace: {
    workspaceFolders: [
      {
        uri: { fsPath: '/test/workspace' },
        name: 'test',
        index: 0,
      },
    ],
    openTextDocument: async (_uri: { fsPath: string }) => ({
      getText: () => '',
      save: () => Promise.resolve(),
    }),
    getConfiguration: () => ({
      get: (key: string) => {
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
      writeFile: async (_uri: { fsPath: string }, _content: Uint8Array) => {},
      readFile: async (_uri: { fsPath: string }) => new Uint8Array(),
      createDirectory: async (_uri: { fsPath: string }) => {},
      stat: async (_uri: { fsPath: string }) => ({
        type: 1,
        size: 0,
        ctime: 0,
        mtime: 0,
      }),
      readDirectory: async (_uri: { fsPath: string }) => [],
    },
  },
  ExtensionContext: MockExtensionContext,
  Uri: {
    file: (path: string) => ({
      fsPath: path,
      scheme: 'file',
      authority: '',
      path: path,
      query: '',
      fragment: '',
      with: function () {
        return this;
      },
      toJSON: () => ({}),
    }),
    parse: (path: string) => ({ fsPath: path }),
  },
  ViewColumn: {
    One: 1,
    Two: 2,
    Three: 3,
    Active: -1,
    Beside: -2,
  },
};

declare global {
  var require: NodeRequire;
}

(globalThis.require as unknown as (id: string) => unknown) = (id: string) => {
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

export { executedCommands };
export default vscode;