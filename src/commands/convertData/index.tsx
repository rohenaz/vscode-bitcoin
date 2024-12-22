import * as vscode from 'vscode';
import { Utils } from '@bsv/sdk';
import { createElement as h } from 'typed-html';
import { convertData } from '../../utils';

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
 * Shared CSS for both panel and sidebar view.
 */
const styles = `
  body {
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    background-color: var(--vscode-editor-background);
    margin: 0;
    padding: 16px;
  }
  .container {
    max-width: 800px;
    margin: 0 auto;
  }
  .panel {
    background-color: var(--vscode-panel-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 6px;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }
  .form-group {
    margin-bottom: 20px;
  }
  label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
    color: var(--vscode-foreground);
  }
  select, textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 12px;
    margin-bottom: 8px;
    font-family: var(--vscode-editor-font-family);
    font-size: var(--vscode-editor-font-size);
    background-color: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 4px;
  }
  textarea {
    min-height: 120px;
    resize: vertical;
    line-height: 1.4;
  }
  select {
    height: 36px;
  }
  select:focus, textarea:focus {
    outline: none;
    border-color: var(--vscode-focusBorder);
  }
  .format-selectors {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
  }
  .format-selectors select {
    flex: 1;
  }
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 100px;
    height: 32px;
    padding: 0 16px;
    font-size: 13px;
    font-weight: 500;
    color: var(--vscode-button-foreground);
    background-color: var(--vscode-button-background);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  button:hover {
    background-color: var(--vscode-button-hoverBackground);
  }
  button:active {
    transform: translateY(1px);
  }
  .button-row {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }
  .status-message {
    margin-top: 12px;
    padding: 8px;
    text-align: center;
    font-size: 13px;
    color: var(--vscode-notificationsInfoIcon-foreground);
    background-color: var(--vscode-notifications-background);
    border-radius: 4px;
    opacity: 0;
    transition: opacity 0.3s;
  }
  .status-message.visible {
    opacity: 1;
  }
  .output-section {
    margin-top: 20px;
  }
  .output-container {
    position: relative;
  }
  #output {
    padding-right: 100px;
  }
  .copy-button {
    position: absolute;
    right: 8px;
    top: 8px;
    min-width: auto;
    height: 28px;
    padding: 0 12px;
    font-size: 12px;
    background-color: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
  }
  .copy-button:hover {
    background-color: var(--vscode-button-secondaryHoverBackground);
  }
`;

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
  const panel = vscode.window.createWebviewPanel(
    'conversionTool',
    'Data Conversion Tool',
    vscode.ViewColumn.One,
    { enableScripts: true }, // to allow script messaging
  );

  const detected = initialInput ? detectFormat(initialInput) : undefined;
  panel.webview.html = getConversionWebviewContent(initialInput, detected);

  // The same message handling as the side panel
  panel.webview.onDidReceiveMessage(async (message) => {
    try {
      if (message.type === 'copy') {
        vscode.window.showInformationMessage('Output copied to clipboard');
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
      vscode.window.showErrorMessage(`Conversion failed: ${errorMessage}`);
    }
  });
}

/**
 * Helper to generate typed-html for the data conversion UI.
 * @param initialInput The text to populate in the textarea.
 * @param detectedFormat Pre-detected data format for initial text.
 */
function getConversionWebviewContent(initialInput?: string, detectedFormat?: DataFormat): string {
  const safeInput = initialInput ?? '';
  const script = `<script type="application/javascript">
    (function() {
      const vscode = acquireVsCodeApi();
      let initialized = false;

      // Wait for DOM to be ready
      function initializeUI() {
        if (initialized) return;
        initialized = true;

        console.log("Initializing UI...");
        
        // Attempt to detect the format of user input
        function detectAndSetFormat(input) {
          if (!input) return;
          console.log("Detecting format for:", input);

          // Try binary array first (most specific)
          if (/^\\[(\d+,)*\d+\\]$/.test(input)) {
            document.getElementById('fromFormat').value = 'binary';
            return;
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
            document.getElementById('fromFormat').value = 'utf8';
            return;
          }

          // For hex and base64, just validate the format
          if (input.length % 2 === 0 && /^[0-9A-Fa-f]+$/.test(input)) {
            document.getElementById('fromFormat').value = 'hex';
            return;
          }

          if (/^[A-Za-z0-9+/]*={0,2}$/.test(input)) {
            document.getElementById('fromFormat').value = 'base64';
            return;
          }
        }

        function tryConvert() {
          console.log("Trying conversion...");
          const fromFormat = document.getElementById('fromFormat').value;
          const toFormat = document.getElementById('toFormat').value;
          const inputVal = document.getElementById('input').value;
          console.log("Converting:", { fromFormat, toFormat, inputVal });
          if (fromFormat && toFormat && inputVal) {
            vscode.postMessage({ 
              type: 'convert',
              fromFormat, 
              toFormat, 
              input: inputVal 
            });
          }
        }

        // Show status for user feedback
        function showStatusMessage(msg) {
          const statusEl = document.getElementById('statusMessage');
          if (statusEl) {
            statusEl.textContent = msg;
            statusEl.classList.add('visible');
            setTimeout(() => {
              statusEl.classList.remove('visible');
            }, 2500);
          }
        }

        // Handle input changes
        const inputEl = document.getElementById('input');
        if (inputEl) {
          inputEl.addEventListener('input', () => {
            console.log("Input changed");
            detectAndSetFormat(inputEl.value);
            tryConvert();
          });

          inputEl.addEventListener('paste', (e) => {
            console.log("Paste event detected");
            const pastedText = e.clipboardData?.getData('text') || '';
            detectAndSetFormat(pastedText);
          });
        }

        // Handle format selector changes
        const fromFormatEl = document.getElementById('fromFormat');
        const toFormatEl = document.getElementById('toFormat');
        if (fromFormatEl) {
          fromFormatEl.addEventListener('change', tryConvert);
        }
        if (toFormatEl) {
          toFormatEl.addEventListener('change', tryConvert);
        }

        // Convert button (now just a backup)
        const convertBtn = document.getElementById('convertButton');
        if (convertBtn) {
          convertBtn.addEventListener('click', tryConvert);
        }

        // Copy button
        const copyBtn = document.getElementById('copyButton');
        if (copyBtn) {
          copyBtn.addEventListener('click', () => {
            console.log("Copy button clicked");
            const outEl = document.getElementById('output');
            if (outEl) {
              outEl.select();
              document.execCommand('copy');
              vscode.postMessage({ type: 'copy' });
              showStatusMessage('Copied to clipboard');
            }
          });
        }

        // Listen for extension -> webview messages
        window.addEventListener('message', (event) => {
          const message = event.data;
          console.log("Received message:", message);
          
          switch (message.type) {
            case 'initialize':
              console.log("Initializing with input:", message.input);
              if (message.input) {
                const inputEl = document.getElementById('input');
                if (inputEl) {
                  inputEl.value = message.input;
                }
                if (message.detectedFormat) {
                  const fromFormatEl = document.getElementById('fromFormat');
                  if (fromFormatEl) {
                    fromFormatEl.value = message.detectedFormat;
                    // Select first available output format that's different from input format
                    const toFormatEl = document.getElementById('toFormat');
                    if (toFormatEl) {
                      let foundDifferentFormat = false;
                      for (const option of toFormatEl.options) {
                        if (option.value !== message.detectedFormat) {
                          toFormatEl.value = option.value;
                          foundDifferentFormat = true;
                          break;
                        }
                      }
                      // If we found a different format, auto-convert
                      if (foundDifferentFormat) {
                        tryConvert();
                      }
                    }
                  }
                } else {
                  detectAndSetFormat(message.input);
                  // Select first available output format that's different from input format
                  const fromFormat = document.getElementById('fromFormat').value;
                  const toFormatEl = document.getElementById('toFormat');
                  if (fromFormat && toFormatEl) {
                    let foundDifferentFormat = false;
                    for (const option of toFormatEl.options) {
                      if (option.value !== fromFormat) {
                        toFormatEl.value = option.value;
                        foundDifferentFormat = true;
                        break;
                      }
                    }
                    // If we found a different format, auto-convert
                    if (foundDifferentFormat) {
                      tryConvert();
                    }
                  }
                }
              }
              break;
            case 'result':
              console.log("Received result:", message.value);
              const outputEl = document.getElementById('output');
              if (outputEl) {
                outputEl.value = message.value;
                showStatusMessage('Conversion succeeded');
              }
              break;
          }
        });

        // Process initial input if present
        const initialInput = document.getElementById('input')?.value;
        if (initialInput) {
          console.log("Found initial input:", initialInput);
          // If we have a detected format, use it
          const fromFormatEl = document.getElementById('fromFormat');
          if (!fromFormatEl?.value) {
            detectAndSetFormat(initialInput);
          }
          // Select first available output format that's different from input format
          const fromFormat = fromFormatEl?.value;
          const toFormatEl = document.getElementById('toFormat');
          if (fromFormat && toFormatEl) {
            let foundDifferentFormat = false;
            for (const option of toFormatEl.options) {
              if (option.value !== fromFormat) {
                toFormatEl.value = option.value;
                foundDifferentFormat = true;
                break;
              }
            }
            // If we found a different format, auto-convert
            if (foundDifferentFormat) {
              tryConvert();
            }
          }
        }
      }

      // Initialize once DOM is ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeUI);
      } else {
        initializeUI();
      }
    })();
  </script>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>${styles}</style>
</head>
<body>
  <div class="container">
    <div class="panel">
      <div class="form-group">
        <label for="input">Input Data</label>
        <textarea id="input" placeholder="Paste or type data to convert">${safeInput}</textarea>
      </div>
      
      <div class="format-selectors">
        <select id="fromFormat">
          <option value="binary">Binary Array</option>
          <option value="hex">Hex</option>
          <option value="base64">Base64</option>
          <option value="utf8">UTF-8</option>
        </select>
        <select id="toFormat">
          <option value="binary">Binary Array</option>
          <option value="hex">Hex</option>
          <option value="base64">Base64</option>
          <option value="utf8">UTF-8</option>
        </select>
      </div>

      <button id="convertButton">Convert</button>

      <div class="output-section">
        <label for="output">Output</label>
        <div class="output-container">
          <textarea id="output" placeholder="Converted output will appear here" readonly></textarea>
          <button id="copyButton" class="copy-button">Copy</button>
        </div>
      </div>

      <div id="statusMessage" class="status-message"></div>
    </div>
  </div>
  ${script}
</body>
</html>`;
}
