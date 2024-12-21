import * as vscode from 'vscode';
import type { KeyEntry, KeyVault } from './keyVault';

export class KeyPanel {
  public static currentPanel: KeyPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _vault: KeyVault;
  private _disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, vault: KeyVault) {
    this._panel = panel;
    this._vault = vault;

    // Set initial content
    this.updateContent();

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message) => this.handleMessage(message),
      null,
      this._disposables,
    );

    // Update content when keys change
    this._vault.onDidChangeKeys(() => this.updateContent());
  }

  public static show(vault: KeyVault) {
    if (KeyPanel.currentPanel) {
      // If we already have a panel, show it
      KeyPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
    } else {
      // Otherwise, create a new panel
      const panel = vscode.window.createWebviewPanel(
        'bitcoinKeyVault',
        'Bitcoin Key Vault',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        },
      );

      KeyPanel.currentPanel = new KeyPanel(panel, vault);
    }
  }

  private async updateContent() {
    const keys = await this._vault.getAllKeys();
    this._panel.webview.html = this.getWebviewContent(keys);
  }

  private getWebviewContent(keys: KeyEntry[]): string {
    const escapedKeys = keys.map((key) => ({
      ...key,
      label: (key.label || 'Untitled').replace(/`/g, '\\`'),
    }));

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bitcoin Key Vault</title>
        <style>
            body {
                padding: 20px;
                color: var(--vscode-foreground);
                font-family: var(--vscode-font-family);
            }
            .search-container {
                margin-bottom: 20px;
            }
            #searchInput {
                width: 100%;
                padding: 8px;
                background: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                border-radius: 4px;
            }
            .key-entry {
                margin-bottom: 16px;
                padding: 12px;
                background: var(--vscode-editor-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 6px;
            }
            .key-header {
                display: flex;
                align-items: center;
                margin-bottom: 8px;
            }
            .key-type {
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 0.8em;
                margin-right: 8px;
            }
            .key-label {
                flex-grow: 1;
                font-weight: bold;
                cursor: pointer;
                padding: 2px 4px;
                border-radius: 3px;
            }
            .key-label:hover {
                background-color: var(--vscode-editor-selectionBackground);
            }
            .key-actions {
                display: flex;
                gap: 4px;
            }
            .key-actions button {
                background: none;
                border: none;
                color: var(--vscode-button-foreground);
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
            }
            .key-actions button:hover {
                background: var(--vscode-button-hoverBackground);
            }
            .key-details {
                font-family: var(--vscode-editor-font-family);
                font-size: 0.9em;
            }
            .key-date {
                color: var(--vscode-descriptionForeground);
                font-size: 0.8em;
                margin-bottom: 4px;
            }
            .key-value {
                word-break: break-all;
                padding: 8px;
                background: var(--vscode-textBlockQuote-background);
                border-radius: 4px;
            }
            .type-private { background: var(--vscode-errorForeground); }
            .type-public { background: var(--vscode-notificationsInfoIcon-foreground); }
            .type-wif { background: var(--vscode-errorForeground); }
            .type-hdprivate { background: var(--vscode-errorForeground); }
            .type-hdpublic { background: var(--vscode-notificationsInfoIcon-foreground); }
            .type-mnemonic { background: var(--vscode-warningForeground); }
            .type-encryption { background: var(--vscode-errorForeground); }
        </style>
    </head>
    <body>
        <div class="search-container">
            <input type="text" id="searchInput" placeholder="Search keys..." oninput="searchKeys(this.value)">
        </div>
        <div id="keyList">
            ${escapedKeys.map((key) => this.getHtmlForKey(key)).join('\n')}
        </div>
        <script>
            const vscode = acquireVsCodeApi();
            const keyData = ${JSON.stringify(escapedKeys)};

            function copyValue(id) {
                vscode.postMessage({ command: 'copyValue', id });
            }

            function deleteKey(id) {
                if (confirm('Are you sure you want to delete this key?')) {
                    vscode.postMessage({ command: 'deleteKey', id });
                }
            }

            function editLabel(id, currentLabel) {
                const newLabel = prompt('Enter new label:', currentLabel);
                if (newLabel !== null && newLabel !== currentLabel) {
                    vscode.postMessage({
                        command: 'updateLabel',
                        id,
                        label: newLabel
                    });
                }
            }

            function searchKeys(query) {
                const filteredKeys = keyData.filter(key => {
                    const searchStr = (key.label || '').toLowerCase();
                    return searchStr.includes(query.toLowerCase());
                });
                
                document.getElementById('keyList').innerHTML = 
                    filteredKeys.map(key => {
                        const date = new Date(key.timestamp).toLocaleString();
                        const label = key.label || 'Untitled';
                        return \`
                            <div class="key-entry" data-id="\${key.id}">
                                <div class="key-header">
                                    <div class="key-type type-\${key.type}">\${key.type}</div>
                                    <div class="key-label" onclick="editLabel('\${key.id}', '\${label}')">\${label}</div>
                                    <div class="key-actions">
                                        <button onclick="copyValue('\${key.id}')" title="Copy Value">📋</button>
                                        <button onclick="deleteKey('\${key.id}')" title="Delete Key">🗑️</button>
                                    </div>
                                </div>
                                <div class="key-details">
                                    <div class="key-date">\${date}</div>
                                    <div class="key-value">\${maskValue(key.value)}</div>
                                </div>
                            </div>
                        \`;
                    }).join('\\n');
            }

            function maskValue(value) {
                if (value.length <= 8) return value;
                return value.substring(0, 4) + '...' + value.substring(value.length - 4);
            }
        </script>
    </body>
    </html>`;
  }

  private getHtmlForKey(key: KeyEntry): string {
    const date = new Date(key.timestamp).toLocaleString();
    const label = key.label || 'Untitled';
    return `
      <div class="key-entry" data-id="${key.id}">
        <div class="key-header">
          <div class="key-type type-${key.type}">${key.type}</div>
          <div class="key-label" onclick="editLabel('${
            key.id
          }', '${label}')">${label}</div>
          <div class="key-actions">
            <button onclick="copyValue('${key.id}')" title="Copy Value">📋</button>
            <button onclick="deleteKey('${key.id}')" title="Delete Key">🗑️</button>
          </div>
        </div>
        <div class="key-details">
          <div class="key-date">${date}</div>
          <div class="key-value">${this.maskValue(key.value)}</div>
        </div>
      </div>
    `;
  }

  private maskValue(value: string): string {
    if (value.length <= 8) return value;
    return `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
  }

  private handleMessage(message: {
    command: 'copyValue' | 'deleteKey' | 'updateLabel';
    id: string;
    label?: string;
  }) {
    switch (message.command) {
      case 'copyValue':
        this.copyKeyValue(message.id);
        break;
      case 'deleteKey':
        this.deleteKey(message.id);
        break;
      case 'updateLabel':
        if (message.label) {
          this._vault
            .updateKeyLabel(message.id, message.label)
            .catch((error) => {
              vscode.window.showErrorMessage(
                `Failed to update label: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              );
            });
        }
        break;
    }
  }

  private async copyKeyValue(id: string) {
    try {
      const key = await this._vault.getKey(id);
      if (key) {
        await vscode.env.clipboard.writeText(key.value);
        vscode.window.showInformationMessage('Key value copied to clipboard');
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to copy key: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async deleteKey(id: string) {
    try {
      await this._vault.deleteKey(id);
      vscode.window.showInformationMessage('Key deleted');
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to delete key: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  public dispose() {
    KeyPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
