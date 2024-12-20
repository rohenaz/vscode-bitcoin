declare global {
  // Minimal NodeRequire interface for our needs
  interface NodeRequire {
    (id: string): unknown;
    resolve: (id: string) => string;
    cache: Record<string, unknown>;
    extensions: Record<string, unknown>;
    main: unknown;
  }
  var require: NodeRequire;
}

// VS Code API types
export interface ExtensionContext {
  subscriptions: Array<{ dispose(): void }>;
  workspaceState: Memento;
  globalState: Memento & { setKeysForSync(keys: readonly string[]): void };
  secrets: SecretStorage;
  extensionUri: Uri;
  extensionPath: string;
  asAbsolutePath(relativePath: string): string;
  storageUri: Uri | undefined;
  globalStorageUri: Uri;
  logUri: Uri;
  extensionMode: ExtensionMode;
  environmentVariableCollection: EnvironmentVariableCollection;
  storagePath: string | undefined;
  globalStoragePath: string;
  logPath: string;
  extension: Extension<unknown>;
  languageModelAccessInformation: LanguageModelAccessInformation;
}

export interface LanguageModelAccessInformation {
  keyExpirationTime: number;
  keyExpirationMessage: string | undefined;
}

export interface Extension<T> {
  readonly id: string;
  readonly extensionUri: Uri;
  readonly extensionPath: string;
  readonly isActive: boolean;
  readonly packageJSON: Record<string, unknown>;
  readonly extensionKind: ExtensionKind;
  readonly exports: T;
  activate(): Promise<T>;
}

export enum ExtensionKind {
  UI = 1,
  Workspace = 2,
}

export interface Memento {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): Promise<void>;
  keys(): readonly string[];
}

export interface SecretStorage {
  get(key: string): Promise<string | undefined>;
  store(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  onDidChange: (listener: (e: SecretStorageChangeEvent) => void) => {
    dispose(): void;
  };
}

export interface SecretStorageChangeEvent {
  readonly key: string;
}

export interface Uri {
  scheme: string;
  authority: string;
  path: string;
  query: string;
  fragment: string;
  fsPath: string;
  with(change: {
    scheme?: string;
    authority?: string;
    path?: string;
    query?: string;
    fragment?: string;
  }): Uri;
  toString(skipEncoding?: boolean): string;
  toJSON(): UriComponents;
}

export interface UriComponents {
  scheme: string;
  authority: string;
  path: string;
  query: string;
  fragment: string;
}

export enum ExtensionMode {
  Production = 1,
  Development = 2,
  Test = 3,
}

export interface EnvironmentVariableCollection {
  persistent: boolean;
  replace(variable: string, value: string): void;
  append(variable: string, value: string): void;
  prepend(variable: string, value: string): void;
  get(variable: string): EnvironmentVariableMutator | undefined;
  forEach(
    callback: (variable: string, mutator: EnvironmentVariableMutator) => void
  ): void;
  delete(variable: string): void;
  clear(): void;
}

export interface EnvironmentVariableMutator {
  type: EnvironmentVariableMutatorType;
  value: string;
}

export enum EnvironmentVariableMutatorType {
  Replace = 1,
  Append = 2,
  Prepend = 3,
}

export interface InputBoxOptions {
  value?: string;
  placeHolder?: string;
  prompt?: string;
  validateInput?: (value: string) => string | null | undefined;
}

export interface TextDocumentShowOptions {
  preview?: boolean;
  preserveFocus?: boolean;
  selection?: Range;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface Position {
  line: number;
  character: number;
}

export interface TextDocument {
  getText(): string;
  languageId: string;
}

export interface Window {
  showInformationMessage(message: string): Promise<void>;
  showErrorMessage(message: string): Promise<void>;
  showInputBox(options?: InputBoxOptions): Promise<string | undefined>;
  createOutputChannel(name: string): OutputChannel;
  showTextDocument(
    document: TextDocument,
    options?: TextDocumentShowOptions
  ): Promise<void>;
}

export interface OutputChannel {
  appendLine(value: string): void;
  show(): void;
}

export interface Commands {
  registerCommand(
    command: string,
    callback: (...args: unknown[]) => unknown
  ): { dispose(): void };
  getCommands(filterInternal?: boolean): Promise<string[]>;
}

export interface Workspace {
  openTextDocument(options: {
    language?: string;
    content: string;
  }): Promise<TextDocument>;
  showTextDocument(
    document: TextDocument,
    options?: TextDocumentShowOptions
  ): Promise<void>;
}

export interface Clipboard {
  writeText(value: string): Promise<void>;
  readText(): Promise<string>;
}

export interface Env {
  clipboard: Clipboard;
}

export interface VSCode {
  window: Window;
  commands: Commands;
  env: Env;
  workspace: Workspace;
  ExtensionContext: typeof ExtensionContextClass;
}

// VS Code module mock
import type {
  ExtensionContext,
  LogOutputChannel,
  OutputChannel,
  Position as VSCodePosition,
  Range as VSCodeRange,
  Selection as VSCodeSelection,
  TextDocument,
  TextEditor,
  Uri as VSCodeUri,
} from 'vscode';

export class Position implements VSCodePosition {
  constructor(
    public line: number,
    public character: number
  ) {}
  isBefore() {
    return false;
  }
  isBeforeOrEqual() {
    return false;
  }
  isAfter() {
    return false;
  }
  isAfterOrEqual() {
    return false;
  }
  isEqual() {
    return false;
  }
  compareTo() {
    return 0;
  }
  translate() {
    return this;
  }
  with() {
    return this;
  }
}

export class Range implements VSCodeRange {
  constructor(
    public start: Position,
    public end: Position
  ) {}
  isEmpty = false;
  isSingleLine = false;
  contains() {
    return false;
  }
  isEqual() {
    return false;
  }
  intersection() {
    return undefined;
  }
  union() {
    return this;
  }
  with() {
    return this;
  }
}

export class Selection extends Range implements VSCodeSelection {
  constructor(
    public anchor: Position,
    public active: Position
  ) {
    super(anchor, active);
  }
  isReversed = false;
}

export class Uri implements VSCodeUri {
  constructor(
    public scheme: string,
    public authority: string,
    public path: string,
    public query: string,
    public fragment: string,
    public fsPath: string
  ) {}

  with() {
    return this;
  }
  toString() {
    return this.fsPath;
  }
  toJSON() {
    return {
      scheme: this.scheme,
      authority: this.authority,
      path: this.path,
      query: this.query,
      fragment: this.fragment,
      fsPath: this.fsPath,
      external:
        this.scheme === 'file' ? `file://${this.fsPath}` : this.toString(),
    };
  }

  static file(path: string): Uri {
    return new Uri('file', '', path, '', '', path);
  }

  static parse(url: string): Uri {
    return new Uri('file', '', url, '', '', url);
  }
}

class MockTextDocument implements TextDocument {
  constructor(
    public uri: Uri,
    public fileName: string,
    public isUntitled: boolean,
    public languageId: string,
    public version: number,
    public isDirty: boolean,
    public isClosed: boolean
  ) {}

  eol = 1;
  lineCount = 0;
  save() {
    return Promise.resolve(true);
  }
  getText() {
    return '';
  }
  getWordRangeAtPosition() {
    return undefined;
  }
  lineAt() {
    return {
      lineNumber: 0,
      text: '',
      range: new Range(new Position(0, 0), new Position(0, 0)),
      rangeIncludingLineBreak: new Range(
        new Position(0, 0),
        new Position(0, 0)
      ),
      firstNonWhitespaceCharacterIndex: 0,
      isEmptyOrWhitespace: true,
    };
  }
  offsetAt() {
    return 0;
  }
  positionAt() {
    return new Position(0, 0);
  }
  validateRange(range: Range) {
    return range;
  }
  validatePosition(position: Position) {
    return position;
  }
}

class MockTextEditor implements TextEditor {
  constructor(
    public document: TextDocument,
    public selection: Selection,
    public selections: readonly Selection[],
    public visibleRanges: readonly Range[],
    public options: { tabSize: number; insertSpaces: boolean },
    public viewColumn?: number
  ) {}

  edit() {
    return Promise.resolve(true);
  }
  insertSnippet() {
    return Promise.resolve(true);
  }
  setDecorations() {}
  revealRange() {}
  show() {}
  hide() {}
}

class MockOutputChannel implements OutputChannel, LogOutputChannel {
  constructor(public name: string) {}
  append() {}
  appendLine() {}
  clear() {}
  show() {}
  hide() {}
  dispose() {}
  replace() {}
  logLevel = undefined;
  onDidChangeLogLevel = () => ({ dispose: () => {} });
  trace() {}
  debug() {}
  info() {}
  warn() {}
  error() {}
}

export const window = {
  showInformationMessage: () => Promise.resolve<string | undefined>(undefined),
  showErrorMessage: () => Promise.resolve<string | undefined>(undefined),
  showInputBox: () => Promise.resolve('test input'),
  createOutputChannel: (name: string) => new MockOutputChannel(name),
  showTextDocument: (document: TextDocument) =>
    Promise.resolve(
      new MockTextEditor(
        document,
        new Selection(new Position(0, 0), new Position(0, 0)),
        [],
        [],
        { tabSize: 2, insertSpaces: true },
        1
      )
    ),
};

export const commands = {
  registerCommand: (
    command: string,
    callback: (...args: unknown[]) => unknown
  ) => ({ dispose: () => {} }),
  registerTextEditorCommand: () => ({ dispose: () => {} }),
  executeCommand: <T>() => Promise.resolve<T>(undefined as T),
  getCommands: () =>
    Promise.resolve([
      'bitcoin.generateHDPublicKey',
      'bitcoin.generateHDPrivateKey',
      'bitcoin.xPubFromxPriv',
      'bitcoin.addressFromHDPublicKey',
      'bitcoin.generatePublicKey',
      'bitcoin.generatePrivateKey',
      'bitcoin.generateWIF',
      'bitcoin.generateMnemonic',
      'bitcoin.extendedPrivateKeyFromMnemonic',
      'bitcoin.decodeRawTx',
      'bitcoin.asmFromScript',
      'bitcoin.addressFromPublicKey',
      'bitcoin.getTx',
      'bitcoin.getUtxosForAddress',
      'bitcoin.addressFromPrivateKey',
      'bitcoin.addressFromWIF',
      'bitcoin.rawTxToTxo',
      'bitcoin.rawTxToBob',
      'bitcoin.publicKeyFromPrivateKey',
    ]),
};

export const workspace = {
  workspaceFolders: [],
  name: undefined,
  workspaceFile: undefined,
  rootPath: undefined,
  textDocuments: [],
  openTextDocument: () =>
    Promise.resolve(
      new MockTextDocument(
        Uri.file('test.ts'),
        'test.ts',
        false,
        'typescript',
        1,
        false,
        false
      )
    ),
  getWorkspaceFolder: () => undefined,
  asRelativePath: (path: string) => path,
  createFileSystemWatcher: () => ({
    onDidChange: () => ({ dispose: () => {} }),
    onDidCreate: () => ({ dispose: () => {} }),
    onDidDelete: () => ({ dispose: () => {} }),
    dispose: () => {},
  }),
};

export const env = {
  appName: 'VS Code',
  appRoot: '',
  language: 'en',
  sessionId: 'test',
  shell: '',
  uriScheme: 'vscode',
  clipboard: {
    writeText: () => Promise.resolve(),
    readText: () => Promise.resolve(''),
  },
  openExternal: () => Promise.resolve(true),
  asExternalUri: (uri: Uri) => Promise.resolve(uri),
  remoteName: undefined,
  uiKind: 1,
  isNewAppInstall: false,
  isTelemetryEnabled: false,
  machineId: 'test',
  createTelemetryLogger: () => ({
    logUsage: () => {},
    logError: () => {},
    dispose: () => {},
    onDidChangeEnableStates: () => ({ dispose: () => {} }),
    isUsageEnabled: true,
    isErrorsEnabled: true,
  }),
};

export const version = '1.0.0';

// Export everything as the vscode module
const vscodeModule = {
  Position,
  Range,
  Selection,
  Uri,
  window,
  commands,
  workspace,
  env,
  version,
};

export default vscodeModule;
