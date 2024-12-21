import vsApi from '../../vsShim';
import type { EncryptionService } from '../../encryption';
import type { WorkspaceManager } from '../../workspace';

export async function encrypt(
  encryptionService: EncryptionService,
  workspaceManager: WorkspaceManager,
): Promise<void> {
  try {
    // Get active text editor
    const editor = vsApi.window.activeTextEditor;
    if (!editor) {
      vsApi.window.showErrorMessage('No active text editor');
      return;
    }

    // Get selected text or entire document
    const selection = editor.selection;
    const text = selection.isEmpty
      ? editor.document.getText()
      : editor.document.getText(selection);

    if (!text) {
      vsApi.window.showErrorMessage('No text to encrypt');
      return;
    }

    // Get encryption key
    const key = await encryptionService.promptForKey('encrypt');
    if (!key) {
      return; // User cancelled
    }

    // Generate filename from source
    const fileName = editor.document.uri.fsPath.split('/').pop() || 'unknown';

    // Encrypt the data
    const { encryptedData, privateKey } = await encryptionService.encrypt(text, key, {
      fileName,
      command: 'bitcoin.encrypt',
    });

    // Save the encrypted data
    const uri = await workspaceManager.saveFile(
      encryptedData,
      'encrypted',
      `encrypted_${fileName}.dat`,
    );

    // Show success message with key
    const wif = privateKey.toWif();
    await vsApi.window.showInformationMessage(
      'Data encrypted and saved. Keep this key safe:',
      { modal: true },
    );
    await vsApi.window.showInformationMessage(wif, { modal: true });

    // Open the encrypted file
    const doc = await vsApi.workspace.openTextDocument(vsApi.Uri.file(uri.fsPath));
    await vsApi.window.showTextDocument(doc);
  } catch (error) {
    vsApi.window.showErrorMessage(
      `Encryption failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function decrypt(
  encryptionService: EncryptionService,
): Promise<void> {
  try {
    // Get active text editor
    const editor = vsApi.window.activeTextEditor;
    if (!editor) {
      vsApi.window.showErrorMessage('No active text editor');
      return;
    }

    // Get selected text or entire document
    const selection = editor.selection;
    const text = selection.isEmpty
      ? editor.document.getText()
      : editor.document.getText(selection);

    if (!text) {
      vsApi.window.showErrorMessage('No text to decrypt');
      return;
    }

    // Get decryption key
    const key = await encryptionService.promptForKey('decrypt');
    if (!key) {
      return; // User cancelled
    }

    // Decrypt the data
    const decrypted = await encryptionService.decrypt(text, key);

    // Create new document with decrypted content
    const doc = await vsApi.workspace.openTextDocument({
      content: decrypted.toString(),
      language: 'plaintext',
    });
    await vsApi.window.showTextDocument(doc);
  } catch (error) {
    vsApi.window.showErrorMessage(
      `Decryption failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
