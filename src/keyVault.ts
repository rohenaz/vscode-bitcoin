import * as crypto from 'node:crypto';
import * as vscode from 'vscode';

export type KeyType =
  | 'private'
  | 'public'
  | 'wif'
  | 'hdprivate'
  | 'hdpublic'
  | 'mnemonic'
  | 'encryption';

export interface KeyEntry {
  id: string;
  type: KeyType;
  label?: string;
  value: string;
  timestamp: number;
  metadata?: Record<string, string>;
}

export class KeyVault {
  private storage: vscode.SecretStorage;
  private keyListKey = 'bitcoin.keyList';
  private onKeyListChanged: vscode.EventEmitter<void>;

  constructor(context: vscode.ExtensionContext) {
    this.storage = context.secrets;
    this.onKeyListChanged = new vscode.EventEmitter<void>();
  }

  get onDidChangeKeys(): vscode.Event<void> {
    return this.onKeyListChanged.event;
  }

  private async getKeyList(): Promise<string[]> {
    const list = await this.storage.get(this.keyListKey);
    return list ? JSON.parse(list) : [];
  }

  private async saveKeyList(list: string[]): Promise<void> {
    await this.storage.store(this.keyListKey, JSON.stringify(list));
    this.onKeyListChanged.fire();
  }

  async storeKey(entry: Omit<KeyEntry, 'id' | 'timestamp'>): Promise<string> {
    const id = crypto.randomUUID();
    const fullEntry: KeyEntry = {
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

  async getKey(id: string): Promise<KeyEntry | undefined> {
    const entry = await this.storage.get(id);
    return entry ? JSON.parse(entry) : undefined;
  }

  async getAllKeys(): Promise<KeyEntry[]> {
    const list = await this.getKeyList();
    const entries = await Promise.all(
      list.map(async (id) => {
        const entry = await this.getKey(id);
        return entry;
      }),
    );
    return entries.filter((entry): entry is KeyEntry => entry !== undefined);
  }

  async deleteKey(id: string): Promise<void> {
    // Remove from storage
    await this.storage.delete(id);

    // Update key list
    const list = await this.getKeyList();
    const newList = list.filter((existingId) => existingId !== id);
    await this.saveKeyList(newList);
  }

  async clearAllKeys(): Promise<void> {
    const list = await this.getKeyList();
    await Promise.all(list.map((id) => this.storage.delete(id)));
    await this.saveKeyList([]);
  }

  async searchKeys(query: string): Promise<KeyEntry[]> {
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

  async updateKeyLabel(id: string, newLabel: string): Promise<void> {
    const entry = await this.getKey(id);
    if (!entry) {
      throw new Error('Key not found');
    }

    const updatedEntry: KeyEntry = {
      ...entry,
      label: newLabel,
    };

    await this.storage.store(id, JSON.stringify(updatedEntry));
    this.onKeyListChanged.fire();
  }
}
