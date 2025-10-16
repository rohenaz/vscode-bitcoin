export function getAddKeyHtml(opts: {
  nonce: string;
  cspSource: string;
  script: string;
}): string {
  const { nonce, cspSource, script } = opts;

  const page = (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta
          http-equiv="Content-Security-Policy"
          content={`
            default-src 'none';
            style-src ${cspSource} 'unsafe-inline';
            script-src 'nonce-${nonce}';
            frame-src 'none';
            sandbox allow-scripts;
          `}
        />
        <title>Add Key</title>
        <style>
          {`
            body {
              padding: 10px;
              font-family: var(--vscode-font-family);
              font-size: var(--vscode-font-size);
              color: var(--vscode-foreground);
            }
            .form-group {
              margin-bottom: 15px;
            }
            label {
              display: block;
              margin-bottom: 5px;
              color: var(--vscode-input-foreground);
            }
            select, input {
              width: 100%;
              padding: 5px;
              background: var(--vscode-input-background);
              color: var(--vscode-input-foreground);
              border: 1px solid var(--vscode-input-border);
              margin-bottom: 5px;
            }
            select:focus, input:focus {
              outline: 1px solid var(--vscode-focusBorder);
              border-color: var(--vscode-focusBorder);
            }
            button {
              background: var(--vscode-button-background);
              color: var(--vscode-button-foreground);
              border: none;
              padding: 5px 10px;
              cursor: pointer;
              margin-right: 5px;
            }
            button:hover {
              background: var(--vscode-button-hoverBackground);
            }
            button.secondary {
              background: var(--vscode-button-secondaryBackground);
              color: var(--vscode-button-secondaryForeground);
            }
            button.secondary:hover {
              background: var(--vscode-button-secondaryHoverBackground);
            }
            .button-group {
              display: flex;
              justify-content: space-between;
              margin-top: 20px;
            }
          `}
        </style>
      </head>
      <body>
        <div class="form-group">
          <label for="keyType">Key Type</label>
          <select id="keyType">
            <option value="wif">Private Key (WIF)</option>
            <option value="hdprivate">HD Private (xprv)</option>
            <option value="mnemonic">Mnemonic (BIP39 phrase)</option>
          </select>
        </div>

        <div class="form-group">
          <label for="keyLabel">Label</label>
          <input type="text" id="keyLabel" placeholder="Optional label" />
        </div>

        <div class="form-group">
          <label for="keyValue">Key Value</label>
          <input type="password" id="keyValue" />
        </div>

        <div class="button-group">
          <button class="secondary" data-cmd="generateRandom" type="button">
            Generate
          </button>
          <button class="primary" data-cmd="submitAddKey" type="button">
            Add Key
          </button>
        </div>

        <script nonce={nonce}>{script}</script>
      </body>
    </html>
  );

  return `<!DOCTYPE html>\n${String(page)}`;
} 