import type {
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