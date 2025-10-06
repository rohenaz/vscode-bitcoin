// Webview script for KeyVault panel
// This runs in the browser context, not Node.js

declare function acquireVsCodeApi(): any;

interface KeyVaultPayload {
  keys: any[];
  searchIndex: Record<string, string[]>;
}

// Initialize
const vscode = acquireVsCodeApi();

// This will be injected by the backend when the HTML is generated
declare const KEYVAULT_PAYLOAD: KeyVaultPayload;

let payload: KeyVaultPayload = { keys: [], searchIndex: {} };
try {
  payload = KEYVAULT_PAYLOAD;
} catch (e) {
  console.warn('[KeyVault script] Failed to load payload:', e);
}

document.addEventListener('click', (evt) => {
  const btn = (evt.target as HTMLElement)?.closest<HTMLElement>('[data-cmd]');
  if (!btn) return;

  const cmd = btn.getAttribute('data-cmd');
  // Handle modal commands immediately
  switch (cmd) {
    case 'openModal':
      openModal();
      return;
    case 'closeModal':
      closeModal();
      return;
    case 'openSharesModal':
      openSharesModal();
      return;
    case 'closeSharesModal':
      closeSharesModal();
      return;
    case 'importBackup':
      vscode.postMessage({ command: 'importBackup' });
      return;
  }

  const id = btn.getAttribute('data-id');
  const currentLabel = btn.getAttribute('data-currentlabel') || '';

  handleCommand(cmd, id, currentLabel);
});

// Function to perform search filtering on key cards
function performSearch() {
  const inp = document.getElementById('searchInput') as HTMLInputElement;
  if (!inp) return;
  const query = (inp.value || '').toLowerCase().trim();
  const items = document.querySelectorAll<HTMLElement>('#keyList .key-card');
  if (query === '') {
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
    const matches = tokens.some((t) => t && t.includes(query));
    item.style.display = matches ? '' : 'none';
  }
}

// Attach the performSearch function to input, keyup, and change events
document.addEventListener('input', performSearch);
document.addEventListener('keyup', performSearch);
document.addEventListener('change', performSearch);

// Secure reveal: mousedown to show full key, mouseup to hide
document.addEventListener('mousedown', (evt) => {
  const target = (evt.target as HTMLElement)?.closest<HTMLElement>('.secure-reveal');
  if (target) {
    target.classList.add('revealing');
  }
});

document.addEventListener('mouseup', () => {
  document.querySelectorAll('.secure-reveal.revealing').forEach(el => {
    el.classList.remove('revealing');
  });
});

// Also remove revealing class when mouse leaves the document
document.addEventListener('mouseleave', () => {
  document.querySelectorAll('.secure-reveal.revealing').forEach(el => {
    el.classList.remove('revealing');
  });
});

document.getElementById('keyType')?.addEventListener('change', (evt) => {
  const current = (evt.target as HTMLSelectElement)?.value;
  const vanityGroup = document.getElementById('vanityPrefixGroup');
  const valueInput = document.getElementById('keyValue') as HTMLInputElement;
  const generateBtn = document.getElementById('generateBtn');

  const isVanity = current === 'vanity' || current === 'vanity-testnet';
  if (vanityGroup) vanityGroup.style.display = isVanity ? 'block' : 'none';
  if (valueInput) valueInput.disabled = isVanity;
  if (generateBtn && !generateBtn.getAttribute('data-loading')) {
    generateBtn.textContent = isVanity ? 'Generate Vanity' : 'Generate';
  }
});

function setGenerateLoading(isLoading: boolean) {
  const btn = document.getElementById('generateBtn');
  if (!btn) return;
  if (isLoading) {
    btn.setAttribute('data-loading', 'true');
    btn.textContent = 'Generating...';
    btn.setAttribute('disabled', 'true');
  } else {
    btn.removeAttribute('data-loading');
    const keyType = (document.getElementById('keyType') as HTMLSelectElement)?.value;
    btn.textContent = keyType?.startsWith('vanity') ? 'Generate Vanity' : 'Generate';
    btn.removeAttribute('disabled');
  }
}

function handleCommand(cmd: string | null, id: string | null, currentLabel: string) {
  switch (cmd) {
    case 'openModal':
      openModal();
      break;

    case 'closeModal':
      closeModal();
      break;

    case 'openSharesModal':
      openSharesModal();
      break;

    case 'closeSharesModal':
      closeSharesModal();
      break;

    case 'generateRandom': {
      const sel = document.getElementById('keyType') as HTMLSelectElement;
      if (sel) {
        vscode.postMessage({ command: 'generateRandomKey', type: sel.value });
        if (sel.value === 'vanity' || sel.value === 'vanity-testnet') {
          setGenerateLoading(true);
        }
      }
      break;
    }

    case 'submitAddKey':
      submitAddKey();
      break;

    case 'submitReconstructShares':
      submitReconstructShares();
      break;

    case 'importBackup':
      vscode.postMessage({ command: 'importBackup' });
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
    case 'copyTAddress':
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
    case 'setFundingKey':
    case 'clearFundingKey':
    case 'setOrdinalsKey':
    case 'clearOrdinalsKey':
    case 'setIdentityKey':
    case 'clearIdentityKey':
    case 'generateKeyShares':
    case 'viewKeyShares':
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

function openSharesModal() {
  const modal = document.getElementById('sharesModal');
  if (modal) {
    modal.style.display = 'flex';
    // Clear previous values
    const labelInput = document.getElementById('sharesLabel') as HTMLInputElement;
    const sharesInput = document.getElementById('sharesInput') as HTMLTextAreaElement;
    if (labelInput) labelInput.value = 'Reconstructed Key';
    if (sharesInput) sharesInput.value = '';
  }
}

function closeSharesModal() {
  const modal = document.getElementById('sharesModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function clearModalFields() {
  const sel = document.getElementById('keyType') as HTMLSelectElement;
  const lbl = document.getElementById('keyLabel') as HTMLInputElement;
  const val = document.getElementById('keyValue') as HTMLInputElement;
  const vanityGroup = document.getElementById('vanityPrefixGroup');
  const vanityInput = document.getElementById('vanityPrefix') as HTMLInputElement;
  const generateBtn = document.getElementById('generateBtn');
  if (sel) sel.value = 'wif';
  if (lbl) lbl.value = '';
  if (val) val.value = '';
  if (vanityInput) vanityInput.value = '';
  if (vanityGroup) vanityGroup.style.display = 'none';
  if (generateBtn) generateBtn.removeAttribute('data-loading');
}

function submitAddKey() {
  const sel = document.getElementById('keyType') as HTMLSelectElement;
  const lbl = document.getElementById('keyLabel') as HTMLInputElement;
  const val = document.getElementById('keyValue') as HTMLInputElement;
  const vanityPrefixInput = document.getElementById('vanityPrefix') as HTMLInputElement;
  const setAsWalletCheckbox = document.getElementById('setAsWallet') as HTMLInputElement;
  const setAsOrdinalsCheckbox = document.getElementById('setAsOrdinals') as HTMLInputElement;
  if (!sel || !lbl || !val) return;

  const t = sel.value;
  const labelVal = lbl.value.trim() || null;
  const v = val.value.trim();
  const isVanity = t === 'vanity' || t === 'vanity-testnet';
  const isTestnetWif = t === 'wif-testnet';
  const prefixRaw = vanityPrefixInput ? vanityPrefixInput.value.trim() : '';
  const prefix = prefixRaw.toLowerCase().replace(/[^123456789abcdefghijkmnopqrstuvwxyz]/g, '');

  if (!isVanity && !v) {
    alert('Key Value is required!');
    return;
  }

  if (isVanity) {
    if (!v) {
      alert('Generate the vanity key before adding.');
      return;
    }
    if (!prefix) {
      alert('Prefix is required for vanity keys.');
      return;
    }
  }

  let metadata: Record<string, string> = {};
  let typeToSend = t;

  if (isTestnetWif) {
    if (!v) {
      alert('Key Value is required!');
      return;
    }
    typeToSend = 'wif';
    metadata = { network: 'testnet' };
  }

  if (isVanity) {
    typeToSend = 'wif';
    metadata = {
      vanityPrefix: prefix,
      network: t === 'vanity' ? 'mainnet' : 'testnet',
    };
  }

  vscode.postMessage({
    command: 'submitAddKey',
    type: typeToSend,
    value: v,
    label: labelVal || 'Imported Key',
    metadata,
    setAsWallet: setAsWalletCheckbox?.checked || false,
    setAsOrdinals: setAsOrdinalsCheckbox?.checked || false,
  });
  closeModal();
}

function submitReconstructShares() {
  const labelInput = document.getElementById('sharesLabel') as HTMLInputElement;
  const sharesInput = document.getElementById('sharesInput') as HTMLTextAreaElement;

  if (!sharesInput || !labelInput) return;

  const label = labelInput.value.trim() || 'Reconstructed Key';

  // Process the input to handle various formats
  // 1. Split by any combination of newlines
  // 2. Trim whitespace from each line
  // 3. Filter out empty lines and comment lines
  const shares = sharesInput.value
    .split(/\r?\n|\r/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('#'));

  if (shares.length < 2) {
    vscode.postMessage({
      command: 'showError',
      text: 'At least 2 key shares are required',
    });
    return;
  }

  vscode.postMessage({
    command: 'reconstructFromKeyShares',
    shares,
    label,
  });

  closeSharesModal();
}

// Listen for extension messages
window.addEventListener('message', (event) => {
  const msg = event.data;
  if (msg.command === 'populateGeneratedKey') {
    const valEl = document.getElementById('keyValue') as HTMLInputElement;
    if (valEl) valEl.value = msg.value;
    if (msg.finalType) {
      const sel = document.getElementById('keyType') as HTMLSelectElement;
      if (sel) sel.value = msg.finalType;
    }
  }
  if (msg.command === 'vanityGenerationStarted') {
    setGenerateLoading(true);
  }
  if (msg.command === 'vanityGenerationCompleted') {
    setGenerateLoading(false);
  }
});
