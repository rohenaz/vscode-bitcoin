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
import { parse } from 'bpu-ts';
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
    vscode.commands.registerCommand('bitcoin.addressFromPublicKey', async () => {
      const pubKey = await vscode.window.showInputBox({
        value: '',
        placeHolder: 'Ex: 02...',
        validateInput: (_text) => {
          return null;
        },
      });

      if (pubKey) {
        try {
          const publicKey = PublicKey.fromString(pubKey);
          const script = Script.fromASM(`OP_DUP OP_HASH160 ${Utils.toHex(Utils.toArray(publicKey.toHash()))} OP_EQUALVERIFY OP_CHECKSIG`);
          const address = Utils.toBase58Check(Utils.toArray(script.toHex()));
          vscode.env.clipboard.writeText(address);
          vscode.window.showInformationMessage(`Copied! ${address}`);
        } catch (e) {
          console.error(e);
        }
      }
    })
  );

  disposables.push(
    vscode.commands.registerCommand('bitcoin.addressFromPrivateKey', async () => {
      const privKey = await vscode.window.showInputBox({
        value: '',
        placeHolder: 'Ex: L...',
        validateInput: (_text) => {
          return null;
        },
      });

      if (privKey) {
        try {
          const privateKey = PrivateKey.fromString(privKey);
          const publicKey = privateKey.toPublicKey();
          const script = Script.fromASM(`OP_DUP OP_HASH160 ${Utils.toHex(Utils.toArray(publicKey.toHash()))} OP_EQUALVERIFY OP_CHECKSIG`);
          const address = Utils.toBase58Check(Utils.toArray(script.toHex()));
          vscode.env.clipboard.writeText(address);
          vscode.window.showInformationMessage(`Copied! ${address}`);
        } catch (e) {
          console.error(e);
        }
      }
    })
  );

  disposables.push(
    vscode.commands.registerCommand('bitcoin.addressFromWIF', async () => {
      const wif = await vscode.window.showInputBox({
        value: '',
        placeHolder: 'Ex: L...',
        validateInput: (_text) => {
          return null;
        },
      });

      if (wif) {
        try {
          const privateKey = PrivateKey.fromWif(wif);
          const publicKey = privateKey.toPublicKey();
          const script = Script.fromASM(`OP_DUP OP_HASH160 ${Utils.toHex(Utils.toArray(publicKey.toHash()))} OP_EQUALVERIFY OP_CHECKSIG`);
          const address = Utils.toBase58Check(Utils.toArray(script.toHex()));
          vscode.env.clipboard.writeText(address);
          vscode.window.showInformationMessage(`Copied! ${address}`);
        } catch (e) {
          console.error(e);
        }
      }
    })
  );

  disposables.push(
    vscode.commands.registerCommand('bitcoin.getTx', async () => {
      const txid = await vscode.window.showInputBox({
        value: '',
        placeHolder: 'Ex: 4d03ff9062ac2e6...',
        validateInput: (_text) => {
          return null;
        },
      });

      if (txid) {
        try {
          const response = await fetch(
            `https://api.whatsonchain.com/v1/bsv/main/tx/${txid}/hex`
          );
          const rawTxHex = await response.text();
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
    vscode.commands.registerCommand('bitcoin.getUtxosForAddress', async () => {
      const address = await vscode.window.showInputBox({
        value: '',
        placeHolder: 'Ex: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        validateInput: (_text) => {
          return null;
        },
      });

      if (address) {
        try {
          const response = await fetch(
            `https://api.whatsonchain.com/v1/bsv/main/address/${address}/unspent`
          );
          const utxos = await response.json();
          const txt = JSON.stringify(utxos, null, 2);

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
    vscode.commands.registerCommand('bitcoin.rawTxToTxo', async () => {
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
    vscode.commands.registerCommand('bitcoin.rawTxToBob', async () => {
      const rawTxHex = await vscode.window.showInputBox({
        value: '',
        placeHolder: 'paste raw tx hex',
        validateInput: (_text) => {
          return null;
        },
      });

      if (rawTxHex) {
        try {
          const bob = await parse({
            tx: { r: rawTxHex },
            split: [{ token: { op: 106 }, include: 'l' }, { token: { s: '|' } }],
          });
          const txt = JSON.stringify(bob, null, 2);

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

  context.subscriptions.push(...disposables);
}

// this method is called when your extension is deactivated
export function deactivate() {}
