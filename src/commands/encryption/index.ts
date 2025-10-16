import type { EncryptionService } from '../../encryption';
import vsApi from '../../vsShim';
import type { WorkspaceManager } from '../../workspace';

export async function encrypt(
  encryptionService: EncryptionService,
  workspaceManager: WorkspaceManager,
  initialText?: string,
): Promise<void> {
  try {
    let text = initialText;

    // If no initial text provided, get from editor
    if (!text) {
      const editor = vsApi.window.activeTextEditor;
      if (!editor) {
        vsApi.window.showErrorMessage('Please open a text file and select the text you want to encrypt');
        return;
      }

      // Get selected text or entire document
      const selection = editor.selection;
      text = selection.isEmpty
        ? editor.document.getText()
        : editor.document.getText(selection);

      if (!text) {
        vsApi.window.showErrorMessage('No text to encrypt. Please select text in the editor first.');
        return;
      }
    }

    // Get encryption key
    const key = await encryptionService.promptForKey('encrypt');
    if (!key) {
      return; // User cancelled
    }

    // Check if this is a system key
    const isSystemKey = await encryptionService.isSystemKey(key);

    // Generate filename from source and public key
    const sourceFile = vsApi.window.activeTextEditor?.document.uri.fsPath.split('/').pop() || 'unknown';
    const pubKey = key.toPublicKey().toString().slice(0, 8); // Use first 8 chars of public key
    const fileName = `encrypted_${sourceFile}_${pubKey}.dat`;

    // Encrypt the data
    const { encryptedData, privateKey } = await encryptionService.encrypt(
      text,
      key,
      {
        fileName,
        command: 'bitcoin.encrypt',
      },
    );

    // Save the encrypted data
    const uri = await workspaceManager.saveFile(
      encryptedData,
      'encrypted',
      fileName,
    );

    // Show success message with key if it's not from the key vault
    if (!isSystemKey) {
      const wif = privateKey.toWif();
      await vsApi.window.showInformationMessage(
        'Data encrypted and saved. Keep this key safe:',
        { modal: true },
      );
      await vsApi.window.showInformationMessage(wif, { modal: true });
    } else {
      await vsApi.window.showInformationMessage(
        'Data encrypted and saved using system key.',
        { modal: true },
      );
    }

    // Open the encrypted file
    const doc = await vsApi.workspace.openTextDocument(uri.fsPath);
    await vsApi.window.showTextDocument(doc);
  } catch (error) {
    vsApi.window.showErrorMessage(
      `Encryption failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export async function decrypt(
  encryptionService: EncryptionService,
  initialText?: string,
): Promise<void> {
  try {
    let text = initialText;

    // If no initial text provided, get from editor
    if (!text) {
      const editor = vsApi.window.activeTextEditor;
      if (!editor) {
        vsApi.window.showErrorMessage('Please open an encrypted file and select the encrypted text to decrypt');
        return;
      }

      // Get selected text or entire document
      const selection = editor.selection;
      text = selection.isEmpty
        ? editor.document.getText()
        : editor.document.getText(selection);

      if (!text) {
        vsApi.window.showErrorMessage('No text to decrypt. Please select encrypted text in the editor first.');
        return;
      }
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
      `Decryption failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
