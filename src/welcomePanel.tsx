import vsApi, { type Uri, type WebviewPanel, type Disposable } from './vsShim';

interface WebviewMessage {
  command: 'openBitcoinTools' | 'openKeybindings' | 'openSettings' | 'openKeyVault';
  tab?: string;
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
      case 'openBitcoinTools':
        await vsApi.commands.executeCommand('bitcoin.openBitcoinTools');
        break;
      case 'openKeyVault':
        await vsApi.commands.executeCommand('bitcoin.showKeyVault');
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
    const tabs = [
      {
        id: 'wallet',
        icon: '💰',
        title: 'Wallet',
        description: 'Manage your Bitcoin wallet with balance tracking, sending, and receiving capabilities. Connect to your Key Vault for seamless transactions.',
      },
      {
        id: 'keys',
        icon: '🔑',
        title: 'Keys',
        description: 'Generate private keys, WIFs, mnemonics, HD keys, and vanity addresses. Derive public keys and manage all your cryptographic needs.',
      },
      {
        id: 'addresses',
        icon: '📍',
        title: 'Addresses',
        description: 'Convert keys to addresses for both mainnet and testnet. Generate P2PKH addresses from various key formats.',
      },
      {
        id: 'transactions',
        icon: '🔄',
        title: 'Transactions',
        description: 'Query transactions, fetch UTXOs, explore addresses on-chain, and decode raw transaction data.',
      },
      {
        id: 'data',
        icon: '🔧',
        title: 'Data Tools',
        description: 'Convert between hex, base64, UTF-8, and other formats. Encrypt and decrypt data with AES and ECIES.',
      },
      {
        id: 'blockchain',
        icon: '⛓️',
        title: 'Blockchain',
        description: 'Lookup BAP profiles, fetch Ordinals inscriptions, and explore blockchain data directly from VS Code.',
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

          function openBitcoinTools(tab) {
            vscode.postMessage({ command: 'openBitcoinTools', tab });
          }

          function openKeyVault() {
            vscode.postMessage({ command: 'openKeyVault' });
          }

          function openKeybindings() {
            vscode.postMessage({ command: 'openKeybindings' });
          }

          function openSettings() {
            vscode.postMessage({ command: 'openSettings' });
          }
        </script>
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

          .hero {
            text-align: center;
            padding: 40px 20px;
            margin-bottom: 32px;
          }

          .hero h1 {
            font-size: 2.5rem;
            margin-bottom: 16px;
            color: var(--vscode-textLink-activeForeground);
          }

          .hero p {
            font-size: 1.1rem;
            opacity: 0.9;
            margin-bottom: 24px;
          }

          .primary-cta {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 12px 32px;
            font-size: 1.1rem;
            cursor: pointer;
            border-radius: 4px;
            margin-right: 12px;
          }

          .primary-cta:hover {
            background: var(--vscode-button-hoverBackground);
          }

          .secondary-cta {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 12px 24px;
            font-size: 1rem;
            cursor: pointer;
            border-radius: 4px;
          }

          .secondary-cta:hover {
            background: var(--vscode-button-secondaryHoverBackground);
          }

          .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 16px;
            margin: 32px 0;
          }

          .feature-card {
            padding: 20px;
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 8px;
            border: 1px solid transparent;
            transition: border-color 0.2s;
          }

          .feature-card:hover {
            border-color: var(--vscode-textLink-foreground);
          }

          .feature-icon {
            font-size: 2rem;
            margin-bottom: 12px;
          }

          .feature-title {
            font-size: 1.2rem;
            font-weight: bold;
            margin-bottom: 8px;
            color: var(--vscode-textLink-activeForeground);
          }

          .feature-description {
            opacity: 0.8;
            line-height: 1.5;
            margin-bottom: 16px;
          }

          .feature-button {
            width: 100%;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 8px 16px;
            cursor: pointer;
            border-radius: 4px;
          }

          .feature-button:hover {
            background: var(--vscode-button-secondaryHoverBackground);
          }

          .footer {
            margin-top: 48px;
            padding-top: 24px;
            border-top: 1px solid var(--vscode-widget-border);
            text-align: center;
            opacity: 0.7;
          }

          .footer-links {
            display: flex;
            justify-content: center;
            gap: 24px;
            margin-top: 16px;
          }

          .footer-links button {
            background: transparent;
            color: var(--vscode-textLink-foreground);
            border: none;
            text-decoration: underline;
            cursor: pointer;
            padding: 4px 8px;
          }

          .footer-links button:hover {
            color: var(--vscode-textLink-activeForeground);
          }
        </style>
      </head>
      <body>
        <div class="hero">
          <h1>⚡ Bitcoin Tools for VS Code</h1>
          <p>Complete Bitcoin development toolkit integrated directly into your editor</p>
          <div>
            <button class="primary-cta" onclick="openBitcoinTools()">Open Bitcoin Tools</button>
            <button class="secondary-cta" onclick="openKeyVault()">Open Key Vault</button>
          </div>
        </div>

        <div class="features-grid">
          ${tabs
            .map(
              (tab) => /* html */ `
            <div class="feature-card">
              <div class="feature-icon">${tab.icon}</div>
              <div class="feature-title">${tab.title}</div>
              <div class="feature-description">${tab.description}</div>
              <button class="feature-button" onclick="openBitcoinTools('${tab.id}')">
                Open ${tab.title} Tab
              </button>
            </div>
          `,
            )
            .join('')}
        </div>

        <div class="footer">
          <p>💡 All tools are accessible through the Command Palette (Cmd/Ctrl+Shift+P) - just type "Bitcoin"</p>
          <div class="footer-links">
            <button onclick="openKeybindings()">Configure Shortcuts</button>
            <button onclick="openSettings()">Extension Settings</button>
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
