// src/views/keyVault/script.ts
/**
 * Updated: We no longer call `prompt()` for "editLabel".
 * Instead, we post a message { command: 'requestEditLabel', ... } to the extension,
 * which then handles the user prompt using VS Code's showInputBox.
 */

export function getPanelScript(allKeysJson: string): string {
  return `
(function() {
  let _vscode;
  function getVSCodeAPI() {
    if (!_vscode && typeof window !== 'undefined' && window.acquireVsCodeApi) {
      _vscode = window.acquireVsCodeApi();
    }
    return _vscode;
  }
  const vscode = getVSCodeAPI();

  let allKeys = [];
  try {
    allKeys = JSON.parse(${JSON.stringify(allKeysJson)});
    console.log('[KeyVault script] allKeys:', allKeys);
  } catch (err) {
    console.warn('[KeyVault script] parse error:', err);
  }

  document.addEventListener('click', evt => {
    const btn = evt.target && evt.target.closest('[data-cmd]');
    if (!btn) return;

    const cmd = btn.getAttribute('data-cmd');
    const id = btn.getAttribute('data-id');
    const currentLabel = btn.getAttribute('data-currentlabel') || '';

    handleCommand(cmd, id, currentLabel);
  });

  document.addEventListener('input', evt => {
    const inp = evt.target && evt.target.closest('[data-cmd="searchKeys"]');
    if (!inp) return;

    const query = inp.value.toLowerCase();
    const items = document.querySelectorAll('#keyList .key-card');
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const lblEl = item.querySelector('.key-label');
      const tEl = item.querySelector('.key-type');
      const valEl = item.querySelector('.key-value');
      const lbl = lblEl ? lblEl.textContent.toLowerCase() : '';
      const t = tEl ? tEl.textContent.toLowerCase() : '';
      const val = valEl ? valEl.textContent.toLowerCase() : '';
      const matches = lbl.includes(query) || t.includes(query) || val.includes(query);
      item.style.display = matches ? '' : 'none';
    }
  });

  function handleCommand(cmd, id, currentLabel) {
    switch (cmd) {
      case 'openModal':
        openModal();
        break;
      case 'closeModal':
        closeModal();
        break;
      case 'generateRandom': {
        const sel = document.getElementById('keyType');
        if (sel) {
          vscode.postMessage({ command: 'generateRandomKey', type: sel.value });
        }
        break;
      }
      case 'submitAddKey':
        submitAddKey();
        break;

      case 'editLabel':
        // Instead of a prompt(), request extension side to showInputBox
        vscode.postMessage({ command: 'requestEditLabel', id, currentLabel });
        break;

      // Forward these directly to extension:
      case 'deleteKey':
      case 'setEncryptionKey':
      case 'copyPrivate':
      case 'copyPublic':
      case 'copyAddress':
      case 'copyEntireKey':
      case 'copyHex':
      case 'copyWif':
      case 'copyXprv':
      case 'copyXpub':
      case 'copyPub':
      case 'copyWords':
      case 'deriveAddress':
      case 'type42Child':
      case 'bip32Child':
      case 'publicChild':
        vscode.postMessage({ command: cmd, id });
        break;

      default:
        console.warn('[KeyVault script] Unknown command:', cmd);
        break;
    }
  }

  function openModal() {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.classList.add('show');
    const sel = document.getElementById('keyType');
    if (sel) sel.focus();
  }

  function closeModal() {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.classList.remove('show');
    clearModalFields();
  }

  function clearModalFields() {
    const sel = document.getElementById('keyType');
    const lbl = document.getElementById('keyLabel');
    const val = document.getElementById('keyValue');
    if (sel) sel.value = 'wif';
    if (lbl) lbl.value = '';
    if (val) val.value = '';
  }

  function submitAddKey() {
    const sel = document.getElementById('keyType');
    const lbl = document.getElementById('keyLabel');
    const val = document.getElementById('keyValue');
    if (!sel || !lbl || !val) return;

    const t = sel.value;
    const labelVal = lbl.value.trim() || null;
    const v = val.value.trim();
    if (!v) {
      alert('Key Value is required!');
      return;
    }

    vscode.postMessage({
      command: 'submitAddKey',
      type: t,
      value: v,
      label: labelVal || ('Imported ' + t + ' Key'),
    });
    closeModal();
  }

  window.addEventListener('message', event => {
    const msg = event.data;
    if (msg.command === 'populateGeneratedKey') {
      const valEl = document.getElementById('keyValue');
      if (valEl) valEl.value = msg.value;
      if (msg.finalType) {
        const sel = document.getElementById('keyType');
        if (sel) sel.value = msg.finalType;
      }
    }
  });
})();
`;
}