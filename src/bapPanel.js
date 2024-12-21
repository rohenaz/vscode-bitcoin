var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? (o, m, k, k2) => {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = { enumerable: true, get: () => m[k] };
        }
        Object.defineProperty(o, k2, desc);
      }
    : (o, m, k, k2) => {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? (o, v) => {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : (o, v) => {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (() => {
    var ownKeys = (o) => {
      ownKeys =
        Object.getOwnPropertyNames ||
        ((o) => {
          var ar = [];
          for (var k in o)
            if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        });
      return ownKeys(o);
    };
    return (mod) => {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, '__esModule', { value: true });
exports.BapPanel = void 0;
const vscode = __importStar(require('vscode'));
class BapPanel {
  constructor(panel) {
    this._disposables = [];
    this._panel = panel;
    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }
  static show(profile) {
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
  update(profile) {
    this._panel.webview.html = this.getWebviewContent(profile);
  }
  getWebviewContent(profile) {
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
  dispose() {
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
exports.BapPanel = BapPanel;
//# sourceMappingURL=bapPanel.js.map
