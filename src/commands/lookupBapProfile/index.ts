import { BapPanel } from '../../bapPanel';
import { BapService } from '../../bapService';
import type { OutputManager } from '../../output';
import vsApi from '../../vsShim';

export async function handleLookupBapProfileCommand(
  outputManager: OutputManager,
) {
  const bapService = new BapService();

  // Prompt for BAP ID
  const idKey = await vsApi.window.showInputBox({
    prompt: 'Enter BAP ID',
    placeHolder: 'e.g. Go8vCHAa4S6AhXKTABGpANiz35J',
    validateInput: (text) => {
      if (!text) return 'BAP ID cannot be empty';
      // Basic BAP ID validation - should be base58 string
      if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(text)) {
        return 'Invalid BAP ID format';
      }
      return null;
    },
  });

  if (!idKey) {
    return undefined;
  }

  try {
    // Show progress indicator
    const profile = await vsApi.window.withProgress(
      {
        location: vsApi.ProgressLocation.Notification,
        title: 'Looking up BAP profile...',
        cancellable: false,
      },
      () => bapService.getProfile(idKey),
    );

    // Show profile in webview
    BapPanel.show(profile);

    // Return profile data for saving/copying
    return {
      data: JSON.stringify(profile, null, 2),
      type: 'bap',
      name: `profile_${idKey}`,
    };
  } catch (error) {
    console.error('BAP profile lookup error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to lookup BAP profile: ${errorMessage}`);
  }
}
