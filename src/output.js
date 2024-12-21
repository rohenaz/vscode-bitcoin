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
exports.OutputManager = void 0;
const vscode = __importStar(require('vscode'));
const workspace_1 = require('./workspace');
class OutputManager {
  constructor() {
    this.workspaceManager = new workspace_1.WorkspaceManager();
  }
  getOutputPreference(command) {
    const config = vscode.workspace.getConfiguration('bitcoin');
    const prefs = config.get('outputPreference');
    return prefs?.[command] || 'clipboard';
  }
  async handleOutput(data, command, type, name) {
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
  async detectAndConvert(data) {
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
exports.OutputManager = OutputManager;
//# sourceMappingURL=output.js.map
