// src/views/keyVault/layout.tsx
// - Replaces "Private Key (hex)" with "Private Key (WIF)"
// - Shows only WIF, HD Private, Mnemonic

export function getPanelHtml(opts: {
  nonce: string;
  cspSource: string;
  keyElements: JSX.Element[];
  script: string;
  styles: string;
}): string {
  const { nonce, cspSource, keyElements, script, styles } = opts;

  const page = (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta
          http-equiv="Content-Security-Policy"
          content={`
            default-src 'none';
            sandbox allow-scripts allow-same-origin allow-forms allow-modals;
            style-src ${cspSource} 'unsafe-inline';
            script-src 'nonce-${nonce}';
          `}
        />
        <title>Bitcoin Key Vault</title>
        <style safe>{styles}</style>
      </head>
      <body>
        <HeaderBar />
        <div id="keyList">
          {keyElements}
        </div>
        <Modal />
        <script nonce={nonce}>{script}</script>
      </body>
    </html>
  );

  // Convert typed-HTML to a string
  return `<!DOCTYPE html>\n${String(page)}`;
}

export function HeaderBar(): JSX.Element {
  return (
    <div class="header">
      <input
        id="searchInput"
        type="text"
        placeholder="Search keys..."
        data-cmd="searchKeys"
      />
      <button 
        class="add-key-button" 
        data-cmd="openModal" 
        type="button"
      >
        <i class="codicon codicon-add" />
        Add Key
      </button>
    </div>
  );
}

export function Modal(): JSX.Element {
  return (
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Add New Key</h2>
          <button class="close-modal" data-cmd="closeModal" type="button">
            ×
          </button>
        </div>

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

        <div class="modal-actions">
          <button class="secondary" data-cmd="generateRandom" type="button">
            Generate
          </button>
          <div>
            <button class="secondary" data-cmd="closeModal" type="button">
              Cancel
            </button>
            <button class="primary" data-cmd="submitAddKey" type="button">
              Add Key
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}