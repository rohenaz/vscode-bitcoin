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
            style-src ${cspSource} 'unsafe-inline';
            script-src 'nonce-${nonce}';
            frame-src 'none';
            sandbox allow-scripts;
          `}
        />
        <title>Vault</title>
        <style safe>{styles}</style>
      </head>
      <body>
        <HeaderBar />
        <div id="keyList">
          {keyElements}
        </div>
        <Modal />
        <SharesModal />
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
        class="search-input"
      />
      <div class="header-buttons">
        <button class="btn" data-cmd="openModal" type="button">
          Add Key
        </button>
        <button class="btn" data-cmd="importBackup" type="button">
          Import
        </button>
        <button class="btn" data-cmd="openSharesModal" type="button">
          Reconstruct from Shares
        </button>
      </div>
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
            <option value="wif-testnet">Private Key (WIF - Testnet)</option>
            <option value="vanity">Vanity Address</option>
            <option value="vanity-testnet">Vanity Address (Testnet)</option>
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

        <div class="form-group" id="vanityPrefixGroup" style="display:none;">
          <label for="vanityPrefix">Desired Prefix</label>
          <input type="text" id="vanityPrefix" maxlength="5" placeholder="Prefix (1-5 base58 chars)" />
        </div>

        <div class="modal-actions">
          <button class="secondary" data-cmd="generateRandom" type="button" id="generateBtn">
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

export function SharesModal(): JSX.Element {
  return (
    <div class="modal-overlay" id="sharesModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Reconstruct from Key Shares</h2>
          <button class="close-modal" data-cmd="closeSharesModal" type="button">
            ×
          </button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label for="sharesLabel">Label</label>
            <input type="text" id="sharesLabel" placeholder="Enter a label for the reconstructed key" />
          </div>
          <div class="form-group">
            <label for="sharesInput">Key Shares (one per line)</label>
            <textarea id="sharesInput" placeholder="Paste your key shares here, one per line" />
          </div>
        </div>

        <div class="modal-actions">
          <div />
          <div>
            <button class="secondary" data-cmd="closeSharesModal" type="button">
              Cancel
            </button>
            <button class="primary" data-cmd="submitReconstructShares" type="button">
              Reconstruct Key
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}