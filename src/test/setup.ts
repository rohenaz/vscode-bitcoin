import { QuickPickOptions } from 'src/vsShim';
import type {
  CancellationToken,
  Disposable,
  Event,
  ExtensionContext,
  OutputChannel,
  Progress,
  ProgressLocation,
  TextDocument,
  TextDocumentShowOptions,
  TextEditor,
  Uri,
  ViewColumn,
  WebviewOptions,
  WebviewPanel,
  WebviewPanelOnDidChangeViewStateEvent,
  WebviewPanelOptions,
  WebviewView,
  WebviewViewProvider,
  DocumentSelector,
  DocumentSemanticTokensProvider,
  SemanticTokensLegend as VSSemanticTokensLegend,
  HoverProvider,
  SemanticTokens,
} from 'vscode';

// Re-export types that our code needs
export type {
  WebviewOptions,
  WebviewPanel,
  Uri,
  ViewColumn,
  Disposable,
  WebviewPanelOptions,
  WebviewPanelOnDidChangeViewStateEvent,
  ExtensionContext,
  Event,
  OutputChannel,
  WebviewView,
  WebviewViewProvider,
  TextDocument,
  TextEditor,
  TextDocumentShowOptions,
  ProgressLocation,
  Progress,
  CancellationToken,
  SemanticTokensBuilder,
  SemanticTokensLegend,
  SemanticTokens,
};

// Track executed commands
const executedCommands: string[] = [];

// Default workspace configuration
const defaultWorkspaceConfig = {
  'workspace.path': '.bitcoin',
  'workspace.detectContentType': true,
  'workspace.organizeFolders': true,
};

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
  'bitcoin.publicKeyFromWIF',
  'bitcoin.decodeRawTx',
  'bitcoin.rawTxToBob',
  'bitcoin.convertData',
  'bitcoin.openConversionTool',
  'bitcoin.showKeyVault',
  'bitcoin.test',
  'bitcoin.detectAndConvert',
  'bitcoin.decodeFile',
  'bitcoin.handleOutput',
  'bitcoin.encrypt',
  'bitcoin.decrypt',
  'bitcoin.lookupBapProfile',
  'bitcoin.fetchOrdinalsInscription',
  'bitcoin.resetWelcomeScreen',
];

// Mock EventEmitter class
class EventEmitter<T> {
  private listeners: Array<(e: T) => unknown> = [];

  fire(data: T): void {
    for (const listener of this.listeners) {
      listener(data);
    }
  }

  event(listener: (e: T) => unknown): Disposable {
    this.listeners.push(listener);
    return {
      dispose: () => {
        const index = this.listeners.indexOf(listener);
        if (index > -1) {
          this.listeners.splice(index, 1);
        }
      },
    };
  }
}

// Mock SecretStorage
interface SecretStorageChangeEvent {
  readonly key: string;
}

class SecretStorage {
  private storage = new Map<string, string>();
  private onDidChangeEmitter = new EventEmitter<SecretStorageChangeEvent>();

  constructor() {
    // Initialize with any persisted data if needed
    this.storage = new Map<string, string>();
  }

  async get(key: string): Promise<string | undefined> {
    const value = this.storage.get(key);
    console.log('SecretStorage.get', { key, value });
    return value;
  }

  async store(key: string, value: string): Promise<void> {
    console.log('SecretStorage.store', { key, value });
    this.storage.set(key, value);
    this.onDidChangeEmitter.fire({ key });
  }

  async delete(key: string): Promise<void> {
    console.log('SecretStorage.delete', { key });
    this.storage.delete(key);
    this.onDidChangeEmitter.fire({ key });
  }

  get onDidChange(): Event<SecretStorageChangeEvent> {
    return this.onDidChangeEmitter.event;
  }

  // Helper method for tests to clear storage
  clear(): void {
    console.log('SecretStorage.clear');
    this.storage.clear();
  }
}

// Add semantic token types
class SemanticTokensBuilder {
  push(line: number, char: number, length: number, tokenType: number): void {}
  build(): { data: Uint32Array } {
    return { data: new Uint32Array() };
  }
}

class SemanticTokensLegend {}

// Update mockVSCode interface
interface VSCodeMock {
  EventEmitter: typeof EventEmitter;
  SecretStorage: typeof SecretStorage;
  ExtensionContext: {
    new (): {
      subscriptions: Disposable[];
      secrets: SecretStorage;
      extensionPath: string;
      globalState: {
        get: <T>(key: string) => T | undefined;
        update: (key: string, value: unknown) => Promise<void>;
      };
      workspaceState: {
        get: <T>(key: string) => T | undefined;
        update: (key: string, value: unknown) => Promise<void>;
      };
    };
  };
  window: {
    createWebviewPanel: (
      viewType: string,
      title: string,
      column: ViewColumn,
      options: WebviewPanelOptions & WebviewOptions,
    ) => WebviewPanel;
    registerWebviewViewProvider: (
      viewType: string,
      provider: WebviewViewProvider,
      options?: { webviewOptions?: WebviewOptions },
    ) => Disposable;
    showInformationMessage: <T extends string>(
      message: string,
      ...items: T[]
    ) => Promise<T | undefined>;
    showWarningMessage: <T extends string>(
      message: string,
      ...items: T[]
    ) => Promise<T | undefined>;
    showErrorMessage: <T extends string>(
      message: string,
      ...items: T[]
    ) => Promise<T | undefined>;
    showInputBox: (options?: { prompt?: string; value?: string }) => Promise<
      string | undefined
    >;
    showQuickPick: (
      items: string[],
      options?: QuickPickOptions,
    ) => Promise<string | undefined>;
    showTextDocument: (document: { uri: Uri }) => Promise<void>;
    activeTextEditor: {
      document: { getText: () => string; uri: { fsPath: string } };
      selection: { isEmpty: boolean };
    };
    withProgress: <T>(
      options: {
        location: number;
        title?: string;
        cancellable?: boolean;
      },
      task: (
        progress: Progress<{ message?: string; increment?: number }>,
        token: CancellationToken,
      ) => Promise<T>,
    ) => Promise<T>;
  };
  commands: {
    registerCommand: (
      command: string,
      callback: (...args: unknown[]) => unknown,
    ) => Disposable;
    executeCommand: <T>(command: string, ...args: unknown[]) => Promise<T>;
    getCommands: () => Promise<string[]>;
  };
  workspace: {
    workspaceFolders: {
      uri: { fsPath: string };
      name: string;
      index: number;
    }[];
    openTextDocument: (
      uri: Uri,
    ) => Promise<{ getText: () => string; save: () => Promise<void> }>;
    getConfiguration: (section?: string) => {
      get: <T>(key: string) => T | undefined;
      update: <T>(key: string, value: T) => Promise<void>;
      has: (key: string) => boolean;
    };
    fs: {
      writeFile: (uri: Uri, content: Uint8Array) => Promise<void>;
      readFile: (uri: Uri) => Promise<Uint8Array>;
      createDirectory: (uri: Uri) => Promise<void>;
      stat: (uri: Uri) => Promise<{
        type: number;
        size: number;
        ctime: number;
        mtime: number;
      }>;
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
  ProgressLocation: {
    Notification: 1;
    SourceControl: 2;
    Window: 3;
  };
  SemanticTokensBuilder: typeof SemanticTokensBuilder;
  SemanticTokensLegend: typeof SemanticTokensLegend;
  languages: {
    registerDocumentSemanticTokensProvider: (
      selector: DocumentSelector,
      provider: DocumentSemanticTokensProvider,
      legend: VSSemanticTokensLegend
    ) => Disposable;
    registerHoverProvider: (
      selector: DocumentSelector,
      provider: HoverProvider
    ) => Disposable;
  }
}

// Create mock VS Code instance
const mockVSCode: VSCodeMock = {
  EventEmitter,
  SecretStorage,
  ExtensionContext: class {
    subscriptions: Disposable[] = [];
    secrets = new SecretStorage();
    extensionPath = '/test/extension/path';
    globalState = {
      get: <T>(_key: string) => undefined as T | undefined,
      update: async (_key: string, _value: unknown) => {},
    };
    workspaceState = {
      get: <T>(_key: string) => undefined as T | undefined,
      update: async (_key: string, _value: unknown) => {},
    };
  },
  window: {
    createWebviewPanel: (
      _viewType: string,
      _title: string,
      _column: ViewColumn,
      _options: WebviewPanelOptions & WebviewOptions,
    ): WebviewPanel => ({
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
      onDidChangeViewState: (
        _listener: (e: WebviewPanelOnDidChangeViewStateEvent) => unknown,
      ) => ({ dispose: () => {} }),
    }),
    registerWebviewViewProvider: () => ({ dispose: () => {} }),
    showInformationMessage: async () => undefined,
    showWarningMessage: async <T extends string>(
      _message: string,
      ..._items: Array<T | { modal?: boolean }>
    ) => 'Delete' as T,
    showErrorMessage: async <T extends string>(
      _message: string,
      ..._items: T[]
    ) => undefined,
    showInputBox: async () => '',
    showQuickPick: async () => '',
    showTextDocument: async () => Promise.resolve(),
    activeTextEditor: {
      document: { getText: () => '', uri: { fsPath: '' } },
      selection: { isEmpty: true },
    },
    withProgress: async <T>(
      _options: {
        location: number;
        title?: string;
        cancellable?: boolean;
      },
      task: (
        progress: Progress<{ message?: string; increment?: number }>,
        token: CancellationToken,
      ) => Promise<T>,
    ): Promise<T> => {
      const progress: Progress<{ message?: string; increment?: number }> = {
        report: () => {},
      };
      const token: CancellationToken = {
        isCancellationRequested: false,
        onCancellationRequested: () => ({ dispose: () => {} }),
      };
      return task(progress, token);
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
    workspaceFolders: [
      { uri: { fsPath: '/test/workspace' }, name: 'test', index: 0 },
    ],
    openTextDocument: async () => ({
      getText: () => '',
      save: () => Promise.resolve(),
    }),
    getConfiguration: (section?: string) => ({
      get: <T>(key: string): T | undefined => {
        if (section === 'bitcoin') {
          const value =
            defaultWorkspaceConfig[key as keyof typeof defaultWorkspaceConfig];
          return value as T;
        }
        return undefined;
      },
      update: async () => Promise.resolve(),
      has: (key: string) => key in defaultWorkspaceConfig,
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
      with: function () {
        return this;
      },
      toJSON: () => ({}),
    }),
    parse: (path: string): Uri => ({
      fsPath: path,
      scheme: 'file',
      authority: '',
      path,
      query: '',
      fragment: '',
      with: function () {
        return this;
      },
      toJSON: () => ({}),
    }),
  },
  ViewColumn: { One: 1, Two: 2, Three: 3, Active: -1, Beside: -2 },
  ProgressLocation: {
    Notification: 1,
    SourceControl: 2,
    Window: 3,
  },
  SemanticTokensBuilder,
  SemanticTokensLegend,
  languages: {
    registerDocumentSemanticTokensProvider: (
      _selector: DocumentSelector,
      _provider: DocumentSemanticTokensProvider,
      _legend: VSSemanticTokensLegend
    ) => ({ dispose: () => {} }),
    registerHoverProvider: (
      _selector: DocumentSelector,
      _provider: HoverProvider
    ) => ({ dispose: () => {} })
  }
};

// Patch globalThis.require if Bun is using `require` under the hood
if (typeof globalThis.require === 'function') {
  const originalRequire = globalThis.require as NodeRequire;
  const patchedRequire = ((id: string) => {
    if (id === 'vscode') {
      return mockVSCode;
    }
    return originalRequire(id);
  }) as NodeRequire;

  patchedRequire.resolve = originalRequire.resolve;
  patchedRequire.cache = originalRequire.cache;
  patchedRequire.extensions = originalRequire.extensions;
  patchedRequire.main = originalRequire.main;

  globalThis.require = patchedRequire;
}

// Export for direct imports
export { executedCommands };
export default mockVSCode;
