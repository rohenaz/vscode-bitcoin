import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmdirSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import { join } from 'node:path';
import vscode from '../../../setup';
import { WorkspaceManager } from '../../workspace';

const TEST_WORKSPACE_DIR = '.test-bitcoin-workspace';
const TEST_BITCOIN_DIR = join(TEST_WORKSPACE_DIR, '.bitcoin');

// Helper function to recursively delete a directory
function deleteFolderRecursive(path: string) {
  if (existsSync(path)) {
    for (const file of readdirSync(path)) {
      const curPath = join(path, file);
      if (statSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        unlinkSync(curPath);
      }
    }
    rmdirSync(path);
  }
}

// Helper function to clean up test workspace
function cleanupTestWorkspace() {
  try {
    deleteFolderRecursive(TEST_WORKSPACE_DIR);
  } catch (error) {
    console.error('Error cleaning up test workspace:', error);
  }
}

describe('Workspace Manager Tests', () => {
  beforeEach(() => {
    // Create test workspace directory
    if (!existsSync(TEST_WORKSPACE_DIR)) {
      mkdirSync(TEST_WORKSPACE_DIR);
    }

    // Update workspace path in VS Code mock
    vscode.workspace.workspaceFolders = [
      {
        uri: { fsPath: TEST_WORKSPACE_DIR },
        name: 'test',
        index: 0,
      },
    ];
  });

  afterEach(() => {
    cleanupTestWorkspace();
  });

  test('saveFile', async () => {
    const workspaceManager = new WorkspaceManager(TEST_BITCOIN_DIR);
    const content = 'test content';
    const type = 'text/plain';
    const name = 'test';

    const uri = await workspaceManager.saveFile(content, type, name);
    expect(uri).toBeDefined();
    expect(uri.fsPath).toContain(TEST_BITCOIN_DIR);
    expect(uri.fsPath).toContain('text/plain');
    expect(uri.fsPath).toMatch(/test_\d+$/);
  });
});
