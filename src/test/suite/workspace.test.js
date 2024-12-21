Object.defineProperty(exports, '__esModule', { value: true });
const bun_test_1 = require('bun:test');
const workspace_1 = require('../../workspace');
(0, bun_test_1.describe)('Workspace Manager Tests', () => {
  (0, bun_test_1.test)('saveFile', async () => {
    const workspaceManager = new workspace_1.WorkspaceManager();
    const content = 'test content';
    const type = 'text/plain';
    const name = 'test';
    const uri = await workspaceManager.saveFile(content, type, name);
    (0, bun_test_1.expect)(uri).toBeDefined();
    (0, bun_test_1.expect)(uri.fsPath).toContain('.bitcoin');
    (0, bun_test_1.expect)(uri.fsPath).toContain('text/plain');
    (0, bun_test_1.expect)(uri.fsPath).toMatch(/test_\d+$/);
  });
});
//# sourceMappingURL=workspace.test.js.map
