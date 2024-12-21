import { Script } from '@bsv/sdk';
import vscode from 'vscode';
import type { OutputManager } from '../../output';

export async function asmFromScript(output: OutputManager) {
  const scriptHex = await vscode.window.showInputBox({
    value: '',
    placeHolder: 'Ex: 006a0c74657374206d657373616765...',
    validateInput: (_text) => {
      return null;
    },
  });

  if (!scriptHex) {
    return undefined;
  }

  const script = Script.fromHex(scriptHex);
  const asmString = script.toASM();

  return {
    data: asmString,
    type: 'scripts' as const,
    name: `asm_${new Date().toISOString().replace(/[:.]/g, '-')}`,
  };
}
