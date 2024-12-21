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
exports.KeyVault = void 0;
const crypto = __importStar(require('node:crypto'));
const vscode = __importStar(require('vscode'));
class KeyVault {
  constructor(context) {
    this.keyListKey = 'bitcoin.keyList';
    this.storage = context.secrets;
    this.onKeyListChanged = new vscode.EventEmitter();
  }
  get onDidChangeKeys() {
    return this.onKeyListChanged.event;
  }
  async getKeyList() {
    const list = await this.storage.get(this.keyListKey);
    return list ? JSON.parse(list) : [];
  }
  async saveKeyList(list) {
    await this.storage.store(this.keyListKey, JSON.stringify(list));
    this.onKeyListChanged.fire();
  }
  async storeKey(entry) {
    const id = crypto.randomUUID();
    const fullEntry = {
      ...entry,
      id,
      timestamp: Date.now(),
    };
    // Store the key entry
    await this.storage.store(id, JSON.stringify(fullEntry));
    // Update key list
    const list = await this.getKeyList();
    list.push(id);
    await this.saveKeyList(list);
    return id;
  }
  async getKey(id) {
    const entry = await this.storage.get(id);
    return entry ? JSON.parse(entry) : undefined;
  }
  async getAllKeys() {
    const list = await this.getKeyList();
    const entries = await Promise.all(
      list.map(async (id) => {
        const entry = await this.getKey(id);
        return entry;
      }),
    );
    return entries.filter((entry) => entry !== undefined);
  }
  async deleteKey(id) {
    // Remove from storage
    await this.storage.delete(id);
    // Update key list
    const list = await this.getKeyList();
    const newList = list.filter((existingId) => existingId !== id);
    await this.saveKeyList(newList);
  }
  async clearAllKeys() {
    const list = await this.getKeyList();
    await Promise.all(list.map((id) => this.storage.delete(id)));
    await this.saveKeyList([]);
  }
  async searchKeys(query) {
    const allKeys = await this.getAllKeys();
    const lowerQuery = query.toLowerCase();
    return allKeys.filter(
      (entry) =>
        entry.label?.toLowerCase().includes(lowerQuery) ||
        entry.type.toLowerCase().includes(lowerQuery) ||
        (entry.metadata &&
          Object.values(entry.metadata).some((value) =>
            value.toLowerCase().includes(lowerQuery),
          )),
    );
  }
  async updateKeyLabel(id, newLabel) {
    const entry = await this.getKey(id);
    if (!entry) {
      throw new Error('Key not found');
    }
    const updatedEntry = {
      ...entry,
      label: newLabel,
    };
    await this.storage.store(id, JSON.stringify(updatedEntry));
    this.onKeyListChanged.fire();
  }
}
exports.KeyVault = KeyVault;
//# sourceMappingURL=keyVault.js.map
