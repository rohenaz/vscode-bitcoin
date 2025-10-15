import type { BapProfile } from './bapService';
import vsApi, { type WebviewPanel, type Disposable } from './vsShim';

/**
 * Normalize image URLs to ordfs.network format
 */
function normalizeImageUrl(url: string | undefined): string | null {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return null;
  }

  const trimmedUrl = url.trim();

  // Data URI - return as-is
  if (trimmedUrl.startsWith('data:')) {
    return trimmedUrl;
  }

  // Full HTTPS URL - return as-is
  if (trimmedUrl.startsWith('https://') || trimmedUrl.startsWith('http://')) {
    return trimmedUrl;
  }

  // b:// protocol
  if (trimmedUrl.startsWith('b://')) {
    const path = trimmedUrl.slice(4);
    return path ? `https://ordfs.network/${path}` : null;
  }

  // ord:// protocol
  if (trimmedUrl.startsWith('ord://')) {
    const path = trimmedUrl.slice(6);
    return path ? `https://ordfs.network/${path}` : null;
  }

  // Relative path starting with /
  if (trimmedUrl.startsWith('/')) {
    const path = trimmedUrl.slice(1);
    return path ? `https://ordfs.network/${path}` : null;
  }

  // Just a txid or txid_vout
  if (trimmedUrl.match(/^[a-f0-9]{64}(_\d+)?$/i)) {
    return `https://ordfs.network/${trimmedUrl}`;
  }

  // Fallback - prepend ordfs
  return `https://ordfs.network/${trimmedUrl}`;
}

export class BapPanel {
  public static currentPanel: BapPanel | undefined;
  private readonly _panel: WebviewPanel;
  private _disposables: Disposable[] = [];

  private constructor(panel: WebviewPanel) {
    this._panel = panel;

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public static show(profile: BapProfile) {
    const panel = vsApi.window.createWebviewPanel(
      'bapProfile',
      `BAP Profile: ${profile.identity.alternateName || profile.idKey}`,
      vsApi.ViewColumn.One,
      {
        enableScripts: true,
      },
    );

    const bapPanel = new BapPanel(panel);
    bapPanel.update(profile);
    return bapPanel;
  }

  private update(profile: BapProfile) {
    this._panel.webview.html = this.getWebviewContent(profile);
  }

  private getWebviewContent(profile: BapProfile): string {
    const identity = profile.identity;
    const normalizedImageUrl = normalizeImageUrl(identity.image);
    const normalizedBannerUrl = normalizeImageUrl(identity.banner);

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https://ordfs.network data:;">
        <title>BAP Profile</title>
        <style>
            /* CSS Reset */
            *, *::before, *::after {
              box-sizing: border-box;
            }
            html, body {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            body {
                padding: 20px;
                color: var(--vscode-foreground);
                font-family: var(--vscode-font-family);
            }
            .profile-header {
                display: flex;
                align-items: center;
                margin-bottom: 20px;
            }
            .profile-image {
                width: 100px;
                height: 100px;
                border-radius: 50%;
                margin-right: 20px;
                background: var(--vscode-editor-background);
            }
            .profile-name {
                font-size: 1.5em;
                font-weight: bold;
            }
            .profile-description {
                color: var(--vscode-descriptionForeground);
                margin: 10px 0;
            }
            .profile-details {
                background: var(--vscode-editor-background);
                padding: 15px;
                border-radius: 6px;
                margin: 10px 0;
            }
            .detail-row {
                display: flex;
                margin: 5px 0;
            }
            .detail-label {
                font-weight: bold;
                min-width: 120px;
            }
            .detail-value {
                word-break: break-all;
            }
            .address-history {
                margin-top: 20px;
            }
            .address-entry {
                background: var(--vscode-editor-background);
                padding: 10px;
                margin: 5px 0;
                border-radius: 4px;
            }
        </style>
    </head>
    <body>
        <div class="profile-header">
            ${
              normalizedImageUrl
                ? `<img class="profile-image" src="${normalizedImageUrl}" alt="Profile" />`
                : '<div class="profile-image"></div>'
            }
            <div>
                <div class="profile-name">${
                  identity.alternateName || 'Anonymous'
                }</div>
                ${
                  identity.description
                    ? `<div class="profile-description">${identity.description}</div>`
                    : ''
                }
            </div>
        </div>

        <div class="profile-details">
            ${
              identity.paymail
                ? `
            <div class="detail-row">
                <div class="detail-label">Paymail:</div>
                <div class="detail-value">${identity.paymail}</div>
            </div>`
                : ''
            }
            
            ${
              identity.url
                ? `
            <div class="detail-row">
                <div class="detail-label">Website:</div>
                <div class="detail-value">${identity.url}</div>
            </div>`
                : ''
            }

            ${
              identity.homeLocation
                ? `
            <div class="detail-row">
                <div class="detail-label">Location:</div>
                <div class="detail-value">${identity.homeLocation.name}</div>
            </div>`
                : ''
            }

            <div class="detail-row">
                <div class="detail-label">ID Key:</div>
                <div class="detail-value">${profile.idKey}</div>
            </div>

            <div class="detail-row">
                <div class="detail-label">Current Address:</div>
                <div class="detail-value">${profile.currentAddress}</div>
            </div>

            <div class="detail-row">
                <div class="detail-label">Root Address:</div>
                <div class="detail-value">${profile.rootAddress}</div>
            </div>
        </div>

        <div class="address-history">
            <h3>Address History</h3>
            ${profile.addresses
              .map(
                (addr) => `
                <div class="address-entry">
                    <div class="detail-row">
                        <div class="detail-label">Address:</div>
                        <div class="detail-value">${addr.address}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Transaction:</div>
                        <div class="detail-value">${addr.txId}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Block:</div>
                        <div class="detail-value">${addr.block}</div>
                    </div>
                </div>
            `,
              )
              .join('\n')}
        </div>
    </body>
    </html>`;
  }

  public dispose() {
    BapPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
