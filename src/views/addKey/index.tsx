import vsApi, { type WebviewView, type Disposable, type WebviewViewProvider } from '../../vsShim';
import type { KeyVault, KeyType } from '../../keyVault';
import { PrivateKey, HD, Mnemonic } from '@bsv/sdk';
import { getAddKeyHtml } from './layout';
import { getAddKeyScript } from './script';

export class AddKeyViewProvider implements WebviewViewProvider {
  private _view?: WebviewView;
  private readonly _vault: KeyVault;
  private _disposables: Disposable[] = [];

  constructor(vault: KeyVault) {
    this._vault = vault;
  }

  resolveWebviewView(webviewView: WebviewView) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      enableCommandUris: false
    };

    // Set up message handling
    webviewView.webview.onDidReceiveMessage(
      (msg) => this.handleMessage(msg),
      null,
      this._disposables,
    );

    // Initial content update
    this.updateContent();
  }

  private async updateContent() {
    if (!this._view) return;

    const nonce = getNonce();
    const cspSource = this._view.webview.cspSource;

    this._view.webview.html = getAddKeyHtml({
      nonce,
      cspSource,
      script: getAddKeyScript()
    });
  }

  private async handleMessage(msg: {
    command: string;
    type?: KeyType;
    value?: string;
    label?: string;
  }) {
    switch (msg.command) {
      case 'generateRandomKey': {
        if (msg.type) {
          await this.generateRandomKey(msg.type);
        }
        break;
      }

      case 'submitAddKey': {
        if (!msg.type || !msg.value) return;
        try {
          // Store WIF first
          const id = await this._vault.storeKey({
            type: msg.type,
            value: msg.value,
            label: msg.label || `Imported ${msg.type} Key`,
            metadata: {},
          });
          // If successful, you might want to do something with 'id' or show a success message
          // For now, just logging and clearing form as per original v0.1.0-beta logic for this view
          console.log('Key added with ID:', id);
          this._view?.webview.postMessage({ command: 'clearForm' });
        } catch (err) {
          vsApi.window.showErrorMessage(`Failed to add key: ${String(err)}`);
        }
        break;
      }
    }
  }

  private async generateRandomKey(type: KeyType) {
    try {
      let val = '';
      let finalType = type;

      switch (type) {
        case 'wif':
        case 'encryption': {
          val = PrivateKey.fromRandom().toWif();
          break;
        }
        case 'hdprivate':
        case 'hdpublic': {
          const hd = HD.fromRandom();
          val = hd.toString();
          if (type === 'hdpublic') finalType = 'hdpublic';
          else finalType = 'hdprivate';
          break;
        }
        case 'mnemonic': {
          const mn = Mnemonic.fromRandom();
          val = mn.toString();
          break;
        }
        case 'private':
        case 'public': {
          const pk = PrivateKey.fromRandom();
          val = pk.toString();
          break;
        }
      }

      if (this._view) {
        this._view.webview.postMessage({
          command: 'populateGeneratedKey',
          value: val,
          type: finalType,
        });
      }
    } catch (err) {
      vsApi.window.showErrorMessage(`Failed to generate random key: ${String(err)}`);
    }
  }

  public dispose() {
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) x.dispose();
    }
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
} 