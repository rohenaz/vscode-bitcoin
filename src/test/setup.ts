import type { WebviewOptions, WebviewPanel, Uri, ViewColumn, Disposable, WebviewPanelOptions, WebviewPanelOnDidChangeViewStateEvent } from 'vscode';

// Track executed commands
const executedCommands: string[] = [];

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

interface VSCodeMock {
  window: {
    createWebviewPanel: (viewType: string, title: string, column: ViewColumn, options: WebviewPanelOptions & WebviewOptions) => WebviewPanel;
    showInformationMessage: <T extends string>(message: string, ...items: T[]) => Promise<T | undefined>;
    showWarningMessage: <T extends string>(message: string, ...items: T[]) => Promise<T | undefined>;
    showErrorMessage: <T extends string>(message: string, ...items: T[]) => Promise<T | undefined>;
    showInputBox: (options?: { prompt?: string; value?: string }) => Promise<string | undefined>;
    showQuickPick: (items: string[], options?: { placeHolder?: string }) => Promise<string | undefined>;
    showTextDocument: (document: { uri: Uri }) => Promise<void>;
    activeTextEditor: {
      document: { getText: () => string; uri: { fsPath: string } };
      selection: { isEmpty: boolean };
    };
  };
  commands: {
    registerCommand: (command: string, callback: (...args: unknown[]) => unknown) => Disposable;
    executeCommand: <T>(command: string, ...args: unknown[]) => Promise<T>;
    getCommands: () => Promise<string[]>;
  };
  workspace: {
    workspaceFolders: { uri: { fsPath: string }; name: string; index: number }[];
    openTextDocument: (uri: Uri) => Promise<{ getText: () => string; save: () => Promise<void> }>;
    getConfiguration: (section?: string) => {
      get: <T>(key: string) => T | undefined;
      update: <T>(key: string, value: T) => Promise<void>;
    };
    fs: {
      writeFile: (uri: Uri, content: Uint8Array) => Promise<void>;
      readFile: (uri: Uri) => Promise<Uint8Array>;
      createDirectory: (uri: Uri) => Promise<void>;
      stat: (uri: Uri) => Promise<{ type: number; size: number; ctime: number; mtime: number }>;
      readDirectory: (uri: Uri) => Promise<[string, number][]>;
    };
  };
  Uri: {
    file: (path: string) => Uri;
    parse: (path: string) => Uri;
  };
  ViewColumn: {
    One: number;
    Two: number;
    Three: number;
    Active: number;
    Beside: number;
  };
}

// Create mock VS Code instance
const mockVSCode: VSCodeMock = {
  window: {
    createWebviewPanel: (_viewType: string, _title: string, _column: ViewColumn, _options: WebviewPanelOptions & WebviewOptions): WebviewPanel => ({
      webview: {
        html: '',
        onDidReceiveMessage: () => ({ dispose: () => {} }),
        postMessage: async () => Promise.resolve(true),
        asWebviewUri: (uri: Uri) => uri,
        options: _options,
        cspSource: 'mockCspSource',
      },
      onDidDispose: () => ({ dispose: () => {} }),
      reveal: () => {},
      dispose: () => {},
      title: _title,
      viewType: _viewType,
      options: _options,
      viewColumn: _column,
      active: true,
      visible: true,
      onDidChangeViewState: (listener: (e: WebviewPanelOnDidChangeViewStateEvent) => unknown) => ({ dispose: () => {} }),
    }),
    showInformationMessage: async () => undefined,
    showWarningMessage: async () => undefined,
    showErrorMessage: async <T extends string>(_message: string, ..._items: T[]) => undefined,
    showInputBox: async () => '',
    showQuickPick: async () => '',
    showTextDocument: async () => Promise.resolve(),
    activeTextEditor: {
      document: { getText: () => '', uri: { fsPath: '' } },
      selection: { isEmpty: true },
    },
  },
  commands: {
    registerCommand: () => ({ dispose: () => {} }),
    executeCommand: async <T>(command: string): Promise<T> => {
      executedCommands.push(command);
      return undefined as unknown as T;
    },
    getCommands: async () => mockCommands,
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' }, name: 'test', index: 0 }],
    openTextDocument: async () => ({ getText: () => '', save: () => Promise.resolve() }),
    getConfiguration: (section?: string) => ({
      get: <T>(key: string): T | undefined => {
        if (section === 'bitcoin') {
          switch (key) {
            case 'workspace.path':
              return '.bitcoin' as unknown as T;
            case 'workspace.detectContentType':
              return true as unknown as T;
            case 'workspace.organizeFolders':
              return true as unknown as T;
            default:
              return undefined;
          }
        }
        return undefined;
      },
      update: async () => Promise.resolve(),
    }),
    fs: {
      writeFile: async () => {},
      readFile: async () => new Uint8Array(),
      createDirectory: async () => {},
      stat: async () => ({ type: 1, size: 0, ctime: 0, mtime: 0 }),
      readDirectory: async () => [],
    },
  },
  Uri: {
    file: (path: string): Uri => ({
      fsPath: path,
      scheme: 'file',
      authority: '',
      path,
      query: '',
      fragment: '',
      with: function() { return this; },
      toJSON: () => ({}),
    }),
    parse: (path: string): Uri => ({ 
      fsPath: path,
      scheme: 'file',
      authority: '',
      path,
      query: '',
      fragment: '',
      with: function() { return this; },
      toJSON: () => ({}),
    }),
  },
  ViewColumn: { One: 1, Two: 2, Three: 3, Active: -1, Beside: -2 },
};

// Register mock globally
(globalThis as unknown as { vscode: VSCodeMock }).vscode = mockVSCode;

// Export for direct imports
export { executedCommands };
export default mockVSCode;

// ... rest of the existing code ...