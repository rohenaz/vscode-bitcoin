import { css } from '../../utils/css';

export const styles = css`
  /* CSS Reset */
  *, *::before, *::after {
    box-sizing: border-box;
  }
  html, body {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    margin: 0;
    padding: 12px;
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
    border-radius: 4px;
    padding: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .form-group {
    margin-bottom: 12px;
  }

  label {
    display: block;
    margin-bottom: 6px;
    font-weight: 500;
    font-size: 12px;
    color: var(--vscode-foreground);
    opacity: 0.8;
  }

  select, textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 8px;
    margin-bottom: 6px;
    font-family: var(--vscode-editor-font-family);
    font-size: var(--vscode-editor-font-size);
    background-color: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 3px;
  }

  textarea {
    min-height: 80px;
    resize: vertical;
    line-height: 1.4;
  }

  select {
    height: 28px;
  }

  select:focus, textarea:focus {
    outline: none;
    border-color: var(--vscode-focusBorder);
  }

  .format-selectors {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 12px;
  }

  .format-group {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .format-selectors select {
    flex: 1;
    min-width: 80px;
    margin-bottom: 0;
  }

  .arrow-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--vscode-foreground);
    opacity: 0.5;
    width: 12px;
    height: 12px;
    flex-shrink: 0;
  }

  .arrow-icon svg {
    width: 12px;
    height: 12px;
    fill: currentColor;
  }

  .convert-button, .copy-button {
    width: 100%;
    height: 28px;
    padding: 0 12px;
    color: var(--vscode-button-foreground);
    background-color: var(--vscode-button-secondaryBackground);
    border: none;
    border-radius: 3px;
    cursor: pointer;
    transition: background-color 0.2s;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    opacity: 0.8;
  }

  .convert-button:hover, .copy-button:hover {
    background-color: var(--vscode-button-secondaryHoverBackground);
    opacity: 1;
  }

  .convert-button:active, .copy-button:active {
    transform: translateY(1px);
  }

  .output-container {
    display: flex;
    flex-direction: column;
  }

  #output {
    width: 100%;
    box-sizing: border-box;
    padding-right: 36px;
  }

  .copy-button svg {
    width: 14px;
    height: 14px;
  }

  .copy-button:hover {
    background-color: var(--vscode-button-secondaryBackground);
    opacity: 1;
  }

  .status-message {
    margin-top: 8px;
    padding: 6px;
    text-align: center;
    font-size: 11px;
    color: var(--vscode-notificationsInfoIcon-foreground);
    background-color: var(--vscode-notifications-background);
    border-radius: 3px;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .status-message.visible {
    opacity: 1;
  }

  @media (max-width: 280px) {
    body {
      padding: 8px;
    }

    .panel {
      padding: 8px;
    }

    .format-group {
      width: 100%;
    }

    #output {
      padding-right: 32px;
    }
  }
`;
