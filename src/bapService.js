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
exports.BapService = void 0;
const vscode = __importStar(require('vscode'));
class BapService {
  constructor() {
    // Get the configured BAP indexer URL or use default
    this.baseUrl = vscode.workspace
      .getConfiguration('bitcoin')
      .get('bapIndexerUrl', 'https://api.sigmaidentity.com');
  }
  async getProfile(idKey) {
    try {
      const response = await fetch(`${this.baseUrl}/v1/identity/get`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idKey }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.status !== 'OK' || !data.result) {
        throw new Error('Failed to fetch BAP profile');
      }
      return data.result;
    } catch (error) {
      throw new Error(
        `Failed to fetch BAP profile: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
  async validateByAddress(address) {
    try {
      const response = await fetch(
        `${this.baseUrl}/v1/identity/validByAddress`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ address }),
        },
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.status === 'OK';
    } catch (error) {
      throw new Error(
        `Failed to validate address: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
exports.BapService = BapService;
//# sourceMappingURL=bapService.js.map
