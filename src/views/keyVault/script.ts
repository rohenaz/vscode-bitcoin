// src/views/keyVault/script.ts
export function getPanelScript(allKeysJson: string): string {
  return `
    const vscode = acquireVsCodeApi();
    let allKeys = ${allKeysJson};

    // Just for debugging
    console.log('Script loaded!'); 

    document.addEventListener('click', event => {
      const btn = event.target.closest('[data-cmd]');
      if (!btn) return;

      const cmd = btn.getAttribute('data-cmd');
      const id = btn.getAttribute('data-id');
      const label = btn.getAttribute('data-currentlabel');

      handleCommand(cmd, id, label);
    });

    document.addEventListener('input', event => {
      const inp = event.target.closest('[data-cmd="searchKeys"]');
      if (!inp) return;
      const query = inp.value.toLowerCase();

      const items = document.querySelectorAll('#keyList .key-card');
      items.forEach(item => {
        const labelEl = item.querySelector('.key-label');
        const typeEl = item.querySelector('.key-type');
        const lbl = labelEl ? labelEl.textContent.toLowerCase() : '';
        const t = typeEl ? typeEl.textContent.toLowerCase() : '';
        item.style.display = (lbl.includes(query) || t.includes(query)) ? '' : 'none';
      });
    });

    function handleCommand(cmd, id, label) {
      switch (cmd) {
        case 'openModal':
          openModal();
          break;
        case 'closeModal':
          closeModal();
          break;
        case 'generateRandom':
          const keyType = document.getElementById('keyType');
          if (keyType) {
            vscode.postMessage({ command: 'generateRandomKey', type: keyType.value });
          }
          break;
        case 'submitAddKey':
          submitAddKey();
          break;
        case 'editLabel':
          const newLabel = prompt('Enter new label:', label || '');
          if (newLabel !== null && newLabel !== label) {
            vscode.postMessage({ command: 'updateLabel', id, label: newLabel });
          }
          break;
        case 'copyPrivate':
        case 'copyPublic':
        case 'copyAddress':
        case 'deriveAddress':
        case 'type42Child':
        case 'deleteKey':
        case 'setEncryptionKey':
          vscode.postMessage({ command: cmd, id });
          break;
      }
    }

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
      const label = document.getElementById('keyLabel');
      const value = document.getElementById('keyValue');
      if (select) select.value = 'private';
      if (label) label.value = '';
      if (value) value.value = '';
    }

    function submitAddKey() {
      const select = document.getElementById('keyType');
      const labelEl = document.getElementById('keyLabel');
      const valueEl = document.getElementById('keyValue');
      if (!select || !labelEl || !valueEl) return;

      const type = select.value;
      const label = labelEl.value.trim() || null;
      const val = valueEl.value.trim();
      if (!val) {
        alert('Key Value is required!');
        return;
      }
      vscode.postMessage({
        command: 'submitAddKey',
        type,
        value: val,
        label: label || ('Imported ' + type + ' Key'),
      });
      closeModal();
    }

    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.command === 'populateGeneratedKey') {
        const keyValueInput = document.getElementById('keyValue');
        if (keyValueInput) {
          keyValueInput.value = msg.value;
        }
        if (msg.finalType) {
          const select = document.getElementById('keyType');
          if (select) select.value = msg.finalType;
        }
      }
    });
  `;
}