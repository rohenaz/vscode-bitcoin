import * as fs from 'node:fs';
import * as path from 'node:path';
import { Utils } from '@bsv/sdk';
import vsApi, { Uri, isUri } from './vsShim';

interface WorkspaceConfig {
  path: string;
  detectContentType: boolean;
  organizeFolders: boolean;
}

export class WorkspaceManager {
  private workspaceRoot: string;
  private workspacePath: string;
  private detectContentType: boolean;
  private organizeFolders: boolean;
  private isTestMode: boolean;

  constructor(workspacePath?: string) {
    // If workspacePath is provided, use it directly (test mode)
    if (workspacePath) {
      this.workspaceRoot = path.dirname(workspacePath);
      this.workspacePath = workspacePath;
      this.detectContentType = true;
      this.organizeFolders = true;
      this.isTestMode = true;
    } else {
      // Normal mode - use VS Code configuration with fallback
      this.isTestMode = false;
      const config = this.getWorkspaceConfig();

      // Check if we have a workspace open
      if (!vsApi?.workspace?.workspaceFolders?.length) {
        // No workspace open, use a temporary directory or user's home directory
        this.workspaceRoot = process.env.HOME || process.env.USERPROFILE || '.';
        if (vsApi?.window?.showWarningMessage) {
          vsApi.window.showWarningMessage(
            'No workspace open. Bitcoin files will be stored in your home directory.',
          );
        }
      } else {
        this.workspaceRoot = vsApi.workspace.workspaceFolders[0].uri.fsPath;
      }

      this.workspacePath = path.join(this.workspaceRoot, config.path);
      this.detectContentType = config.detectContentType;
      this.organizeFolders = config.organizeFolders;
    }

    try {
      // Create workspace directory if it doesn't exist
      if (!fs.existsSync(this.workspacePath)) {
        fs.mkdirSync(this.workspacePath, { recursive: true });
      }

      // Only check gitignore if we're not in test mode and VS Code API is available
      if (!this.isTestMode && vsApi?.workspace) {
        this.checkGitIgnore();
      }
    } catch (error) {
      if (!this.isTestMode && vsApi?.window?.showErrorMessage) {
        vsApi.window.showErrorMessage(
          `Failed to create Bitcoin workspace: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
      throw error; // Re-throw to prevent extension from activating in an invalid state
    }
  }

  private getWorkspaceConfig(): WorkspaceConfig {
    // Default configuration
    const defaultConfig: WorkspaceConfig = {
      path: '.bitcoin',
      detectContentType: true,
      organizeFolders: true,
    };

    // If VS Code API is not available or we're in test mode, return defaults
    if (!vsApi?.workspace?.getConfiguration) {
      return defaultConfig;
    }

    try {
      const config = vsApi.workspace.getConfiguration('bitcoin');
      return {
        path: config.get('workspace.path') ?? defaultConfig.path,
        detectContentType:
          config.get('workspace.detectContentType') ??
          defaultConfig.detectContentType,
        organizeFolders:
          config.get('workspace.organizeFolders') ??
          defaultConfig.organizeFolders,
      };
    } catch (error) {
      console.warn(
        'Failed to get VS Code configuration, using defaults:',
        error,
      );
      return defaultConfig;
    }
  }

  /**
   * Check if .bitcoin is properly ignored in git
   */
  private checkGitIgnore(): void {
    // First check if this is a git repository
    const gitPath = path.join(this.workspaceRoot, '.git');
    if (!fs.existsSync(gitPath)) {
      return; // Not a git repository, skip gitignore check
    }

    const gitignorePath = path.join(this.workspaceRoot, '.gitignore');

    try {
      // If .gitignore doesn't exist in a git repo, create it
      if (!fs.existsSync(gitignorePath)) {
        fs.writeFileSync(gitignorePath, '.bitcoin\n');
        vsApi.window.showInformationMessage(
          'Created .gitignore with .bitcoin workspace ignored',
        );
        return;
      }

      // Read existing .gitignore
      const gitignore = fs.readFileSync(gitignorePath, 'utf8');
      const lines = gitignore.split('\n');

      // Check if .bitcoin is ignored
      const isIgnored = lines.some((line) => {
        const trimmed = line.trim();
        return (
          trimmed === '.bitcoin' ||
          trimmed === '/.bitcoin' ||
          trimmed === '/.bitcoin/'
        );
      });

      if (!isIgnored) {
        const message =
          'Warning: .bitcoin workspace is not in .gitignore. This directory may contain sensitive data.';
        const addToGitignore = 'Add to .gitignore';

        vsApi.window
          .showWarningMessage(message, addToGitignore)
          .then((selection) => {
            if (selection === addToGitignore) {
              try {
                // Append .bitcoin to .gitignore
                fs.appendFileSync(gitignorePath, '\n.bitcoin\n');
                vsApi.window.showInformationMessage(
                  '.bitcoin workspace added to .gitignore',
                );
              } catch (error) {
                console.error('Failed to update .gitignore:', error);
                vsApi.window.showErrorMessage('Failed to update .gitignore');
              }
            }
          });
      }
    } catch (error) {
      console.error('Failed to check .gitignore:', error);
      vsApi.window.showErrorMessage('Failed to check .gitignore configuration');
    }
  }

  /**
   * Save data to a file in the workspace
   * @param data The data to save
   * @param type The type of data (e.g., 'transaction', 'key', 'media')
   * @param suggestedName Optional suggested filename
   * @returns The URI of the saved file
   */
  async saveFile(
    data: string | Buffer,
    type: string,
    suggestedName?: string,
  ): Promise<Uri | { fsPath: string }> {
    const timestamp = Date.now();
    const name = suggestedName ?? type;
    const sanitizedName = this.sanitizeFilename(`${name}_${timestamp}`);

    // Get the target directory
    const targetDir = this.organizeFolders
      ? path.join(this.workspacePath, type)
      : this.workspacePath;

    // Create directory if it doesn't exist
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Generate unique filename
    const filename = await this.ensureUniqueFilename(targetDir, sanitizedName);
    const filePath = path.join(targetDir, filename);

    // Save the file
    fs.writeFileSync(filePath, data);

    // In test mode, return a simple object with fsPath
    if (this.isTestMode) {
      return { fsPath: filePath };
    }

    return vsApi.Uri.file(filePath);
  }

  private sanitizeFilename(input: string): string {
    // Create a new string without private key or WIF references
    const sanitized =
      input.toLowerCase().includes('private') ||
      input.toLowerCase().includes('wif')
        ? input.replace(/private[_-]?key|wif/gi, 'output')
        : input;

    // Remove special characters
    return sanitized.replace(/[^a-zA-Z0-9.-]/g, '_');
  }

  private generateFilename(type: string): string {
    return `${type}_${Date.now()}`;
  }

  private async ensureUniqueFilename(
    directory: string,
    filename: string,
  ): Promise<string> {
    let finalName = filename;
    let counter = 1;

    while (fs.existsSync(path.join(directory, finalName))) {
      const ext = path.extname(filename);
      const base = path.basename(filename, ext);
      finalName = `${base}_${counter}${ext}`;
      counter++;
    }

    return finalName;
  }

  /**
   * Detect content type and convert data to appropriate format
   * @param base64Data Base64 encoded data
   * @param mimeType Optional MIME type for the content
   * @returns The URI of the saved file, or undefined if conversion failed
   */
  async detectAndConvertContent(
    base64Data: string,
    mimeType?: string,
  ): Promise<Uri | undefined> {
    try {
      // Convert base64 to byte array using Utils.toArray
      const bytes = Utils.toArray(base64Data);

      // If MIME type is provided, use it to determine file extension
      let extension = '';
      if (mimeType) {
        switch (mimeType.toLowerCase()) {
          case 'image/jpeg':
          case 'image/jpg': {
            extension = '.jpg';
            break;
          }
          case 'image/png': {
            extension = '.png';
            break;
          }
          case 'image/gif': {
            extension = '.gif';
            break;
          }
          case 'image/webp': {
            extension = '.webp';
            break;
          }
          case 'image/svg+xml': {
            extension = '.svg';
            break;
          }
          case 'application/json': {
            extension = '.json';
            break;
          }
          case 'text/plain': {
            extension = '.txt';
            break;
          }
          case 'text/html': {
            extension = '.html';
            break;
          }
          case 'text/xml': {
            extension = '.xml';
            break;
          }
          default: {
            // Try to extract extension from MIME type
            const match = mimeType.match(/^[^/]+\/(?:x-)?(.+)$/);
            if (match) {
              extension = `.${match[1]}`;
            }
            break;
          }
        }
      }

      // If no extension determined from MIME type, try to detect from content
      if (!extension) {
        // Check for common file signatures
        if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
          extension = '.jpg';
        } else if (
          bytes[0] === 0x89 &&
          bytes[1] === 0x50 &&
          bytes[2] === 0x4e &&
          bytes[3] === 0x47
        ) {
          extension = '.png';
        } else if (
          bytes[0] === 0x47 &&
          bytes[1] === 0x49 &&
          bytes[2] === 0x46
        ) {
          extension = '.gif';
        } else {
          // Try to detect text content
          try {
            const text = Utils.toUTF8(bytes);
            if (text.trim().startsWith('{') && text.trim().endsWith('}')) {
              extension = '.json';
            } else if (text.trim().startsWith('<')) {
              extension = text.includes('<?xml') ? '.xml' : '.html';
            } else {
              extension = '.txt';
            }
          } catch {
            extension = '.bin';
          }
        }
      }

      // Save the file with detected extension
      const uri = await this.saveFile(
        Buffer.from(bytes), // Convert back to Buffer for file system operations
        'media',
        `content${extension}`,
      );

      return isUri(uri) ? uri : vsApi.Uri.file(uri.fsPath);
    } catch (error) {
      console.error('Failed to convert content:', error);
      return undefined;
    }
  }
}
