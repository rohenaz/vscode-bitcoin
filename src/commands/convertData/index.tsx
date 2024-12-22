import * as vscode from 'vscode';
import { Utils } from '@bsv/sdk';
import { createElement as h } from 'typed-html';
import { convertData } from '../../utils';
import vsApi from '../../vsShim';
import { styles } from './styles';
import { webviewScript } from './script';

type DataFormat = 'binary' | 'hex' | 'base64' | 'utf8';

interface ConversionMessage {
  type: 'initialize' | 'result' | 'copy' | 'convert';
  input?: string;
  value?: string;
  detectedFormat?: DataFormat;
  fromFormat?: DataFormat;
  toFormat?: DataFormat;
}

// Helper function to detect format
function detectFormat(input: string): DataFormat | undefined {
  if (!input) return undefined;

  // Try binary array first (most specific)
  if (/^\[(\d+,)*\d+\]$/.test(input)) {
    return 'binary';
  }

  // Try clear text (must be obviously text)
  if (
    /[a-zA-Z]/.test(input) &&
    /[a-zA-Z][,!?.\s]|[,!?.\s][a-zA-Z]/.test(input) &&
    !/^[0-9A-Fa-f]+$/.test(input) &&
    !/^[A-Za-z0-9+/=]+$/.test(input) &&
    !/^[0-9-]+$/.test(input) &&
    !/^[a-zA-Z]+[0-9]+$/.test(input) &&
    !/^[0-9]+[a-zA-Z]+$/.test(input) &&
    !input.includes('[') &&
    !input.includes(']')
  ) {
    return 'utf8';
  }

  // For hex and base64, just validate the format
  if (input.length % 2 === 0 && /^[0-9A-Fa-f]+$/.test(input)) {
    return 'hex';
  }

  if (/^[A-Za-z0-9+/]*={0,2}$/.test(input)) {
    return 'base64';
  }

  return undefined;
}

/**
 * Provides the "Data Conversion" view in the sidebar (activity bar).
 * The user can type/paste input, select formats, run conversions, etc.
 */
export class ConversionViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'bitcoin.conversionView';
  private _view?: vscode.WebviewView;
  private _pendingInput?: string;
  private _pendingFormat?: DataFormat;

  constructor(
    private readonly _extensionUri: vscode.Uri,
  ) {}

  public initializeWithInput(input?: string, detectedFormat?: DataFormat) {
    console.log("Initializing with input:", input, "format:", detectedFormat);
    if (!this._view) {
      // Store as pending if view isn't created yet
      this._pendingInput = input;
      this._pendingFormat = detectedFormat || (input ? detectFormat(input) : undefined);
      return;
    }

    // Detect format if not provided
    const format = detectedFormat || (input ? detectFormat(input) : undefined);

    // Update the HTML with the new input
    this._view.webview.html = getConversionWebviewContent(input, format);
    
    // Also send a message to ensure the view updates
    this._view.webview.postMessage({
      type: 'initialize',
      input,
      detectedFormat: format
    } as ConversionMessage);
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        this._extensionUri
      ]
    };

    // Use any pending input when creating the initial HTML
    webviewView.webview.html = getConversionWebviewContent(
      this._pendingInput,
      this._pendingFormat
    );

    webviewView.webview.onDidReceiveMessage(async (data: ConversionMessage) => {
      console.log("Received message:", data);
      // Handle conversion request
      if (data.type === 'convert' && data.input && data.fromFormat && data.toFormat) {
        try {
          const result = await convertData(
            data.input,
            data.fromFormat,
            data.toFormat
          );
          webviewView.webview.postMessage({
            type: 'result',
            value: result
          } as ConversionMessage);
        } catch (err) {
          console.error('Conversion error:', err);
          vscode.window.showErrorMessage(`Conversion failed: ${err}`);
        }
      }
      // Handle copy notification
      else if (data.type === 'copy') {
        vscode.window.showInformationMessage('Copied to clipboard');
      }
    });

    // Initialize with any pending input after creation
    if (this._pendingInput) {
      this._view.webview.postMessage({
        type: 'initialize',
        input: this._pendingInput,
        detectedFormat: this._pendingFormat
      } as ConversionMessage);
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
export async function openConversionTool(initialInput?: string) {
  const panel = vsApi.window.createWebviewPanel(
    'conversionTool',
    'Data Conversion Tool',
    vsApi.ViewColumn.One,
    { enableScripts: true }, // to allow script messaging
  );

  const detected = initialInput ? detectFormat(initialInput) : undefined;
  panel.webview.html = getConversionWebviewContent(initialInput, detected);

  // The same message handling as the side panel
  panel.webview.onDidReceiveMessage(async (message) => {
    try {
      if (message.type === 'copy') {
        vsApi.window.showInformationMessage('Output copied to clipboard');
        return;
      }
      const result = convertData(
        message.input,
        message.fromFormat,
        message.toFormat,
      );
      panel.webview.postMessage({ type: 'result', value: result });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      vsApi.window.showErrorMessage(`Conversion failed: ${errorMessage}`);
    }
  });
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
      <textarea id="input" placeholder="Paste or type data to convert">{initialValue}</textarea>
    </div>
  );
}

/**
 * Format selector component with from/to dropdowns and convert button
 */
function FormatSelector() {
  return (
    <div class="format-selectors">
      <select id="fromFormat">
        <option value="binary">Binary Array</option>
        <option value="hex">Hex</option>
        <option value="base64">Base64</option>
        <option value="utf8">UTF-8</option>
      </select>
      <span class="arrow-icon">→</span>
      <select id="toFormat">
        <option value="binary">Binary Array</option>
        <option value="hex">Hex</option>
        <option value="base64">Base64</option>
        <option value="utf8">UTF-8</option>
      </select>
      <button id="convertButton" class="convert-button" type="button" title="Convert">
        <span class="codicon">$(sync)</span>
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
        <textarea id="output" placeholder="Converted output will appear here" readonly="readonly" />
        <button id="copyButton" class="copy-button" type="button" title="Copy">
          <span class="codicon">$(copy)</span>
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
      <FormatSelector />
      <OutputSection />
      <StatusMessage />
    </div>
  );
}

/**
 * Helper to generate typed-html for the data conversion UI.
 */
function getConversionWebviewContent(initialInput?: string, detectedFormat?: DataFormat): string {
  const safeInput = initialInput ?? '';

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>{styles}</style>
      </head>
      <body>
        <div class="container">
          <ConversionPanel initialValue={safeInput} />
        </div>
        <script>{webviewScript}</script>
      </body>
    </html>
  );
}

