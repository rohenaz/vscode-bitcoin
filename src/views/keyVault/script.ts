// src/views/keyVault/script.ts

export function getPanelScript(payloadJson: string): string {
  // Since this will be injected into JSX, we need to handle the string carefully
  const scriptContent = `
(() => {
  const vscode = acquireVsCodeApi();
  
  // Parse the payload safely - note that payloadJson is already stringified and escaped
  let payload = { keys: [], searchIndex: {} };
  try {
    payload = JSON.parse(JSON.stringify(${payloadJson}));
  } catch(e) {
    console.warn('[KeyVault script] Failed to parse payload JSON:', e);
  }

  document.addEventListener('click', evt => {
    const btn = evt.target?.closest('[data-cmd]');
    if (!btn) return;

    const cmd = btn.getAttribute('data-cmd');
    // Handle modal commands immediately
    switch(cmd) {
      case 'openModal':
        openModal();
        return;
      case 'closeModal':
        closeModal();
        return;
    }

    const id = btn.getAttribute('data-id');
    const currentLabel = btn.getAttribute('data-currentlabel') || '';

    handleCommand(cmd, id, currentLabel);
  });

  // Function to perform search filtering on key cards
  function performSearch() {
    const inp = document.getElementById('searchInput');
    if (!inp) return;
    const query = (inp.value || '').toLowerCase().trim();
    const items = document.querySelectorAll('#keyList .key-card');
    console.log('performSearch triggered, query:', query, ', number of key cards:', items.length);
    if(query === "") {
      // If search is empty, show all keys
      for (let i = 0; i < items.length; i++) {
        items[i].style.display = '';
      }
      return;
    }
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const keyId = item.getAttribute('data-keyid');
      if (!keyId) continue;
      const tokens = payload.searchIndex[keyId] || [];
      // All tokens are already lowercase from buildSearchTokens
      const matches = tokens.some(t => t && t.includes(query));
      console.log('Key', keyId, 'tokens:', tokens, 'matches:', matches);
      item.style.display = matches ? '' : 'none';
    }
  }

  // Attach the performSearch function to input, keyup, and change events
  document.addEventListener('input', performSearch);
  document.addEventListener('keyup', performSearch);
  document.addEventListener('change', performSearch);

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

      // No-op so we don't see "Unknown command: searchKeys":
      case 'searchKeys':
        break;

      case 'editLabel':
        vscode.postMessage({ command: 'requestEditLabel', id, currentLabel });
        break;

      // Forward these directly to the extension side:
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
      case 'p2pkhScript':
      case 'viewOnChain':
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
      label: labelVal || \`Imported \${t} Key\`,
    });
    closeModal();
  }

  // Listen for extension messages
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
})();`;

  return scriptContent;
}