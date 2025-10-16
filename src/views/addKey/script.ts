export function getAddKeyScript(): string {
  return `
(function() {
  const vscode = acquireVsCodeApi();

  function validateKeyValue(value) {
    return value.length >= 10; // Basic length check only
  }

  function updateAddButtonState() {
    const addButton = document.querySelector('[data-cmd="submitAddKey"]');
    const keyValue = document.getElementById('keyValue');
    
    if (!addButton || !keyValue) return;
    
    const isValid = validateKeyValue(keyValue.value);
    addButton.disabled = !isValid;
  }

  document.addEventListener('click', function(evt) {
    const btn = evt.target && evt.target.closest('[data-cmd]');
    if (!btn) return;

    const cmd = btn.getAttribute('data-cmd');
    
    switch (cmd) {
      case 'generateRandom': {
        const sel = document.getElementById('keyType');
        if (sel) {
          vscode.postMessage({ command: 'generateRandomKey', type: sel.value });
        }
        break;
      }

      case 'submitAddKey': {
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
      }
    }
  });

  // Add validation on value input
  const keyValue = document.getElementById('keyValue');
  if (keyValue) {
    keyValue.addEventListener('input', updateAddButtonState);
  }

  // Listen for extension messages
  window.addEventListener('message', function(event) {
    const msg = event.data;
    if (msg.command === 'populateGeneratedKey') {
      const valEl = document.getElementById('keyValue');
      if (valEl) valEl.value = msg.value;
      if (msg.finalType) {
        const sel = document.getElementById('keyType');
        if (sel) sel.value = msg.finalType;
      }
      updateAddButtonState();
    } else if (msg.command === 'clearForm') {
      const sel = document.getElementById('keyType');
      const lbl = document.getElementById('keyLabel');
      const val = document.getElementById('keyValue');
      if (sel) sel.value = 'wif';
      if (lbl) lbl.value = '';
      if (val) val.value = '';
      updateAddButtonState();
    }
  });

  // Initialize when the script loads
  updateAddButtonState();
})();
`;
} 