export const keyPanelStyles = `
:root {
  --bg: var(--vscode-editor-background);
  --fg: var(--vscode-editor-foreground);
  --border: var(--vscode-panel-border);
  --focus-border: var(--vscode-focusBorder);
  --description-fg: var(--vscode-descriptionForeground);
  --primary-btn: var(--vscode-button-background);
  --primary-btn-text: var(--vscode-button-foreground);
  --primary-btn-hover: var(--vscode-button-hoverBackground);
  --secondary-btn: var(--vscode-button-secondaryBackground);
  --secondary-btn-text: var(--vscode-button-secondaryForeground);
  --secondary-btn-hover: var(--vscode-button-secondaryHoverBackground);
  --input-bg: var(--vscode-input-background);
  --input-fg: var(--vscode-input-foreground);
  --input-border: var(--vscode-input-border);
}
body {
  padding: 0;
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: var(--vscode-font-family);
}
.header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--bg);
  padding: 12px;
  display: flex;
  gap: 12px;
  align-items: center;
  border-bottom: 1px solid var(--border);
}
#searchInput {
  flex: 1;
  min-width: 200px;
  padding: 4px 8px;
  background: var(--input-bg);
  color: var(--input-fg);
  border: 1px solid var(--input-border);
  border-radius: 2px;
}
input, select, button {
  font-family: inherit;
  font-size: inherit;
}
input:focus, select:focus, button:focus {
  outline: 1px solid var(--focus-border);
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
  padding: 12px;
}
.key-card {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.indent-1 { margin-left: 20px; }
.indent-2 { margin-left: 40px; }
.indent-3 { margin-left: 60px; }
.key-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.key-label {
  display: flex;
  align-items: center;
  gap: 8px;
}
.edit-label {
  background: none;
  border: none;
  color: var(--vscode-foreground);
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0;
}
.key-type {
  font-size: 0.8rem;
  padding: 2px 6px;
  border-radius: 3px;
  background: var(--secondary-btn);
  color: var(--secondary-btn-text);
}
.type-private { background: #553333; }
.type-public { background: #335533; }
.type-wif { background: #333355; }
.type-hdprivate { background: #553355; }
.type-hdpublic { background: #335555; }
.type-mnemonic { background: #555533; }
.type-encryption { background: #444444; }
.key-badge {
  background: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
  border-radius: 3px;
  font-size: 0.7rem;
  padding: 1px 4px;
}
.key-value {
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: 0.8rem;
  padding: 8px;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: 3px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.key-content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}
.key-text {
  font-family: var(--vscode-editor-font-family);
  font-size: 0.75rem;
  color: var(--vscode-editor-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.key-badges {
  display: flex;
  gap: 4px;
}
.key-actions {
  display: flex;
  gap: 4px;
  margin-left: 12px;
}
.key-button {
  background: var(--vscode-button-secondaryBackground);
  border: none;
  border-radius: 3px;
  color: var(--vscode-button-secondaryForeground);
  cursor: pointer;
  font-size: 0.7rem;
  font-weight: 500;
  height: 20px;
  letter-spacing: 0.5px;
  min-width: 40px;
  padding: 0 8px;
  text-transform: uppercase;
  transition: background-color 0.2s;
}
.key-button:hover {
  background: var(--vscode-button-secondaryHoverBackground);
}
.format-badge {
  background: var(--vscode-badge-background);
  border: none;
  border-radius: 3px;
  color: var(--vscode-badge-foreground);
  cursor: pointer;
  font-size: 0.65rem;
  font-weight: 500;
  height: 16px;
  letter-spacing: 0.5px;
  min-width: 32px;
  padding: 0 4px;
  text-transform: uppercase;
}
.format-badge:hover {
  opacity: 0.8;
}
.key-metadata {
  font-size: 0.8rem;
  color: var(--description-fg);
}
.encryption-key-badge {
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: 3px;
  background: var(--primary-btn);
  color: var(--primary-btn-text);
}
.modal-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  z-index: 1000;
}
.modal-overlay.show {
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-content {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 20px;
  min-width: 400px;
  max-width: 90vw;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.modal-header h2 {
  margin: 0;
  font-size: 1.2rem;
}
.close-modal {
  background: none;
  border: none;
  color: var(--fg);
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
}
.form-group {
  margin-bottom: 16px;
}
.form-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 0.9rem;
}
.form-group input,
.form-group select {
  width: 100%;
  padding: 6px 8px;
  background: var(--input-bg);
  color: var(--input-fg);
  border: 1px solid var(--input-border);
  border-radius: 3px;
}
.modal-actions {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 20px;
}
.modal-actions > div {
  display: flex;
  gap: 8px;
}
button.primary {
  background: var(--primary-btn);
  color: var(--primary-btn-text);
  border: none;
  padding: 6px 12px;
  border-radius: 3px;
  cursor: pointer;
}
button.primary:hover {
  background: var(--primary-btn-hover);
}
button.secondary {
  background: var(--secondary-btn);
  color: var(--secondary-btn-text);
  border: none;
  padding: 6px 12px;
  border-radius: 3px;
  cursor: pointer;
}
button.secondary:hover {
  background: var(--secondary-btn-hover);
}
.mnemonic-text {
  filter: blur(4px);
  transition: filter 0.2s;
}
.mnemonic-text:hover {
  filter: none;
}
`;