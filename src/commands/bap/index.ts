import vsApi from '../../vsShim';
import { BapPanel } from '../../bapPanel';
import { BapService } from '../../bapService';

export async function lookupBapProfile(): Promise<void> {
  const bapService = new BapService();

  // Prompt for BAP ID
  const idKey = await vsApi.window.showInputBox({
    prompt: 'Enter BAP ID',
    placeHolder: 'e.g. Go8vCHAa4S6AhXKTABGpANiz35J',
  });

  if (!idKey) {
    return;
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
  } catch (error) {
    vsApi.window.showErrorMessage(
      `Failed to lookup BAP profile: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
