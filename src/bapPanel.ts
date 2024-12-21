import * as vscode from 'vscode';
import type { BapProfile } from './bapService';

export class BapPanel {
  public static currentPanel: BapPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel) {
    this._panel = panel;

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public static show(profile: BapProfile) {
    const panel = vscode.window.createWebviewPanel(
      'bapProfile',
      `BAP Profile: ${profile.identity.alternateName || profile.idKey}`,
      vscode.ViewColumn.One,
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

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>BAP Profile</title>
        <style>
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
              identity.image
                ? `<img class="profile-image" src="${identity.image}" alt="Profile" />`
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
