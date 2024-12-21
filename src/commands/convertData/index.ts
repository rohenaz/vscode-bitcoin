import vsApi from '../../vsShim';
import type { OutputManager } from '../../output';
import { convertData, detectFormat, type DataFormat } from '../../utils';

export async function handleConvertDataCommand(): Promise<{ data: string; type: string; name?: string } | undefined> {
  const input = await vsApi.window.showInputBox({
    placeHolder: 'Enter data to convert (hex, base64, or binary array)',
    validateInput: (text) => {
      return text.length === 0 ? 'Input cannot be empty' : null;
    },
  });

  if (!input) {
    return undefined;
  }

  const inputFormat = detectFormat(input);
  if (!inputFormat) {
    throw new Error('Unable to detect input format. Please ensure input is valid hex, base64, or binary array.');
  }

  const formats = ['hex', 'base64', 'binary'];
  const targetFormat = await vsApi.window.showQuickPick(
    formats.filter((f) => f !== inputFormat),
    {
      placeHolder: `Convert from ${inputFormat} to:`,
    },
  ) as DataFormat;

  if (!targetFormat) {
    return undefined;
  }

  const result = convertData(input, inputFormat, targetFormat);
  return {
    data: `Original (${inputFormat}):\n${input}\n\nConverted (${targetFormat}):\n${result}`,
    type: 'conversions',
    name: `${inputFormat}_to_${targetFormat}`,
  };
}

// Re-export the sync version for use in tests and other places
export { convertData } from '../../utils';