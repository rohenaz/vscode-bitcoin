import vsApi from '../../vsShim';
import type { OutputManager } from '../../output';
import { convertData, detectFormat, type DataFormat } from '../../utils';

export async function handleConvertDataCommand(): Promise<{ data: string; type: string; name?: string } | undefined> {
  console.log('Starting data conversion command...');
  
  const input = await vsApi.window.showInputBox({
    placeHolder: 'Enter data to convert (hex, base64, or binary array)',
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
    throw new Error('Unable to detect input format. Please ensure input is valid hex, base64, or binary array.');
  }

  const formats = ['hex', 'base64', 'binary'];
  console.log('Showing format picker...');
  const targetFormat = await vsApi.window.showQuickPick(
    formats.filter((f) => f !== inputFormat),
    {
      placeHolder: `Convert from ${inputFormat} to:`,
    },
  ) as DataFormat;

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