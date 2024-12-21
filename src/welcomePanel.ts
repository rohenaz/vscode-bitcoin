import vsApi, { Uri, WebviewPanel, Disposable } from './vsShim';

interface WebviewMessage {
  command: 'tryFeature' | 'openKeybindings' | 'openSettings';
  feature?: string;
}

export class WelcomePanel {
  public static currentPanel: WelcomePanel | undefined;
  private readonly _panel: WebviewPanel;
  private readonly _extensionUri: Uri;
  private _disposables: Disposable[] = [];

  private constructor(panel: WebviewPanel, extensionUri: Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(
      this._handleMessage.bind(this),
      null,
      this._disposables,
    );
    this._updateWebview();
  }

  public static show(extensionUri: Uri) {
    if (process.env.TEST_ENV === 'true') {
      return;
    }

    try {
      if (WelcomePanel.currentPanel) {
        WelcomePanel.currentPanel._panel.reveal();
        return;
      }

      const panel = vsApi.window.createWebviewPanel(
        'bitcoinWelcome',
        'Welcome to Bitcoin Tools',
        vsApi.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [extensionUri],
        },
      );

      WelcomePanel.currentPanel = new WelcomePanel(panel, extensionUri);
    } catch (error) {
      if (process.env.TEST_ENV !== 'true') {
        throw error;
      }
    }
  }

  private async _handleMessage(message: WebviewMessage) {
    switch (message.command) {
      case 'tryFeature':
        if (message.feature) {
          await vsApi.commands.executeCommand(`bitcoin.${message.feature}`);
        }
        break;
      case 'openKeybindings':
        await vsApi.commands.executeCommand(
          'workbench.action.openGlobalKeybindings',
          'bitcoin',
        );
        break;
      case 'openSettings':
        await vsApi.commands.executeCommand(
          'workbench.action.openSettings',
          'bitcoin',
        );
        break;
    }
  }

  private _updateWebview() {
    this._panel.webview.html = this._getWebviewContent();
  }

  private _getWebviewContent(): string {
    const features = [
      {
        id: 'keyManagement',
        title: 'Key Management',
        description:
          'Generate and manage Bitcoin keys securely in your development environment.',
        commands: [
          { id: 'generatePrivateKey', label: 'Generate Private Key' },
          { id: 'generateMnemonic', label: 'Generate Mnemonic' },
          { id: 'showKeyVault', label: 'Open Key Vault' },
        ],
      },
      {
        id: 'dataConversion',
        title: 'Data Conversion',
        description:
          'Convert between different Bitcoin data formats with ease.',
        commands: [
          { id: 'convertData', label: 'Convert Data Format' },
          { id: 'decodeRawTx', label: 'Decode Raw Transaction' },
          { id: 'openConversionTool', label: 'Advanced Conversion Tool' },
        ],
      },
      {
        id: 'transactions',
        title: 'Transaction Tools',
        description: 'Work with Bitcoin transactions directly in VS Code.',
        commands: [
          { id: 'getTx', label: 'Get Transaction' },
          { id: 'rawTxToBob', label: 'Convert to BOB Format' },
        ],
      },
    ];

    return /* html */ `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Bitcoin Tools</title>
        <script>
          const vscode = acquireVsCodeApi();
          
          function tryFeature(feature) {
            vscode.postMessage({ command: 'tryFeature', feature });
          }
          
          function openKeybindings() {
            vscode.postMessage({ command: 'openKeybindings' });
          }
          
          function openSettings() {
            vscode.postMessage({ command: 'openSettings' });
          }
        </script>
        <style>
          :root {
            --container-padding: 20px;
            --input-padding-vertical: 6px;
            --input-padding-horizontal: 4px;
            --input-margin-vertical: 4px;
            --input-margin-horizontal: 0;
          }

          body {
            padding: var(--container-padding);
            color: var(--vscode-foreground);
            font-size: var(--vscode-font-size);
            font-weight: var(--vscode-font-weight);
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-editor-background);
          }

          h2 {
            font-weight: var(--vscode-font-weight-bold);
            margin-bottom: var(--input-margin-vertical);
            color: var(--vscode-textLink-foreground);
          }

          h3 {
            font-weight: var(--vscode-font-weight-semibold);
            color: var(--vscode-textLink-activeForeground);
            margin-top: 24px;
            margin-bottom: var(--input-margin-vertical);
          }

          button {
            border: none;
            padding: var(--input-padding-vertical) var(--input-padding-horizontal);
            text-align: center;
            outline: 1px solid transparent;
            outline-offset: 2px !important;
            color: var(--vscode-button-foreground);
            background: var(--vscode-button-background);
            margin: var(--input-margin-vertical) var(--input-margin-horizontal);
            cursor: pointer;
          }

          button:hover {
            background: var(--vscode-button-hoverBackground);
          }

          button:focus {
            outline-color: var(--vscode-focusBorder);
          }

          .feature-section {
            margin: 24px 0;
            padding: 16px;
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 4px;
          }

          .command-list {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 12px;
          }

          .tip {
            margin-top: 32px;
            padding: 12px;
            background: var(--vscode-textBlockQuote-background);
            border-left: 4px solid var(--vscode-textLink-foreground);
          }

          .quick-actions {
            margin: 24px 0;
            display: flex;
            gap: 12px;
          }
        </style>
      </head>
      <body>
        <div class="welcome-container">
          <h2>Welcome to Bitcoin Tools for VS Code</h2>
          <p>Powerful Bitcoin utilities integrated directly into your development workflow.</p>
          
          <div class="quick-actions">
            <button onclick="openKeybindings()">Configure Keyboard Shortcuts</button>
            <button onclick="openSettings()">Extension Settings</button>
          </div>

          ${features
            .map(
              (feature) => /* html */ `
            <div class="feature-section">
              <h3>${feature.title}</h3>
              <p>${feature.description}</p>
              <div class="command-list">
                ${feature.commands
                  .map(
                    (cmd) => /* html */ `
                  <button onclick="tryFeature('${cmd.id}')">Try: ${cmd.label}</button>
                `,
                  )
                  .join('')}
              </div>
            </div>
          `,
            )
            .join('')}

          <div class="tip">
            <p>💡 Access all commands through the Command Palette (Cmd/Ctrl+Shift+P) by typing "Bitcoin:"</p>
          </div>
        </div>
      </body>
      </html>`;
  }

  public dispose() {
    WelcomePanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
