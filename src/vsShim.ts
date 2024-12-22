import type {
  CancellationToken,
  Disposable,
  Event,
  EventEmitter,
  ExtensionContext,
  OutputChannel,
  Progress,
  ProgressLocation,
  SecretStorage,
  TextDocument,
  TextDocumentShowOptions,
  TextEditor,
  Uri,
  ViewColumn,
  WebviewPanel,
  WebviewView,
  WebviewViewProvider,
  Position,
  Range,
  MarkdownString,
  Hover,
  HoverProvider,
  ProviderResult,
  DocumentSemanticTokensProvider,
  SemanticTokens,
  SemanticTokensBuilder,
  SemanticTokensLegend,
} from 'vscode';

let vsApi: typeof import('vscode');

// In test environment, use our mock
if (process.env.NODE_ENV === 'test') {
  vsApi = require('./test/setup').default;
} else {
  // In production, use real VS Code API
  vsApi = require('vscode');
}

export type {
  ExtensionContext,
  WebviewPanel,
  Uri,
  Disposable,
  EventEmitter,
  SecretStorage,
  Event,
  OutputChannel,
  WebviewView,
  WebviewViewProvider,
  TextDocument,
  TextEditor,
  ViewColumn,
  TextDocumentShowOptions,
  ProgressLocation,
  Progress,
  CancellationToken,
  Position,
  Range,
  MarkdownString,
  Hover,
  HoverProvider,
  ProviderResult,
  DocumentSemanticTokensProvider,
  SemanticTokens,
  SemanticTokensBuilder,
  SemanticTokensLegend,
};

export function isUri(obj: unknown): obj is Uri {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'fsPath' in obj &&
    'scheme' in obj &&
    'path' in obj
  );
}
export default vsApi;

