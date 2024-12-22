import { css } from '../../utils/css';

export const styles = css`
  body {
    margin: 0;
    padding: 16px;
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    background-color: var(--vscode-editor-background);
  }

  .container {
    max-width: 800px;
    margin: 0 auto;
  }

  .panel {
    background-color: var(--vscode-panel-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 6px;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }

  .form-group {
    margin-bottom: 20px;
  }

  label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
    color: var(--vscode-foreground);
  }

  select, textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 12px;
    margin-bottom: 8px;
    font-family: var(--vscode-editor-font-family);
    font-size: var(--vscode-editor-font-size);
    background-color: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 4px;
  }

  textarea {
    min-height: 120px;
    resize: vertical;
    line-height: 1.4;
  }

  select {
    height: 36px;
  }

  select:focus, textarea:focus {
    outline: none;
    border-color: var(--vscode-focusBorder);
  }

  .format-selectors {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
    align-items: center;
  }

  .format-selectors select {
    flex: 1;
  }

  .arrow-icon {
    display: flex;
    align-items: center;
    color: var(--vscode-foreground);
    opacity: 0.7;
    font-size: 16px;
  }

  .convert-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    font-size: 16px;
    color: var(--vscode-button-foreground);
    background-color: var(--vscode-button-background);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .convert-button:hover {
    background-color: var(--vscode-button-hoverBackground);
  }

  .convert-button:active {
    transform: translateY(1px);
  }

  .output-container {
    position: relative;
  }

  #output {
    width: 100%;
    box-sizing: border-box;
    padding-right: 48px;
  }

  .copy-button {
    position: absolute;
    right: 8px;
    top: 8px;
    min-width: auto;
    height: 28px;
    padding: 0 12px;
    font-size: 14px;
    background-color: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    opacity: 0.8;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .copy-button:hover {
    background-color: var(--vscode-button-secondaryHoverBackground);
    opacity: 1;
  }

  .status-message {
    margin-top: 12px;
    padding: 8px;
    text-align: center;
    font-size: 13px;
    color: var(--vscode-notificationsInfoIcon-foreground);
    background-color: var(--vscode-notifications-background);
    border-radius: 4px;
    opacity: 0;
    transition: opacity 0.3s;
  }

  .status-message.visible {
    opacity: 1;
  }

  .codicon {
    font-family: codicon;
    font-size: 16px;
    line-height: 16px;
  }
`;
