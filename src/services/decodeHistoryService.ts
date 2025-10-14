import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface DecodeHistoryEntry {
  txid: string;
  rawTx: string;
  timestamp: number;
  size: number;
  inputCount: number;
  outputCount: number;
}

export class DecodeHistoryService {
  private historyFile: string;
  private history: DecodeHistoryEntry[] = [];
  private readonly MAX_HISTORY = 100;

  constructor(private context: vscode.ExtensionContext) {
    this.historyFile = path.join(
      context.globalStorageUri.fsPath,
      'decode-history.json'
    );
    this.loadHistory();
  }

  private async loadHistory(): Promise<void> {
    try {
      // Ensure the storage directory exists
      await fs.mkdir(path.dirname(this.historyFile), { recursive: true });

      // Try to read existing history
      const data = await fs.readFile(this.historyFile, 'utf-8');
      this.history = JSON.parse(data);
    } catch (error) {
      // If file doesn't exist or is invalid, start with empty history
      this.history = [];
    }
  }

  private async saveHistory(): Promise<void> {
    try {
      await fs.writeFile(
        this.historyFile,
        JSON.stringify(this.history, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('Failed to save decode history:', error);
    }
  }

  async addEntry(entry: Omit<DecodeHistoryEntry, 'timestamp'>): Promise<void> {
    // Remove existing entry with same txid if it exists
    this.history = this.history.filter(h => h.txid !== entry.txid);

    // Add new entry at the beginning
    this.history.unshift({
      ...entry,
      timestamp: Date.now(),
    });

    // Trim to max history size
    if (this.history.length > this.MAX_HISTORY) {
      this.history = this.history.slice(0, this.MAX_HISTORY);
    }

    await this.saveHistory();
  }

  getHistory(): DecodeHistoryEntry[] {
    return [...this.history];
  }

  async clearHistory(): Promise<void> {
    this.history = [];
    await this.saveHistory();
  }

  async removeEntry(txid: string): Promise<void> {
    this.history = this.history.filter(h => h.txid !== txid);
    await this.saveHistory();
  }
}
