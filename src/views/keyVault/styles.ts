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
input, select, button, textarea {
  font-family: inherit;
  font-size: inherit;
}
input:focus, select:focus, button:focus, textarea:focus {
  outline: 1px solid var(--focus-border);
}
textarea {
  background: var(--input-bg);
  color: var(--input-fg);
  border: 1px solid var(--input-border);
  border-radius: 2px;
  padding: 8px;
  resize: vertical;
  min-height: 100px;
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
  cursor: pointer;
}
.edit-label {
  background: none;
  border: none;
  color: var(--vscode-foreground);
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0;
}
.key-type-container {
  display: flex;
  align-items: center;
  gap: 8px;
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
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 8px;
}
.key-badge.encryption {
  background: var(--vscode-gitDecoration-addedResourceForeground);
  color: var(--vscode-button-foreground);
}
.key-badge.identity {
  background: var(--vscode-gitDecoration-modifiedResourceForeground);
  color: var(--vscode-button-foreground);
}
.key-badge.funding {
  background: var(--vscode-gitDecoration-untrackedResourceForeground);
  color: var(--vscode-button-foreground);
}
.key-badge.testnet {
  background: var(--vscode-charts-blue);
  color: var(--vscode-button-foreground);
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
  transition: background 0.15s;
}
.key-value:hover {
  background: var(--secondary-btn);
}
.key-value:hover span {
  color: var(--secondary-btn-text);
}
.key-value span {
  transition: color 0.15s;
}
.key-value:hover span[title]:after {
  content: attr(title);
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
  position: relative;
}
.key-text .unmasked {
  display: none;
  position: absolute;
  left: 0;
  top: 0;
}
.key-text:hover .masked {
  display: none;
}
.key-text:hover .unmasked {
  display: block;
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
.hover-reveal {
  position: relative;
}
.hover-reveal .hover-show {
  display: none;
}
.hover-reveal:hover .hover-hidden {
  visibility: hidden;
}
.hover-reveal:hover .hover-show {
  display: block;
  position: absolute;
  left: 0;
  top: 0;
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.key-card[data-is-encryption-key="true"] {
  border: 2px solid var(--vscode-gitDecoration-addedResourceForeground);
}
.key-card[data-is-identity-key="true"] {
  border: 2px solid var(--vscode-gitDecoration-modifiedResourceForeground);
}
.key-card[data-is-funding-key="true"] {
  border: 2px solid var(--vscode-gitDecoration-untrackedResourceForeground);
}
.header-buttons {
  display: flex;
  gap: 8px;
}
.btn {
  padding: 4px 8px;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  border-radius: 2px;
  cursor: pointer;
}
.btn:hover {
  background: var(--vscode-button-hoverBackground);
}
#sharesModal {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  justify-content: center;
  align-items: center;
}

#sharesModal .modal-content {
  background-color: var(--bg);
  border-radius: 4px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

#sharesModal .modal-header {
  padding: 16px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

#sharesModal .modal-body {
  padding: 16px;
}

#sharesModal .modal-actions {
  padding: 16px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
}

#sharesInput {
  min-height: 150px;
  font-family: monospace;
  width: 100%;
  resize: vertical;
}
`;