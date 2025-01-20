import type * as vscode from 'vscode';
import { convertData, detectFormat } from '../../utils';
import vsApi from '../../vsShim';
import { webviewScript } from './script';
import { styles } from './styles';
import { join } from 'node:path';

type DataFormat = 'binary' | 'hex' | 'base64' | 'utf8';

export type ConversionMessage =
  | { type: 'convert'; input: string; fromFormat: DataFormat; toFormat: DataFormat }
  | { type: 'result'; value: string }
  | { type: 'copy' }
  | {
    type: 'initialize';
    input?: string;
    detectedFormat?: DataFormat;
    fromFormat?: DataFormat;
    toFormat?: DataFormat;
    value?: string;
  };

/**
 * Provides the "Data Conversion" view in the sidebar (activity bar).
 * The user can type/paste input, select formats, run conversions, etc.
 */
export class ConversionViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'bitcoin.conversionView';
  private _view?: vscode.WebviewView;
  private _pendingInput?: string;
  private _pendingFormat?: DataFormat;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public initializeWithInput(input?: string, fromFormat?: DataFormat, toFormat?: DataFormat) {
    if (!this._view) {
      // Store as pending if view isn't created yet
      this._pendingInput = input;
      this._pendingFormat = fromFormat;
      return;
    }

    // If we have both formats, trigger initial conversion
    if (input && fromFormat && toFormat) {
      try {
        const result = convertData(input, fromFormat, toFormat);
        this._view.webview.postMessage({
          type: 'initialize',
          input,
          fromFormat,
          toFormat,
          value: result
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        vsApi.window.showErrorMessage(`Conversion failed: ${errorMessage}`);
      }
    } else {
      // Just initialize with input and detected format
      this._view.webview.postMessage({
        type: 'initialize',
        input,
        fromFormat,
        toFormat,
        detectedFormat: fromFormat
      });
    }
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
      enableCommandUris: false,
    };

    // Set CSP
    const cspSource = webviewView.webview.cspSource;
    const nonce = getNonce();

    webviewView.webview.html = getConversionWebviewContent(
      this._pendingInput,
      this._pendingFormat,
      nonce,
      cspSource
    );

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (message: ConversionMessage) => {
      try {
        if (message.type === 'copy') {
          vsApi.window.showInformationMessage('Output copied to clipboard');
          return;
        }
        if (message.type === 'convert' && message.input && message.fromFormat && message.toFormat) {
          const result = convertData(message.input, message.fromFormat, message.toFormat);
          webviewView.webview.postMessage({ type: 'result', value: result });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        vsApi.window.showErrorMessage(`Conversion failed: ${errorMessage}`);
      }
    });

    // Initialize with any pending input after creation
    if (this._pendingInput) {
      this._view.webview.postMessage({
        type: 'initialize',
        input: this._pendingInput,
        detectedFormat: this._pendingFormat
      });
      // Clear pending input once used
      this._pendingInput = undefined;
      this._pendingFormat = undefined;
    }
  }
}

/**
 * Fallback function to open the same conversion UI in a dedicated panel,
 * e.g. if the user does not want or cannot use the sidebar webview.
 */
export async function openConversionTool(
  initialInput?: string,
  fromFormat?: DataFormat,
  toFormat?: DataFormat,
) {
  const panel = vsApi.window.createWebviewPanel(
    'conversionTool',
    'Data Conversion Tool',
    vsApi.ViewColumn.One,
    { 
      enableScripts: true,
      enableCommandUris: false,
      localResourceRoots: [vsApi.Uri.file(join(__dirname, 'webview'))]
    },
  );

  const detected =
    fromFormat || (initialInput ? detectFormat(initialInput) : undefined);
  const nonce = getNonce();
  const cspSource = panel.webview.cspSource;
  panel.webview.html = getConversionWebviewContent(initialInput, detected, nonce, cspSource);

  // The same message handling as the side panel
  panel.webview.onDidReceiveMessage(async (message: ConversionMessage) => {
    try {
      if (message.type === 'copy') {
        vsApi.window.showInformationMessage('Output copied to clipboard');
        return;
      }
      if (
        message.type === 'convert' &&
        message.input &&
        message.fromFormat &&
        message.toFormat
      ) {
        const result = convertData(
          message.input,
          message.fromFormat,
          message.toFormat,
        );
        panel.webview.postMessage({ type: 'result', value: result });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      vsApi.window.showErrorMessage(`Conversion failed: ${errorMessage}`);
    }
  });

  // If we have both formats, trigger initial conversion
  if (initialInput && fromFormat && toFormat) {
    try {
      const result = convertData(initialInput, fromFormat, toFormat);
      panel.webview.postMessage({
        type: 'initialize',
        input: initialInput,
        detectedFormat: fromFormat,
        value: result,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      vsApi.window.showErrorMessage(`Conversion failed: ${errorMessage}`);
    }
  } else {
    // Just initialize with input and detected format
    panel.webview.postMessage({
      type: 'initialize',
      input: initialInput,
      detectedFormat: detected,
    });
  }
}

/**
 * Status message component for displaying operation feedback
 */
function StatusMessage() {
  return <div id="statusMessage" class="status-message" />;
}

/**
 * Input section component with textarea for data input
 */
function InputSection({ initialValue }: { initialValue: string }) {
  return (
    <div class="form-group">
      <label for="input">Input Data</label>
      <textarea id="input" placeholder="Paste or type data to convert">
        {initialValue}
      </textarea>
    </div>
  );
}

/**
 * Format selector component with from/to dropdowns and convert button
 */
function FormatSelectors() {
  return (
    <div class="format-selectors">
      <div class="format-group">
        <select id="fromFormat">
          <option value="binary">Binary</option>
          <option value="hex">Hex</option>
          <option value="base64">Base64</option>
          <option value="utf8">UTF-8</option>
        </select>
        <span class="arrow-icon">
          <i class="codicon codicon-chevron-right" aria-label="Convert to" />
        </span>
        <select id="toFormat">
          <option value="binary">Binary</option>
          <option value="hex">Hex</option>
          <option value="base64">Base64</option>
          <option value="utf8">UTF-8</option>
        </select>
      </div>
      <button
        id="convertButton"
        class="convert-button"
        type="button"
        title="Convert"
      >
        Convert
      </button>
    </div>
  );
}

/**
 * Output section component with result textarea and copy button
 */
function OutputSection() {
  return (
    <div class="output-section">
      <label for="output">Output</label>
      <div class="output-container">
        <textarea
          id="output"
          placeholder="Converted output will appear here"
          readonly={true}
        />
        <button id="copyButton" class="copy-button" type="button" title="Copy">
          <i class="codicon codicon-copy" aria-label="Copy" />
        </button>
      </div>
    </div>
  );
}

/**
 * Main panel component containing all UI elements
 */
function ConversionPanel({ initialValue }: { initialValue: string }) {
  return (
    <div class="panel">
      <InputSection initialValue={initialValue} />
      <FormatSelectors />
      <OutputSection />
      <StatusMessage />
    </div>
  );
}

/**
 * Helper to generate @kitajs/html for the data conversion UI.
 */
function getConversionWebviewContent(
  initialInput?: string,
  detectedFormat?: DataFormat,
  nonce?: string,
  cspSource?: string,
): string {
  const safeInput = initialInput ?? '';
  
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Data Conversion</title>
    <style>
      ${styles}
    </style>
  </head>
  <body>
    <div class="container">
      <div class="panel">
        ${InputSection({ initialValue: safeInput })}
        ${FormatSelectors()}
        ${OutputSection()}
        ${StatusMessage()}
      </div>
    </div>
    <script nonce="${nonce}">
      ${webviewScript}
    </script>
  </body>
  </html>`;
}

// Add nonce generator function
function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
