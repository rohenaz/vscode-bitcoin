import type { BapIdentity } from './bapService';
import vsApi, { type WebviewPanel, type Disposable } from './vsShim';

export interface EditProfileData {
  idKey: string;
  identity: Partial<BapIdentity>;
  displayName?: string;
}

export class EditProfilePanel {
  public static currentPanel: EditProfilePanel | undefined;
  private readonly _panel: WebviewPanel;
  private _disposables: Disposable[] = [];
  private readonly _extensionUri: any;
  private readonly _onSave: (idKey: string, identity: any) => Promise<void>;

  private constructor(
    panel: WebviewPanel,
    extensionUri: any,
    onSave: (idKey: string, identity: any) => Promise<void>
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._onSave = onSave;

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case 'saveProfile':
            // Call the save handler
            await this._onSave(message.idKey, message.identity);
            this.dispose();
            break;
          case 'cancel':
            this.dispose();
            break;
        }
      },
      null,
      this._disposables
    );
  }

  public static show(
    data: EditProfileData,
    extensionUri: any,
    onSave: (idKey: string, identity: any) => Promise<void>
  ) {
    const panel = vsApi.window.createWebviewPanel(
      'editBapProfile',
      `Edit Profile: ${data.displayName || 'BAP Identity'}`,
      vsApi.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    const editPanel = new EditProfilePanel(panel, extensionUri, onSave);
    editPanel.update(data);
    return editPanel;
  }

  private update(data: EditProfileData) {
    this._panel.webview.html = this.getWebviewContent(data);
  }

  private getWebviewContent(data: EditProfileData): string {
    const identity = data.identity;

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
        <title>Edit Profile</title>
        <style>
            *, *::before, *::after {
              box-sizing: border-box;
            }
            html, body {
              margin: 0;
              padding: 0;
            }
            body {
                color: var(--vscode-foreground);
                font-family: var(--vscode-font-family);
                font-size: 13px;
                line-height: 1.5;
                padding: 20px;
            }
            .container {
                max-width: 800px;
                margin: 0 auto;
            }
            .header {
                margin-bottom: 24px;
                padding-bottom: 16px;
                border-bottom: 1px solid var(--vscode-widget-border);
            }
            .title {
                font-size: 20px;
                font-weight: 600;
                margin-bottom: 4px;
            }
            .subtitle {
                font-size: 11px;
                color: var(--vscode-descriptionForeground);
                font-family: var(--vscode-editor-font-family);
            }
            .form-group {
                margin-bottom: 16px;
            }
            label {
                display: block;
                font-weight: 600;
                margin-bottom: 6px;
                font-size: 12px;
            }
            input, textarea {
                width: 100%;
                padding: 8px;
                background: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                border-radius: 2px;
                font-family: var(--vscode-font-family);
                font-size: 13px;
            }
            input:focus, textarea:focus {
                outline: 1px solid var(--vscode-focusBorder);
            }
            textarea {
                resize: vertical;
                min-height: 80px;
                font-family: var(--vscode-editor-font-family);
            }
            .help-text {
                font-size: 11px;
                color: var(--vscode-descriptionForeground);
                margin-top: 4px;
            }
            .actions {
                display: flex;
                gap: 8px;
                margin-top: 24px;
                padding-top: 16px;
                border-top: 1px solid var(--vscode-widget-border);
            }
            button {
                padding: 6px 14px;
                font-size: 12px;
                border: none;
                border-radius: 2px;
                cursor: pointer;
                font-family: var(--vscode-font-family);
            }
            .btn-primary {
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
            }
            .btn-primary:hover {
                background: var(--vscode-button-hoverBackground);
            }
            .btn-secondary {
                background: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
            }
            .btn-secondary:hover {
                background: var(--vscode-button-secondaryHoverBackground);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="title">Edit Profile</div>
                <div class="subtitle">${data.idKey}</div>
            </div>

            <form id="profileForm">
                <div class="form-group">
                    <label for="alternateName">Display Name</label>
                    <input
                        type="text"
                        id="alternateName"
                        value="${identity.alternateName || ''}"
                        placeholder="Your name or handle"
                    />
                </div>

                <div class="form-group">
                    <label for="description">Description</label>
                    <textarea
                        id="description"
                        placeholder="Tell people about yourself..."
                    >${identity.description || ''}</textarea>
                </div>

                <div class="form-group">
                    <label for="paymail">Paymail</label>
                    <input
                        type="email"
                        id="paymail"
                        value="${identity.paymail || ''}"
                        placeholder="name@example.com"
                    />
                </div>

                <div class="form-group">
                    <label for="url">Website</label>
                    <input
                        type="url"
                        id="url"
                        value="${identity.url || ''}"
                        placeholder="https://example.com"
                    />
                </div>

                <div class="form-group">
                    <label for="image">Profile Image URL</label>
                    <input
                        type="text"
                        id="image"
                        value="${identity.image || ''}"
                        placeholder="txid_vout or https://ordfs.network/..."
                    />
                    <div class="help-text">Enter a Bitcoin file txid_vout or full URL</div>
                </div>

                <div class="form-group">
                    <label for="banner">Banner Image URL</label>
                    <input
                        type="text"
                        id="banner"
                        value="${identity.banner || ''}"
                        placeholder="txid_vout or https://ordfs.network/..."
                    />
                    <div class="help-text">Enter a Bitcoin file txid_vout or full URL</div>
                </div>

                <div class="actions">
                    <button type="submit" class="btn-primary">Save Draft</button>
                    <button type="button" class="btn-secondary" onclick="handleCancel()">Cancel</button>
                </div>
            </form>
        </div>

        <script>
            const vscode = acquireVsCodeApi();
            const idKey = '${data.idKey}';

            document.getElementById('profileForm').addEventListener('submit', (e) => {
                e.preventDefault();

                const formData = {
                    alternateName: document.getElementById('alternateName').value.trim(),
                    description: document.getElementById('description').value.trim(),
                    paymail: document.getElementById('paymail').value.trim(),
                    url: document.getElementById('url').value.trim(),
                    image: document.getElementById('image').value.trim(),
                    banner: document.getElementById('banner').value.trim(),
                };

                // Remove empty fields
                const cleanedData = Object.fromEntries(
                    Object.entries(formData).filter(([_, v]) => v !== '')
                );

                vscode.postMessage({
                    type: 'saveProfile',
                    idKey: idKey,
                    identity: cleanedData
                });
            });

            function handleCancel() {
                vscode.postMessage({ type: 'cancel' });
            }
        </script>
    </body>
    </html>`;
  }

  public dispose() {
    EditProfilePanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
