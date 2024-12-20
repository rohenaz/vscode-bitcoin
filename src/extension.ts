import {
  HD,
  Mnemonic,
  PrivateKey,
  PublicKey,
  Script,
  Transaction,
  Utils,
} from '@bsv/sdk';

const { toArray, toBase58Check } = Utils;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import Shapeshifter from '@libitx/shapeshifter.js';
import fetch from 'node-fetch';
import * as vscode from 'vscode';
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "bitcoin" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const disposables = [];

  disposables.push(
    vscode.commands.registerCommand('bitcoin.generateHDPublicKey', () => {
      const hdPrivKey = HD.fromRandom();
      const hdPubKey = hdPrivKey.toPublic();
      vscode.env.clipboard.writeText(hdPubKey.toString());
      vscode.window.showInformationMessage(`Copied! ${hdPubKey.toString()}`);
    })
  );

  disposables.push(
    vscode.commands.registerCommand('bitcoin.generateHDPrivateKey', () => {
      const hdPrivKey = HD.fromRandom();
      vscode.env.clipboard.writeText(hdPrivKey.toString());
      vscode.window.showInformationMessage(`Copied! ${hdPrivKey.toString()}`);
    })
  );

  disposables.push(
    vscode.commands.registerCommand('bitcoin.xPubFromxPriv', async () => {
      const xPriv = await vscode.window.showInputBox({
        value: '',
        placeHolder: 'Ex: xprv9s21ZrQH143K...',
        validateInput: (text) => {
          return text.length !== 111 ? 'Invalid private key!' : null;
        },
      });

      if (xPriv) {
        try {
          const hdPrivKey = HD.fromString(xPriv);
          const hdPubKey = hdPrivKey.toPublic();
          vscode.env.clipboard.writeText(hdPubKey.toString());
          vscode.window.showInformationMessage(
            `Copied! ${hdPubKey.toString()}`
          );
        } catch (e) {
          console.error(e);
        }
      }
    })
  );

  disposables.push(
    vscode.commands.registerCommand(
      'bitcoin.addressFromHDPublicKey',
      async () => {
        const xPub = await vscode.window.showInputBox({
          value: '',
          placeHolder: 'Ex: xpub661MyMwAqRbcGa7...',
          validateInput: (text) => {
            return text.length !== 111 ? 'Invalid extended public key!' : null;
          },
        });

        const path = await vscode.window.showInputBox({
          value: 'm/0/0',
          placeHolder: 'Ex: m/0/0',
          validateInput: (_text) => {
            return null;
          },
        });

        if (xPub && path) {
          try {
            const hdPubKey = HD.fromString(xPub);
            const derivedPubKey = hdPubKey.derive(path);

            const address = derivedPubKey.pubKey.toAddress();
            vscode.env.clipboard.writeText(address);
            vscode.window.showInformationMessage(`Copied! ${address}`);
          } catch (e) {
            console.error(e);
          }
        }
      }
    )
  );

  disposables.push(
    vscode.commands.registerCommand('bitcoin.generatePublicKey', () => {
      const privKey = PrivateKey.fromRandom();
      const publicKey = privKey.toPublicKey();
      vscode.env.clipboard.writeText(publicKey.toString());
      vscode.window.showInformationMessage(`Copied! ${publicKey.toString()}`);
    })
  );

  disposables.push(
    vscode.commands.registerCommand('bitcoin.generatePrivateKey', () => {
      try {
        const privKey = PrivateKey.fromRandom();
        vscode.env.clipboard.writeText(privKey.toString());
        vscode.window.showInformationMessage(`Copied! ${privKey.toString()}`);
      } catch (e) {
        console.error(e);
      }
    })
  );

  disposables.push(
    vscode.commands.registerCommand('bitcoin.generateWIF', () => {
      try {
        const privKey = PrivateKey.fromRandom();
        vscode.env.clipboard.writeText(privKey.toWif());
        vscode.window.showInformationMessage(`Copied! ${privKey.toWif()}`);
      } catch (e) {
        console.error(e);
      }
    })
  );

  disposables.push(
    vscode.commands.registerCommand('bitcoin.generateMnemonic', () => {
      try {
        const mnemonic = Mnemonic.fromRandom();
        vscode.env.clipboard.writeText(mnemonic.toString());
        vscode.window.showInformationMessage(`Copied! ${mnemonic.toString()}`);
      } catch (e) {
        console.error(e);
      }
    })
  );

  disposables.push(
    vscode.commands.registerCommand(
      'bitcoin.extendedPrivateKeyFromMnemonic',
      async () => {
        const mnemonicStr = await vscode.window.showInputBox({
          value: '',
          placeHolder:
            'Ex: solid drastic bone type leopard law virtual share agree way bacon noise',
          validateInput: (text) => {
            return text.split(' ').length !== 12 ? 'Invalid mnemonic!' : null;
          },
        });

        if (mnemonicStr) {
          try {
            const mnemonic = Mnemonic.fromString(mnemonicStr);
            const hdPrivKey = HD.fromSeed(mnemonic.toSeed());
            vscode.env.clipboard.writeText(hdPrivKey.toString());
            vscode.window.showInformationMessage(
              `Copied! ${hdPrivKey.toString()}`
            );
          } catch (e) {
            console.error(e);
          }
        }
      }
    )
  );

  disposables.push(
    vscode.commands.registerCommand('bitcoin.decodeRawTx', async () => {
      const rawTxHex = await vscode.window.showInputBox({
        value: '',
        placeHolder: 'paste raw tx hex',
        validateInput: (_text) => {
          return null;
        },
      });

      if (rawTxHex) {
        try {
          const tx = Transaction.fromHex(rawTxHex);
          const txObj = {
            version: tx.version,
            inputs: tx.inputs.map((input) => ({
              prevTxId: input.sourceTXID?.toString() || '',
              outputIndex: input.sourceOutputIndex,
              script: input.unlockingScript
                ? input.unlockingScript.toString()
                : '',
              sequence: input.sequence,
            })),
            outputs: tx.outputs.map((output) => ({
              satoshis: output.satoshis,
              script: output.lockingScript.toString(),
            })),
            lockTime: tx.lockTime,
          };
          const txt = JSON.stringify(txObj, null, 2);

          vscode.workspace
            .openTextDocument({
              language: 'text',
              content: txt,
            })
            .then((doc) => {
              vscode.window.showTextDocument(doc, {
                preview: false,
                preserveFocus: true,
              });
            });
        } catch (e) {
          console.error(e);
        }
      }
    })
  );

  disposables.push(
    vscode.commands.registerCommand('bitcoin.asmFromScript', async () => {
      const scriptHex = await vscode.window.showInputBox({
        value: '',
        placeHolder: 'Ex: 006a0c74657374206d657373616765...',
        validateInput: (_text) => {
          return null;
        },
      });

      if (scriptHex) {
        try {
          const script = Script.fromHex(scriptHex);
          const asmString = script.toASM();
          vscode.env.clipboard.writeText(asmString);
          vscode.window.showInformationMessage(`Copied! ${asmString}`);
        } catch (e) {
          console.error(e);
        }
      }
    })
  );

  disposables.push(
    vscode.commands.registerCommand(
      'bitcoin.addressFromPublicKey',
      async () => {
        const publicKeyStr = await vscode.window.showInputBox({
          value: '',
          placeHolder:
            'Ex: 032247aaf890576e9ec2d301f2fca91119561d2d8810f983873441383e6fd51238',
          validateInput: (text) => {
            try {
              PublicKey.fromString(text);
              return null;
            } catch {
              return 'Invalid public key!';
            }
          },
        });

        if (publicKeyStr) {
          try {
            const pubKey = PublicKey.fromString(publicKeyStr);
            const address = toBase58Check(toArray(pubKey.toDER()));
            vscode.env.clipboard.writeText(address.toString());
            vscode.window.showInformationMessage(`Copied! ${address}`);
          } catch (e) {
            console.error(e);
          }
        }
      }
    )
  );

  disposables.push(
    vscode.commands.registerCommand('bitcoin.getTx', async () => {
      const txId = await vscode.window.showInputBox({
        value: '',
        placeHolder:
          'Ex: bdda96e3b09723135ecbe02e625b49cd5c4e273e3752710941f8598ecc4d9bfe',
        validateInput: (text) => {
          return text.length === 64 ? null : 'Invalid Tx ID!';
        },
      });

      const mode = await vscode.window.showInputBox({
        value: 'bmap',
        placeHolder: 'raw | bob | bmap | json ',
        validateInput: (text) => {
          return text === 'raw' ||
            text === 'bob' ||
            text === 'bmap' ||
            text === 'json'
            ? null
            : 'Invalid mode!';
        },
      });

      try {
        const res = await fetch(`https://bmapjs.com/tx/${txId}/${mode}`);

        let txt = '';

        switch (mode) {
          case 'bob':
          case 'json':
          case 'bmap': {
            const json = await res.json();
            txt = JSON.stringify(json, null, 2);
            break;
          }
          case 'raw':
            txt = await res.text();
            break;
        }
        vscode.workspace
          .openTextDocument({
            language: 'text',
            content: txt,
          })
          .then((doc) => {
            vscode.window.showTextDocument(doc, {
              preview: false,
              preserveFocus: true,
            });
          });
      } catch (e) {
        console.error(e);
      }
    })
  );

  disposables.push(
    vscode.commands.registerCommand('bitcoin.getUtxosForAddress', async () => {
      const address = await vscode.window.showInputBox({
        value: '',
        placeHolder: 'Ex: 1DZFfpLerFc2GWA1UncMoQ4oCkWkWJdHVH',
        validateInput: (text) => {
          // ToDo: Validate address
          console.log('text', text);
          return null;
        },
      });

      try {
        // https://api.whatsonchain.com/v1/bsv/<network>/address/<address>/unspent
        const res = await fetch(
          `https://api.whatsonchain.com/v1/bsv/main/address/${address}/unspent`
        );

        let txt = '';
        const json = await res.json();

        // This one opens a document in a new tab as an untitled editable doc
        txt = JSON.stringify(json, null, 2);

        vscode.workspace
          .openTextDocument({
            language: 'text',
            content: txt,
          })
          .then((doc) => {
            vscode.window.showTextDocument(doc, {
              preview: false,
              preserveFocus: true,
            });
          });
      } catch (e) {
        console.error(e);
      }
    })
  );

  disposables.push(
    vscode.commands.registerCommand(
      'bitcoin.addressFromPrivateKey',
      async () => {
        const privateKeyStr = await vscode.window.showInputBox({
          value: '',
          placeHolder:
            'Ex: 02f529d7e796072e0ccc9291e47fecfc9c489da39d75bdf1b342703cfa0e88b0c2',
          validateInput: (text) => {
            try {
              PrivateKey.fromHex(text);
              return null;
            } catch {
              return 'Invalid private key!';
            }
          },
        });

        if (privateKeyStr) {
          try {
            const privKey = PrivateKey.fromHex(privateKeyStr);
            const address = privKey.toAddress();
            vscode.window.showInformationMessage(`Copied! ${address}`);
          } catch (e) {
            console.error(e);
          }
        }
      }
    )
  );

  disposables.push(
    vscode.commands.registerCommand('bitcoin.addressFromWIF', async () => {
      const privateKey = await vscode.window.showInputBox({
        value: '',
        placeHolder: 'Ex: KyY7i4s63fiRGe2TDEMusXLHkRBQdRmTxVwu63daEf5WujJwmcaS',
        validateInput: (text) => {
          try {
            PrivateKey.fromWif(text);
            return null;
          } catch {
            return 'Invalid private key!';
          }
        },
      });

      if (privateKey) {
        try {
          const privKey = PrivateKey.fromWif(privateKey);
          const address = privKey.toAddress();
          vscode.env.clipboard.writeText(address);
          vscode.window.showInformationMessage(`Copied! ${address}`);
        } catch (e) {
          console.error(e);
        }
      }
    })
  );

  disposables.push(
    vscode.commands.registerCommand('bitcoin.rawTxToTxo', async () => {
      const rawTxHex = await vscode.window.showInputBox({
        value: '',
        placeHolder: 'paste raw tx hex',
        validateInput: (_text) => {
          // TODO: Validation
          return null;
        },
      });

      if (rawTxHex) {
        try {
          const obj = Shapeshifter.toTxo(rawTxHex);
          const txt = JSON.stringify(obj, null, 2);

          vscode.workspace
            .openTextDocument({
              language: 'text',
              content: txt,
            })
            .then((doc) => {
              vscode.window.showTextDocument(doc, {
                preview: false,
                preserveFocus: true,
              });
            });
        } catch (e) {
          console.error(e);
        }
      }
    })
  );

  disposables.push(
    vscode.commands.registerCommand('bitcoin.rawTxToBob', async () => {
      const rawTxHex = await vscode.window.showInputBox({
        value: '',
        placeHolder: 'paste raw tx hex',
        validateInput: (_text) => {
          // TODO: Validation
          return null;
        },
      });

      if (rawTxHex) {
        try {
          const obj = Shapeshifter.toBob(rawTxHex);
          const txt = JSON.stringify(obj, null, 2);

          vscode.workspace
            .openTextDocument({
              language: 'text',
              content: txt,
            })
            .then((doc) => {
              vscode.window.showTextDocument(doc, {
                preview: false,
                preserveFocus: true,
              });
            });
        } catch (e) {
          console.error(e);
        }
      }
    })
  );

  disposables.push(
    vscode.commands.registerCommand(
      'bitcoin.publicKeyFromPrivateKey',
      async () => {
        const privateKey = await vscode.window.showInputBox({
          value: '',
          placeHolder:
            'Ex: 02f529d7e796072e0ccc9291e47fecfc9c489da39d75bdf1b342703cfa0e88b0c2',
          validateInput: (text) => {
            try {
              PrivateKey.fromHex(text);
              return null;
            } catch {
              return 'Invalid private key!';
            }
          },
        });

        if (privateKey) {
          try {
            const privKey = PrivateKey.fromHex(privateKey);
            const pubKey = privKey.toPublicKey();
            vscode.env.clipboard.writeText(pubKey.toString());
            vscode.window.showInformationMessage(
              `Copied! ${pubKey.toString()}`
            );
          } catch (e) {
            console.error(e);
          }
        }
      }
    )
  );

  context.subscriptions.concat(disposables);
}

// this method is called when your extension is deactivated
export function deactivate() {}
