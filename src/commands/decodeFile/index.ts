import type { OutputManager } from '../../output';
import vsApi from '../../vsShim';
import { convertData, detectFormat } from '../../utils';

function extractBase64FromDataUrl(input: string): { base64: string; mimeType?: string } {
  const dataUrlRegex = /^data:([^;,]+)?(?:;base64)?,(.+)$/;
  const match = input.match(dataUrlRegex);
  
  if (!match) {
    return { base64: input }; // Not a data URL, return as is
  }

  const [, mimeType, base64Content] = match;
  return {
    base64: base64Content,
    mimeType: mimeType,
  };
}

export async function handleDecodeFileCommand(outputManager: OutputManager): Promise<{ data: string; type: string; name?: string } | undefined> {
  const input = await vsApi.window.showInputBox({
    prompt: 'Enter encoded data to decode into a file (hex, base64, binary array, or data URL)',
    placeHolder: 'e.g. data:image/png;base64,... or /9j/4AAQSkZJRg... or 48656c6c6f',
    validateInput: (text) => {
      return text.length === 0 ? 'Input cannot be empty' : null;
    },
  });

  if (!input) {
    return undefined;
  }

  // Extract base64 and optional MIME type from input
  const { base64, mimeType } = extractBase64FromDataUrl(input);

  // Detect and validate input format
  const inputFormat = detectFormat(base64);
  if (!inputFormat) {
    throw new Error('Unable to detect input format. Please ensure input is valid hex, base64, or binary array.');
  }

  // Convert to base64 if needed and pass to output manager
  const base64Data = inputFormat === 'base64' ? base64 : convertData(base64, inputFormat, 'base64');
  await outputManager.detectAndConvert(base64Data, ...(mimeType ? [mimeType] : []));

  return undefined; // Output is handled by detectAndConvert
}
