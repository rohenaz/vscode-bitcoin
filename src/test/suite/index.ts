import { resolve } from 'node:path';
import { promisify } from 'node:util';
import globCb from 'glob';
import Mocha from 'mocha';

const glob = promisify(globCb);

export async function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'bdd',
    color: true,
    timeout: 10000,
  });

  const testsRoot = resolve(__dirname, '..');

  try {
    const files = (await glob('**/**.test.{js,ts}', {
      cwd: testsRoot,
    })) as string[];

    // Add files to the test suite
    for (const file of files) {
      mocha.addFile(resolve(testsRoot, file));
    }

    // Run the mocha test
    return new Promise((c, e) => {
      try {
        mocha.run((failures) => {
          if (failures > 0) {
            e(new Error(`${failures} tests failed.`));
          } else {
            c();
          }
        });
      } catch (err) {
        console.error('Error running tests:', err);
        e(err);
      }
    });
  } catch (err) {
    console.error('Error loading test files:', err);
    throw err;
  }
}
