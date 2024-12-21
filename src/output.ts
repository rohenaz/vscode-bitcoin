import * as vscode from 'vscode';
import { WorkspaceManager } from './workspace';

export class OutputManager {
  private workspaceManager: WorkspaceManager;

  constructor() {
    this.workspaceManager = new WorkspaceManager();
  }

  private getOutputPreference(
    command: string,
  ): 'clipboard' | 'file' | 'workspace' {
    const config = vscode.workspace.getConfiguration('bitcoin');
    const prefs = config.get('outputPreference') as Record<string, string>;
    return (prefs?.[command] || 'clipboard') as
      | 'clipboard'
      | 'file'
      | 'workspace';
  }

  public async handleOutput(
    data: string,
    command: string,
    type: string,
    name?: string,
  ): Promise<void> {
    const preference = this.getOutputPreference(command);

    switch (preference) {
      case 'clipboard': {
        await vscode.env.clipboard.writeText(data);
        vscode.window.showInformationMessage('Output copied to clipboard!');
        break;
      }

      case 'file': {
        const doc = await vscode.workspace.openTextDocument({
          language: 'text',
          content: data,
        });
        await vscode.window.showTextDocument(doc, {
          preview: false,
          preserveFocus: true,
        });
        break;
      }

      case 'workspace': {
        try {
          const uri = await this.workspaceManager.saveFile(data, type, name);
          vscode.window.showInformationMessage(`File saved: ${uri.fsPath}`);
          await vscode.window.showTextDocument(uri, {
            preview: false,
            preserveFocus: true,
          });
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to save file: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`,
          );
        }
        break;
      }
    }
  }

  public async detectAndConvert(data: string): Promise<void> {
    try {
      const uri = await this.workspaceManager.detectAndConvertContent(data);
      if (uri) {
        vscode.window.showInformationMessage(`File saved: ${uri.fsPath}`);
        // For images and other binary content, use the system default application
        await vscode.env.openExternal(uri);
      } else {
        vscode.window.showWarningMessage(
          'Could not detect content type or convert data',
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to convert content: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }
}
