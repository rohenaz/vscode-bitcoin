import type { OutputManager } from '../../output';
import { type DataFormat, convertData, detectFormat } from '../../utils';
import vsApi from '../../vsShim';

export async function handleConvertDataCommand(
  initialInput?: string
): Promise<{ data: string; type: string; name?: string } | undefined> {
  console.log('Starting data conversion command...');

  const input = initialInput ?? await vsApi.window.showInputBox({
    prompt: 'Enter data to convert (hex, base64, or binary array)',
    placeHolder: 'e.g. 48656c6c6f or SGVsbG8= or [72,101,108,108,111]',
    validateInput: (text) => {
      return text.length === 0 ? 'Input cannot be empty' : null;
    },
  });

  console.log('Got input:', input ? `${input.slice(0, 100)}...` : 'undefined');

  if (!input) {
    console.log('No input provided, returning');
    return undefined;
  }

  console.log('Detecting input format...');
  const inputFormat = detectFormat(input);
  console.log('Detected format:', inputFormat);

  if (!inputFormat) {
    console.log('Failed to detect format');
    throw new Error(
      'Unable to detect input format. Please ensure input is valid hex, base64, or binary array.',
    );
  }

  const formats = ['hex', 'base64', 'binary'];
  console.log('Showing format picker...');
  const targetFormat = (await vsApi.window.showQuickPick(
    formats.filter((f) => f !== inputFormat),
    {
      placeHolder: `Convert from ${inputFormat} to:`,
    },
  )) as DataFormat;

  console.log('Selected target format:', targetFormat);

  if (!targetFormat) {
    console.log('No target format selected, returning');
    return undefined;
  }

  console.log('Converting data...');
  const result = convertData(input, inputFormat, targetFormat);
  console.log('Conversion complete');

  return {
    data: `Original (${inputFormat}):\n${input}\n\nConverted (${targetFormat}):\n${result}`,
    type: 'conversions',
    name: `${inputFormat}_to_${targetFormat}`,
  };
}

// Re-export the sync version for use in tests and other places
export { convertData } from '../../utils';
