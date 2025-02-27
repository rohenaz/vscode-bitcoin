import vsApi, { OutputChannel } from './vsShim';
import { WorkspaceManager } from './workspace';

export class OutputManager {
  private workspaceManager?: WorkspaceManager;

  private getOutputPreference(
    command: string,
  ): 'clipboard' | 'file' | 'workspace' {
    // Default to clipboard if no workspace is open
    if (!vsApi.workspace.workspaceFolders?.length) {
      return 'clipboard';
    }

    const config = vsApi.workspace.getConfiguration('bitcoin');
    const preference = config.get('outputPreference') as 'clipboard' | 'file' | 'workspace';
    return preference || 'clipboard';
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
        await vsApi.env.clipboard.writeText(data);
        const changeSettings = 'Change Output Settings';
        const result = await vsApi.window.showInformationMessage(
          'Output copied to clipboard!',
          changeSettings,
        );
        if (result === changeSettings) {
          await vsApi.commands.executeCommand(
            'workbench.action.openSettings',
            'bitcoin.outputPreference',
          );
        }
        break;
      }

      case 'file': {
        const doc = await vsApi.workspace.openTextDocument({
          language: 'text',
          content: data,
        });
        await vsApi.window.showTextDocument(doc, {
          preview: false,
          preserveFocus: true,
        });
        break;
      }

      case 'workspace': {
        try {
          if (!this.workspaceManager) {
            this.workspaceManager = new WorkspaceManager();
          }
          const uri = await this.workspaceManager.saveFile(data, type, name);
          vsApi.window.showInformationMessage(`File saved: ${uri.fsPath}`);
          const doc = await vsApi.workspace.openTextDocument(
            vsApi.Uri.file(uri.fsPath),
          );
          await vsApi.window.showTextDocument(doc, {
            preview: false,
            preserveFocus: true,
          });
        } catch (error) {
          vsApi.window.showErrorMessage(
            `Failed to save file: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`,
          );
        }
        break;
      }
    }
  }

  public async detectAndConvert(
    data: string,
    mimeType?: string,
  ): Promise<void> {
    try {
      if (!this.workspaceManager) {
        this.workspaceManager = new WorkspaceManager();
      }
      const uri = await this.workspaceManager.detectAndConvertContent(data, mimeType);
      if (uri) {
        const openFile = 'Open File';
        const result = await vsApi.window.showInformationMessage(
          `File saved: ${uri.fsPath}`,
          openFile,
        );
        if (result === openFile) {
          await vsApi.env.openExternal(uri);
        }
      } else {
        vsApi.window.showWarningMessage(
          'Could not detect content type or convert data',
        );
      }
    } catch (error) {
      vsApi.window.showErrorMessage(
        `Failed to convert content: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }
}
