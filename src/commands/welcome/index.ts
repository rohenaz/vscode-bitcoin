import vsApi from '../../vsShim';
import type { ExtensionContext } from '../../vsShim';

export async function resetWelcomeScreen(context: ExtensionContext): Promise<void> {
  await context.globalState.update('bitcoin.hasShownWelcome', false);
  vsApi.window.showInformationMessage(
    'Welcome screen has been reset. Please reload VS Code to see it.',
  );
}
