import { resolve } from 'node:path';
import { glob } from 'glob';

export async function run(): Promise<void> {
  const testsRoot = resolve(__dirname, '..');

  try {
    const files = await glob('**/**.test.{js,ts}', {
      cwd: testsRoot,
    });

    // Import and run all test files
    for (const file of files) {
      await import(resolve(testsRoot, file));
    }
  } catch (err) {
    console.error('Error loading test files:', err);
    throw err;
  }
}
