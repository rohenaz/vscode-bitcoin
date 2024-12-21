import { afterEach, describe, expect, test, mock } from 'bun:test';
import type {
  Uri,
  ViewColumn,
  WebviewOptions,
  WebviewPanel,
  WebviewPanelOptions,
} from 'vscode';
import vsApi from '../../vsShim';
import { openConversionTool } from '.';

interface Message {
  type?: 'copy';
  input?: string;
  fromFormat?: string;
  toFormat?: string;
}

// Create a mock WebviewPanel that satisfies the type requirements
function createMockWebviewPanel(
  onMessageHandler?: (handler: (message: Message) => Promise<void>) => {
    dispose: () => void;
  },
  html = '',
  postMessage = mock(async (message: unknown) => true),
): WebviewPanel {
  return {
    webview: {
      html,
      onDidReceiveMessage: onMessageHandler ?? (() => ({ dispose: () => {} })),
      postMessage,
      asWebviewUri: (uri: Uri) => uri,
      options: {},
      cspSource: '',
    },
    onDidDispose: () => ({ dispose: () => {} }),
    onDidChangeViewState: () => ({ dispose: () => {} }),
    reveal: mock(() => {}),
    dispose: mock(() => {}),
    active: true,
    visible: true,
    viewType: 'test',
    title: 'Test',
    viewColumn: -1 as ViewColumn,
    options: {} as WebviewPanelOptions & WebviewOptions,
  };
}

describe('Conversion Tool UI', () => {
  const originalWindow = vsApi.window;

  afterEach(() => {
    vsApi.window = originalWindow;
  });

  test('opens conversion tool with initial input', async () => {
    const createdPanel = createMockWebviewPanel(undefined, '');
    vsApi.window = {
      ...originalWindow,
      createWebviewPanel: mock(() => createdPanel),
    };
    await openConversionTool('test input');
    expect(createdPanel.webview.html).toContain('test input');
  });

  test('handles conversion message', async () => {
    let messageHandler: ((message: Message) => Promise<void>) | undefined;
    const postMessage = mock(async (message: unknown) => true);

    vsApi.window = {
      ...originalWindow,
      createWebviewPanel: mock(() =>
        createMockWebviewPanel(
          (handler) => {
            messageHandler = handler;
            return { dispose: () => {} };
          },
          '',
          postMessage,
        )),
    };

    await openConversionTool();
    if (messageHandler) {
      await messageHandler({
        input: 'Hello',
        fromFormat: 'utf8',
        toFormat: 'hex',
      });
    }

    expect(postMessage).toHaveBeenCalledWith({ type: 'result', value: '48656c6c6f' });
  });

  test('handles copy message', async () => {
    let messageHandler: ((message: Message) => Promise<void>) | undefined;
    const postMessage = mock(async (message: unknown) => true);
    let infoMessage: string | undefined;

    vsApi.window = {
      ...originalWindow,
      createWebviewPanel: mock(() =>
        createMockWebviewPanel(
          (handler) => {
            messageHandler = handler;
            return { dispose: () => {} };
          },
          '',
          postMessage,
        )),
      showInformationMessage: mock(async (message: string) => {
        infoMessage = message;
        return undefined;
      }),
    };

    await openConversionTool();
    if (messageHandler) {
      await messageHandler({ type: 'copy' });
    }

    expect(infoMessage).toBe('Output copied to clipboard');
  });

  test('handles conversion error', async () => {
    let messageHandler: ((message: Message) => Promise<void>) | undefined;
    const postMessage = mock(async (message: unknown) => true);
    let errorMessage: string | undefined;

    vsApi.window = {
      ...originalWindow,
      createWebviewPanel: mock(() =>
        createMockWebviewPanel(
          (handler) => {
            messageHandler = handler;
            return { dispose: () => {} };
          },
          '',
          postMessage,
        )),
      showErrorMessage: mock(async (message: string) => {
        errorMessage = message;
        return undefined;
      }),
    };

    await openConversionTool();
    if (messageHandler) {
      await messageHandler({
        input: 'invalid',
        fromFormat: 'hex',
        toFormat: 'base64',
      });
    }

    expect(errorMessage).toBe('Conversion failed: Invalid hex string');
  });
});
