import vsApi, { OutputChannel } from './vsShim';
import { WorkspaceManager } from './workspace';

export class OutputManager {
  private workspaceManager: WorkspaceManager;

  constructor() {
    this.workspaceManager = new WorkspaceManager();
  }

  private getOutputPreference(
    command: string,
  ): 'clipboard' | 'file' | 'workspace' {
    const config = vsApi.workspace.getConfiguration('bitcoin');
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
        await vsApi.env.clipboard.writeText(data);
        vsApi.window.showInformationMessage('Output copied to clipboard!');
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
          const uri = await this.workspaceManager.saveFile(data, type, name);
          vsApi.window.showInformationMessage(`File saved: ${uri.fsPath}`);
          const doc = await vsApi.workspace.openTextDocument(vsApi.Uri.file(uri.fsPath));
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

  public async detectAndConvert(data: string): Promise<void> {
    try {
      const uri = await this.workspaceManager.detectAndConvertContent(data);
      if (uri) {
        vsApi.window.showInformationMessage(`File saved: ${uri.fsPath}`);
        // For images and other binary content, use the system default application
        await vsApi.env.openExternal(uri);
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
