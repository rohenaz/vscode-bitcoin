var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? (o, m, k, k2) => {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = { enumerable: true, get: () => m[k] };
        }
        Object.defineProperty(o, k2, desc);
      }
    : (o, m, k, k2) => {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? (o, v) => {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : (o, v) => {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (() => {
    var ownKeys = (o) => {
      ownKeys =
        Object.getOwnPropertyNames ||
        ((o) => {
          var ar = [];
          for (var k in o)
            if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        });
      return ownKeys(o);
    };
    return (mod) => {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, '__esModule', { value: true });
exports.WorkspaceManager = void 0;
const fs = __importStar(require('node:fs'));
const path = __importStar(require('node:path'));
const vscode = __importStar(require('vscode'));
class WorkspaceManager {
  constructor() {
    const config = vscode.workspace.getConfiguration('bitcoin');
    // Check if we have a workspace open
    if (
      !vscode.workspace.workspaceFolders ||
      vscode.workspace.workspaceFolders.length === 0
    ) {
      // No workspace open, use a temporary directory or user's home directory
      this.workspaceRoot = process.env.HOME || process.env.USERPROFILE || '.';
      vscode.window.showWarningMessage(
        'No workspace open. Bitcoin files will be stored in your home directory.',
      );
    } else {
      this.workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    }
    this.workspacePath = path.join(
      this.workspaceRoot,
      config.get('workspace.path') ?? '.bitcoin',
    );
    this.detectContentType = config.get('workspace.detectContentType') ?? true;
    this.organizeFolders = config.get('workspace.organizeFolders') ?? true;
    try {
      // Create workspace directory if it doesn't exist
      if (!fs.existsSync(this.workspacePath)) {
        fs.mkdirSync(this.workspacePath, { recursive: true });
      }
      // Check if .bitcoin is in .gitignore
      this.checkGitIgnore();
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to create Bitcoin workspace: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error; // Re-throw to prevent extension from activating in an invalid state
    }
  }
  /**
   * Check if .bitcoin is properly ignored in git
   */
  checkGitIgnore() {
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
        vscode.window.showInformationMessage(
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
        vscode.window
          .showWarningMessage(message, addToGitignore)
          .then((selection) => {
            if (selection === addToGitignore) {
              try {
                // Append .bitcoin to .gitignore
                fs.appendFileSync(gitignorePath, '\n.bitcoin\n');
                vscode.window.showInformationMessage(
                  '.bitcoin workspace added to .gitignore',
                );
              } catch (error) {
                console.error('Failed to update .gitignore:', error);
                vscode.window.showErrorMessage('Failed to update .gitignore');
              }
            }
          });
      }
    } catch (error) {
      console.error('Failed to check .gitignore:', error);
      vscode.window.showErrorMessage(
        'Failed to check .gitignore configuration',
      );
    }
  }
  /**
   * Save data to a file in the workspace
   * @param data The data to save
   * @param type The type of data (e.g., 'transaction', 'key', 'media')
   * @param suggestedName Optional suggested filename
   * @returns The URI of the saved file
   */
  async saveFile(data, type, suggestedName) {
    // Sanitize the filename
    const sanitizedName = this.sanitizeFilename(
      suggestedName ?? this.generateFilename(type),
    );
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
    return vscode.Uri.file(filePath);
  }
  /**
   * Detect content type and convert data to appropriate format
   * @param base64Data Base64 encoded data
   * @returns The URI of the saved file, or undefined if conversion failed
   */
  async detectAndConvertContent(base64Data) {
    try {
      // Decode base64 data
      const buffer = Buffer.from(base64Data, 'base64');
      if (buffer.length === 0) {
        return undefined;
      }
      // Detect content type
      const contentType = this.detectContentType
        ? await this.detectType(buffer)
        : await this.promptContentType();
      if (!contentType) {
        return undefined;
      }
      // Generate appropriate extension
      const extension = this.getExtensionForType(contentType);
      // Save to workspace
      return this.saveFile(buffer, 'media', `content${extension}`);
    } catch {
      return undefined;
    }
  }
  sanitizeFilename(input) {
    // Create a new string without private key or WIF references
    const sanitized =
      input.toLowerCase().includes('private') ||
      input.toLowerCase().includes('wif')
        ? input.replace(/private[_-]?key|wif/gi, 'output')
        : input;
    // Remove special characters
    return sanitized.replace(/[^a-zA-Z0-9.-]/g, '_');
  }
  generateFilename(type) {
    return `${type}_${Date.now()}`;
  }
  async ensureUniqueFilename(directory, filename) {
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
  async detectType(buffer) {
    // Check for common file signatures
    if (buffer.length >= 4) {
      // JPEG
      if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return 'image/jpeg';
      }
      // PNG
      if (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      ) {
        return 'image/png';
      }
    }
    // Check for JSON
    try {
      JSON.parse(buffer.toString());
      return 'application/json';
    } catch {}
    // Check for XML
    if (buffer.toString().trim().startsWith('<?xml')) {
      return 'application/xml';
    }
    // Prompt user if type not detected
    return this.promptContentType();
  }
  async promptContentType() {
    const commonTypes = [
      { label: 'JPEG Image', value: 'image/jpeg' },
      { label: 'PNG Image', value: 'image/png' },
      { label: 'JSON', value: 'application/json' },
      { label: 'XML', value: 'application/xml' },
      { label: 'Text', value: 'text/plain' },
      { label: 'Other...', value: 'other' },
    ];
    const selected = await vscode.window.showQuickPick(commonTypes, {
      placeHolder: 'Select content type',
    });
    if (!selected) {
      return undefined;
    }
    if (selected.value === 'other') {
      const customType = await vscode.window.showInputBox({
        prompt: 'Enter content type (e.g., application/pdf)',
        validateInput: (input) => {
          return /^[\w-]+\/[\w-]+$/.test(input)
            ? null
            : 'Invalid content type format. Use format: type/subtype';
        },
      });
      return customType;
    }
    return selected.value;
  }
  getExtensionForType(contentType) {
    const extensions = {
      'image/jpeg': '.jpeg',
      'image/png': '.png',
      'application/json': '.json',
      'application/xml': '.xml',
      'text/plain': '.txt',
    };
    return extensions[contentType] ?? '.bin';
  }
}
exports.WorkspaceManager = WorkspaceManager;
//# sourceMappingURL=workspace.js.map
