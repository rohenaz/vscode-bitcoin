import { createElement as h } from 'typed-html';
import vsApi from '../../vsShim';
import { DataFormat, convertData, detectFormat } from '../../utils';

const styles = `
  body {
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    background-color: var(--vscode-editor-background);
    margin: 0;
    padding: 0;
  }
  .container {
    max-width: 800px;
    margin: 0 auto;
    padding: 24px;
  }
  h2 {
    margin: 0 0 16px;
    font-size: 1.6em;
  }
  .panel {
    background-color: var(--vscode-panel-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 6px;
    padding: 16px;
    box-shadow: 0 3px 6px rgba(0,0,0,0.15);
  }
  .form-group {
    margin-bottom: 18px;
  }
  label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
  }
  select, textarea, button {
    width: 100%;
    box-sizing: border-box;
    padding: 8px;
    margin-bottom: 4px;
    font-family: var(--vscode-font-family);
  }
  textarea {
    min-height: 120px;
    resize: vertical;
  }
  select {
    background-color: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
  }
  button {
    background-color: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border-radius: 4px;
    border: none;
    cursor: pointer;
    font-weight: 600;
    transition: background-color 0.2s;
    margin-top: 4px;
  }
  button:hover {
    background-color: var(--vscode-button-hoverBackground);
  }
  .divider {
    border-bottom: 1px solid var(--vscode-panel-border);
    margin: 24px 0;
  }
  .buttons-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
  }
  .status-message {
    flex: 1;
    color: var(--vscode-descriptionForeground);
    font-size: 0.9em;
    height: 18px;
    margin-top: 4px;
  }
  .output-container {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }
  .copy-button {
    flex-shrink: 0;
    width: auto;
    padding: 6px 12px;
  }
  #output {
    flex: 1;
    background-color: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border);
    color: var(--vscode-input-foreground);
    margin: 0;
    resize: vertical;
  }
`;

export async function openConversionTool(initialInput?: string) {
  const panel = vsApi.window.createWebviewPanel(
    'conversionTool',
    'Data Conversion Tool',
    vsApi.ViewColumn.One,
    { enableScripts: true },
  );

  const detectedFormat = initialInput ? detectFormat(initialInput) : undefined;
  panel.webview.html = getConversionWebviewContent(
    initialInput,
    detectedFormat,
  );

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
 * Builds the webview content using typed-html (with JSX).
 * Note: The lang="en" attribute satisfies a11y lint requirements.
 */
function getConversionWebviewContent(
  initialInput: string | undefined,
  detectedFormat: DataFormat | undefined,
): string {
  const safeDetectedFormat = detectedFormat ?? '';
  const safeInput = initialInput ?? '';

  const script = `<script type="application/javascript">
    const vscode = acquireVsCodeApi();

          function showStatusMessage(message) {
            const statusMessage = document.getElementById('statusMessage');
            statusMessage.textContent = message;
            setTimeout(() => {
              statusMessage.textContent = '';
            }, 3000);
          }

          document.getElementById('convertButton').addEventListener('click', () => {
            const fromFormat = document.getElementById('fromFormat').value;
            const toFormat = document.getElementById('toFormat').value;
            const input = document.getElementById('input').value;
            vscode.postMessage({ fromFormat, toFormat, input });
          });

          document.getElementById('copyButton').addEventListener('click', () => {
            const output = document.getElementById('output');
            output.select();
            document.execCommand('copy');
            vscode.postMessage({ type: 'copy' });
          });

          window.addEventListener('message', (event) => {
            if (event.data.type === 'result') {
              document.getElementById('output').value = event.data.value;
              showStatusMessage('Conversion succeeded');
            }
          });

          // Auto-select the detected input format, if any
          (() => {
            if ("{safeDetectedFormat}" !== "") {
              document.getElementById('fromFormat').value = "{safeDetectedFormat}";
            }
          })();
          </script>`;

  // Build HTML using typed-html's createElement for JSX
  const content = (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Data Conversion Tool</title>
        <style>{styles}</style>
      </head>
      <body>
        <div class="container">
          <h2>Data Conversion Tool</h2>
          <div class="panel">
            <div class="form-group">
              <label for="fromFormat">Input Format:</label>
              <select id="fromFormat">
                <option value="utf8">UTF-8</option>
                <option value="hex">Hex</option>
                <option value="base64">Base64</option>
                <option value="binary">Binary Array</option>
              </select>
            </div>

            <div class="form-group">
              <label for="input">Input:</label>
              <textarea id="input">{safeInput}</textarea>
            </div>

            <div class="divider" />

            <div class="form-group">
              <label for="toFormat">Output Format:</label>
              <select id="toFormat">
                <option value="hex">Hex</option>
                <option value="base64">Base64</option>
                <option value="binary">Binary Array</option>
              </select>
            </div>

            <div class="buttons-row">
              <button type="button" id="convertButton">
                Convert
              </button>
              <div class="status-message" id="statusMessage" />
            </div>

            <div class="output-container">
              <textarea id="output" readonly={'readonly'} />
              <button type="button" class="copy-button" id="copyButton">
                Copy
              </button>
            </div>
          </div>
        </div>
        ${script}
      </body>
    </html>
  );

  // typed-html returns a string from this JSX expression
  return content;
}
