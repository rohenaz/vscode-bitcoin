// src/views/keyVault/script.ts
// This script is injected into the webview. It handles events (click, input),
// maps data-cmd attributes to commands, and posts messages back to the extension.
// The extension's index.tsx listens for these messages in handleMessage().

export interface VsCodeApi {
  postMessage(message: unknown): void;
  setState(newState: unknown): unknown;
  getState(): unknown;
}

// If you want minimal global type declarations, you could do:
// declare global {
//   interface Window {
//     acquireVsCodeApi?: () => VsCodeApi;
//   }
// }

export function getPanelScript(allKeysJson: string): string {
  return `
(function() {
  // Keep a single reference to VS Code API
  let _vscode;
  function getVSCodeAPI() {
    if (!_vscode && typeof window !== 'undefined' && window.acquireVsCodeApi) {
      _vscode = window.acquireVsCodeApi();
    }
    return _vscode;
  }
  const vscode = getVSCodeAPI();

  // Attempt to parse the allKeysJson for debugging, if needed
  let allKeys = [];
  try {
    allKeys = JSON.parse(${JSON.stringify(allKeysJson)});
    console.log('[KeyVault script] Loaded allKeys:', allKeys);
  } catch (err) {
    console.warn('[KeyVault script] Failed to parse allKeysJson:', err);
  }

  console.log('[KeyVault script] Script loaded in IIFE context.');

  // ----------------------------------------------------------------
  // Event listeners
  // ----------------------------------------------------------------

  // 1) Handle clicks on elements that have data-cmd attributes
  document.addEventListener('click', event => {
    const btn = event.target && event.target.closest('[data-cmd]');
    if (!btn) return;

    const cmd = btn.getAttribute('data-cmd');
    const id = btn.getAttribute('data-id');
    const label = btn.getAttribute('data-currentlabel');

    handleCommand(cmd, id, label);
  });

  // 2) Handle "input" event for search box, etc.
  document.addEventListener('input', event => {
    const inp = event.target && event.target.closest('[data-cmd="searchKeys"]');
    if (!inp) return;

    const query = inp.value.toLowerCase();
    const items = document.querySelectorAll('#keyList .key-card');
    items.forEach(item => {
      const labelEl = item.querySelector('.key-label');
      const typeEl = item.querySelector('.key-type');
      const keyValEl = item.querySelector('.key-value');
      const lbl = labelEl ? labelEl.textContent.toLowerCase() : '';
      const t = typeEl ? typeEl.textContent.toLowerCase() : '';
      const keyVal = keyValEl ? keyValEl.textContent.toLowerCase() : '';

      const matches =
        lbl.includes(query) ||
        t.includes(query) ||
        keyVal.includes(query);
      item.style.display = matches ? '' : 'none';
    });
  });

  // ----------------------------------------------------------------
  // Handle commands from UI
  // ----------------------------------------------------------------
  function handleCommand(cmd, id, label) {
    switch (cmd) {
      // Show/hide modal
      case 'openModal':
        openModal();
        break;
      case 'closeModal':
        closeModal();
        break;

      // Key generation & adding
      case 'generateRandom':
        generateRandom();
        break;
      case 'submitAddKey':
        submitAddKey();
        break;

      // Label editing
      case 'editLabel': {
        const newLabel = prompt('Enter new label:', label || '');
        if (newLabel !== null && newLabel !== label) {
          vscode.postMessage({ command: 'updateLabel', id, label: newLabel });
        }
        break;
      }

      // Copy commands
      case 'copyPrivate':
      case 'copyPublic':
      case 'copyAddress':
      case 'copyEntireKey':
        vscode.postMessage({ command: cmd, id });
        break;

      // Derivation commands
      case 'deriveAddress':
        vscode.postMessage({ command: 'deriveAddress', id });
        break;
      case 'type42Child':
        vscode.postMessage({ command: 'type42Child', id });
        break;
      case 'bip32Child':
        // For HD keys, you wanted a separate bip32 child command
        vscode.postMessage({ command: 'bip32Child', id });
        break;

      // Encryption key
      case 'setEncryptionKey':
        vscode.postMessage({ command: 'setEncryptionKey', id });
        break;

      // Delete key
      case 'deleteKey':
        vscode.postMessage({ command: 'deleteKey', id });
        break;

      default:
        console.warn('[KeyVault script] Unknown command:', cmd);
        break;
    }
  }

  // ----------------------------------------------------------------
  // Modal open/close
  // ----------------------------------------------------------------
  function openModal() {
    const modal = document.getElementById('modalOverlay');
    if (modal) modal.classList.add('show');

    const select = document.getElementById('keyType');
    if (select) select.focus();
  }

  function closeModal() {
    const modal = document.getElementById('modalOverlay');
    if (modal) modal.classList.remove('show');
    clearModalFields();
  }

  function clearModalFields() {
    const select = document.getElementById('keyType');
    const labelEl = document.getElementById('keyLabel');
    const valueEl = document.getElementById('keyValue');

    if (select) select.value = 'private';
    if (labelEl) labelEl.value = '';
    if (valueEl) valueEl.value = '';
  }

  // ----------------------------------------------------------------
  // Generating a random key (the user selected a keyType in #keyType)
  // ----------------------------------------------------------------
  function generateRandom() {
    const select = document.getElementById('keyType');
    if (select) {
      vscode.postMessage({
        command: 'generateRandomKey',
        type: select.value
      });
    }
  }

  // ----------------------------------------------------------------
  // Submitting a newly added key
  // ----------------------------------------------------------------
  function submitAddKey() {
    const select = document.getElementById('keyType');
    const labelEl = document.getElementById('keyLabel');
    const valueEl = document.getElementById('keyValue');

    if (!select || !labelEl || !valueEl) return;
    const type = select.value;
    const labelVal = labelEl.value.trim() || null;
    const val = valueEl.value.trim();

    if (!val) {
      alert('Key Value is required!');
      return;
    }

    vscode.postMessage({
      command: 'submitAddKey',
      type,
      value: val,
      label: labelVal || \`Imported \${type} Key\`
    });

    closeModal();
  }

  // ----------------------------------------------------------------
  // Listen for messages from extension -> webview
  // e.g. "populateGeneratedKey" with a newly generated key
  // ----------------------------------------------------------------
  window.addEventListener('message', event => {
    const msg = event.data;
    if (msg.command === 'populateGeneratedKey') {
      const keyValueInput = document.getElementById('keyValue');
      if (keyValueInput) {
        keyValueInput.value = msg.value;
      }
      if (msg.finalType) {
        const select = document.getElementById('keyType');
        if (select) {
          select.value = msg.finalType;
        }
      }
    }
  });
})();
`;
}