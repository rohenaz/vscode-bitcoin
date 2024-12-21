import * as path from 'node:path';
import vsApi from '../../vsShim';
import { WorkspaceManager } from '../../workspace';

export async function detectAndConvert(): Promise<{ data: string; type: string; name?: string } | undefined> {
  const workspaceManager = new WorkspaceManager();

  const input = await vsApi.window.showInputBox({
    prompt: 'Enter base64 encoded data to convert',
    placeHolder: 'e.g. /9j/4AAQSkZJRg...',
  });

  if (!input) {
    return undefined;
  }

  const uri = await workspaceManager.detectAndConvertContent(input);
  if (!uri) {
    throw new Error('Failed to convert content. Please check the input data.');
  }

  vsApi.window.showInformationMessage(
    `Content saved to ${vsApi.workspace.asRelativePath(uri)}`,
  );

  // Open the file if it's an image or text
  const contentType = path.extname(uri.fsPath).toLowerCase();
  if (['.jpeg', '.jpg', '.png', '.gif', '.bmp'].includes(contentType)) {
    vsApi.commands.executeCommand('vscode.open', uri);
  } else if (['.json', '.xml', '.txt'].includes(contentType)) {
    const doc = await vsApi.workspace.openTextDocument(uri);
    await vsApi.window.showTextDocument(doc);
  }

  return {
    data: `Content saved to ${vsApi.workspace.asRelativePath(uri)}`,
    type: 'conversions',
    name: path.basename(uri.fsPath),
  };
}
