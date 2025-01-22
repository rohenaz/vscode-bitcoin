export const keyPanelStyles = `
:root {
  --bg: var(--vscode-editor-background);
  --fg: var(--vscode-editor-foreground);
  --border: var(--vscode-panel-border);
  --focus-border: var(--vscode-focusBorder);

  --primary-btn: var(--vscode-button-background);
  --primary-btn-text: var(--vscode-button-foreground);
  --primary-btn-hover: var(--vscode-button-hoverBackground);

  --secondary-btn: var(--vscode-button-secondaryBackground);
  --secondary-btn-text: var(--vscode-button-secondaryForeground);
  --secondary-btn-hover: var(--vscode-button-secondaryHoverBackground);

  --input-bg: var(--vscode-input-background);
  --input-fg: var(--vscode-input-foreground);

  --panel-bg: var(--vscode-panel-background);
  --description-fg: var(--vscode-descriptionForeground);
}
body {
  margin: 0;
  padding: 16px;
  background: var(--bg);
  color: var(--fg);
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  line-height: 1.4;
}
input, select, button {
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
}
.header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}
#searchInput {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--input-bg);
  color: var(--input-fg);
  outline: none;
}
#searchInput:focus {
  border-color: var(--focus-border);
}
.add-key-button {
  background: var(--primary-btn);
  color: var(--primary-btn-text);
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}
.add-key-button:hover {
  background: var(--primary-btn-hover);
}
#keyList {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.key-card {
  background: var(--panel-bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.indent-0 { margin-left: 0; }
.indent-1 { margin-left: 20px; }
.indent-2 { margin-left: 40px; }
.indent-3 { margin-left: 60px; }
.key-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}
.key-type {
  font-size: 0.8rem;
  padding: 2px 6px;
  border-radius: 4px;
  color: #fff;
  text-transform: uppercase;
}
.type-private { background: #de3f3f; }
.type-wif { background: #c06f2f; }
.type-encryption { background: #d2325f; }
.type-hdprivate { background: #9e3ece; }
.type-public { background: #3f82de; }
.type-hdpublic { background: #3c46c9; }
.type-mnemonic { background: #b57f1e; }
.key-label {
  font-weight: 600;
  cursor: pointer;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.key-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
/* The main action buttons (PUB, BIP32, Type42, etc.) */
.key-button {
  border: none;
  padding: 4px 8px;
  border-radius: 3px;
  cursor: pointer;
  background: var(--secondary-btn);
  color: var(--secondary-btn-text);
  font-size: 0.85rem;
  transition: background 0.15s;
}
.key-button:hover {
  background: var(--secondary-btn-hover);
}
/* The smaller "HEX", "WIF", "XPUB" badges for alternate copies. */
.format-badge {
  border: none;
  padding: 4px 6px;
  border-radius: 3px;
  cursor: pointer;
  background: var(--secondary-btn);
  color: var(--secondary-btn-text);
  font-size: 0.75rem;
  transition: background 0.15s;
}
.format-badge:hover {
  background: var(--secondary-btn-hover);
}
.key-metadata {
  font-size: 0.8rem;
  color: var(--description-fg);
}
.key-value {
  background: var(--input-bg);
  color: var(--input-fg);
  padding: 6px;
  font-size: 0.85rem;
  word-break: break-word;
  border-radius: 3px;
}
.encryption-key-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 2px 4px;
  background: var(--secondary-btn);
  color: var(--secondary-btn-text);
  border-radius: 4px;
  font-size: 0.7rem;
}
.modal-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(2px);
  justify-content: center;
  align-items: center;
  z-index: 999;
}
.modal-overlay.show {
  display: flex;
}
.modal-content {
  background: var(--panel-bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  width: 400px;
  max-width: 90%;
  padding: 16px;
  position: relative;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.close-modal {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: var(--fg);
}
.form-group {
  margin-bottom: 12px;
}
.form-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 0.85rem;
}
.form-group select,
.form-group input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--input-bg);
  color: var(--input-fg);
}
.modal-actions {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.modal-actions button {
  border: none;
  padding: 6px 12px;
  font-size: 0.9rem;
  border-radius: 4px;
  cursor: pointer;
}
.primary {
  background: var(--primary-btn);
  color: var(--primary-btn-text);
}
.primary:hover {
  background: var(--primary-btn-hover);
}
.secondary {
  background: var(--secondary-btn);
  color: var(--secondary-btn-text);
}
.secondary:hover {
  background: var(--secondary-btn-hover);
}
`;