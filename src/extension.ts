// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import Shapeshifter from "@libitx/shapeshifter.js";
import * as bsv from "bsv";
import fetch from "node-fetch";
import * as vscode from "vscode";
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "bitcoin" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposables = [];

  disposables.push(
    vscode.commands.registerCommand("bitcoin.generateHDPublicKey", () => {
      let bip32 = bsv.Bip32.fromRandom();
      let publicKey = bip32.toPublic();
      // The code you place here will be executed every time your command is executed
      vscode.env.clipboard.writeText(publicKey.toString());
      // Display a message box to the user
      vscode.window.showInformationMessage("Copied! " + publicKey.toString());
    })
  );

  disposables.push(
    vscode.commands.registerCommand("bitcoin.generateHDPrivateKey", () => {
      let bip32 = bsv.Bip32.fromRandom();

      // The code you place here will be executed every time your command is executed
      vscode.env.clipboard.writeText(bip32.toString());
      // Display a message box to the user
      vscode.window.showInformationMessage("Copied! " + bip32.toString());
    })
  );

  disposables.push(
    vscode.commands.registerCommand("bitcoin.xPubFromxPriv", async () => {
      const xPriv = await vscode.window.showInputBox({
        value: "",
        placeHolder:
          "Ex: xprv9s21ZrQH143K462rbNqftyGUvz4U1AnqQyWogzrw1GyWaDQT3aNbE5nA6ZXHwk3PpKFK1nVguAGeP6PSTDgXcqab7UBgGHGrfEyV1s9RkeH",
        validateInput: (text) => {
          return text.length !== 111 ? "Invalid public key!" : null;
        },
      });

      if (xPriv) {
        try {
          let xPrivKey = bsv.Bip32.fromString(xPriv);
          let xPubKey = xPrivKey.toPublic();
          vscode.env.clipboard.writeText(xPubKey.toString());
          // Display a message box to the user
          vscode.window.showInformationMessage("Copied! " + xPubKey.toString());
        } catch (e) {
          console.error(e);
        }
      }
    })
  );

  disposables.push(
    vscode.commands.registerCommand(
      "bitcoin.addressFromHDPublicKey",
      async () => {
        const xPub = await vscode.window.showInputBox({
          value: "",
          placeHolder:
            "Ex: xpub661MyMwAqRbcGa7KhQNgG7DDV1txQdWgnCSQVPGYZcWVT1jbb7gqmt6dwrfjfqcNP4tsCoh2Hc4waN1xbiNDKQ9AdRxNvQ6tcsQb6oAeTJM",
          validateInput: (text) => {
            return text.length !== 111 ? "Invalid extended public key!" : null;
          },
        });

        const path = await vscode.window.showInputBox({
          value: "m/0/0",
          placeHolder: "Ex: m/0/0",
          validateInput: (text) => {
            // ToDo - validate path
            return null;
          },
        });

        if (xPub && path) {
          try {
            let xPubKey = bsv.Bip32.fromString(xPub);
            let address = bsv.Address.fromPubKey(xPubKey.derive(path).pubKey);
            vscode.env.clipboard.writeText(address.toString());
            // Display a message box to the user
            vscode.window.showInformationMessage("Copied! " + address);
          } catch (e) {
            console.error(e);
          }
        }
      }
    )
  );

  disposables.push(
    vscode.commands.registerCommand(
      "bitcoin.addressFromHDPrivateKey",
      async () => {
        const xPriv = await vscode.window.showInputBox({
          value: "",
          placeHolder:
            "Ex: xprv9s21ZrQH143K462rbNqftyGUvz4U1AnqQyWogzrw1GyWaDQT3aNbE5nA6ZXHwk3PpKFK1nVguAGeP6PSTDgXcqab7UBgGHGrfEyV1s9RkeH",
          validateInput: (text) => {
            return text.length !== 111 ? "Invalid public key!" : null;
          },
        });

        const path = await vscode.window.showInputBox({
          value: "m/0/0",
          placeHolder: "Ex: m/0/0",
          validateInput: (text) => {
            // ToDo - validate path
            return null;
          },
        });

        if (xPriv && path) {
          try {
            let xPrivKey = bsv.Bip32.fromString(xPriv);
            let address = bsv.Address.fromPubKey(xPrivKey.derive(path).pubKey);
            vscode.env.clipboard.writeText(address.toString());

            // Display a message box to the user
            vscode.window.showInformationMessage("Copied! " + address);
          } catch (e) {
            console.error(e);
          }
        }
      }
    )
  );

  disposables.push(
    vscode.commands.registerCommand("bitcoin.generatePublicKey", () => {
      let privKey = bsv.PrivKey.fromRandom();
      let publicKey = bsv.PubKey.fromPrivKey(privKey);
      // The code you place here will be executed every time your command is executed
      vscode.env.clipboard.writeText(publicKey.toString());
      // Display a message box to the user
      vscode.window.showInformationMessage("Copied! " + publicKey.toString());
    })
  );

  disposables.push(
    vscode.commands.registerCommand("bitcoin.generatePrivateKey", () => {
      // The code you place here will be executed every time your command is executed

      try {
        let privKey = bsv.PrivKey.fromRandom();
        vscode.env.clipboard.writeText(privKey.toHex());
        // Display a message box to the user
        vscode.window.showInformationMessage("Copied! " + privKey.toHex());
      } catch (e) {
        console.error(e);
      }
    })
  );

  disposables.push(
    vscode.commands.registerCommand("bitcoin.generateWIF", () => {
      // The code you place here will be executed every time your command is executed

      try {
        let privKey = bsv.PrivKey.fromRandom();
        vscode.env.clipboard.writeText(privKey.toString());
        // Display a message box to the user
        vscode.window.showInformationMessage("Copied! " + privKey.toString());
      } catch (e) {
        console.error(e);
      }
    })
  );

  disposables.push(
    vscode.commands.registerCommand("bitcoin.generateMnemonic", () => {
      // The code you place here will be executed every time your command is executed

      try {
        const mnemonic = bsv.Bip39.fromRandom().toString();
        vscode.env.clipboard.writeText(mnemonic);
        // Display a message box to the user
        vscode.window.showInformationMessage("Copied! " + mnemonic);
      } catch (e) {
        console.error(e);
      }
    })
  );

  disposables.push(
    vscode.commands.registerCommand(
      "bitcoin.extendedPrivateKeyFromMnemonic",
      async () => {
        const mnemonic = await vscode.window.showInputBox({
          value: "",
          placeHolder:
            "Ex: solid drastic bone type leopard law virtual share agree way bacon noise",
          validateInput: (text) => {
            return text.split(" ").length !== 12 ? "Invalid mnemonic!" : null;
          },
        });

        if (mnemonic) {
          try {
            let bip39 = bsv.Bip39.fromString(mnemonic);
            let xPriv = bsv.Bip32.fromSeed(bip39.toSeed());

            vscode.env.clipboard.writeText(xPriv.toString());
            // Display a message box to the user
            vscode.window.showInformationMessage("Copied! " + xPriv.toString());
          } catch (e) {
            console.error(e);
          }
        }
      }
    )
  );

  disposables.push(
    vscode.commands.registerCommand(
      "bitcoin.decodeRawTx",
      async () => {
        const rawTxHex = await vscode.window.showInputBox({
          value: "",
          placeHolder:
            "paste raw tx hex",
          validateInput: (text) => {
            // TODO: Validation
            return null;
          },
        });

        if (rawTxHex) {
          try {
            const txbuf = Buffer.from(rawTxHex, 'hex');

            let txt = "";
            let tx = bsv.Tx.fromBuffer(txbuf);
            let json = tx.toJSON();

            txt = JSON.stringify(json, null, 2);

            vscode.workspace
              .openTextDocument({
                language: "text",
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
      }
    )
  );
  
  disposables.push(
    vscode.commands.registerCommand(
      "bitcoin.asmFromScript",
      async () => {
        const scriptHex = await vscode.window.showInputBox({
          value: "",
          placeHolder:
            "Ex: 006a0c74657374206d65737361676522313550636948473232534e4c514a584d6f53556157566937575371633768436676610d424954434f494e5f45434453412131553151733836707847724e55796a37673752346d386b3879346b6d78766f756f4c5847774a696635464b72367250704b5967685a374637526d6177303071356e576f364e694a4f756a652b3657424f4d367164384d6c566e625772326d7272412b61614461744878617652384a54636b7053667831524a316f3d",
          validateInput: (text) => {
            return null; // text.length !== 66 ? "Invalid script!" : null;
          },
        });

        console.log("script hex", scriptHex);
        if (scriptHex) {
          try {
            let buff = Buffer.from(scriptHex, 'hex');
            let script  = new bsv.Script().fromBuffer(buff);
            console.log('script', script);
            let asmString = script.toAsmString();
            vscode.env.clipboard.writeText(asmString);
            // Display a message box to the user
            vscode.window.showInformationMessage("Copied! " + asmString);
          } catch (e) {
            console.error(e);
          }
        }
      }
    )
  );

  disposables.push(
    vscode.commands.registerCommand(
      "bitcoin.addressFromPublicKey",
      async () => {
        const publicKey = await vscode.window.showInputBox({
          value: "",
          placeHolder:
            "Ex: 032247aaf890576e9ec2d301f2fca91119561d2d8810f983873441383e6fd51238",
          validateInput: (text) => {
            return text.length !== 66 ? "Invalid public key!" : null;
          },
        });

        if (publicKey) {
          try {
            let pubKey = bsv.PubKey.fromString(publicKey);
            let address = bsv.Address.fromPubKey(pubKey).toString();
            vscode.env.clipboard.writeText(address);
            // Display a message box to the user
            vscode.window.showInformationMessage("Copied! " + address);
          } catch (e) {
            console.error(e);
          }
        }
      }
    )
  );

  disposables.push(
    vscode.commands.registerCommand("bitcoin.getTx", async () => {
      const txId = await vscode.window.showInputBox({
        value: "",
        placeHolder:
          "Ex: bdda96e3b09723135ecbe02e625b49cd5c4e273e3752710941f8598ecc4d9bfe",
        validateInput: (text) => {
          return text.length === 64 ? null : "Invalid Tx ID!";
        },
      });

      const mode = await vscode.window.showInputBox({
        value: "bmap",
        placeHolder: "raw | bob | bmap | json ",
        validateInput: (text) => {
          return text === "raw" ||
            text === "bob" ||
            text === "bmap" ||
            text === "json"
            ? null
            : "Invalid mode!";
        },
      });

      try {
        let res = await fetch("https://bmapjs.com/tx/" + txId + "/" + mode);

        let txt = "";

        switch (mode) {
          case "bob":
          case "json":
          case "bmap":
            let json = await res.json();

            // This one opens a document in a new tab as an untitled editable doc
            txt = JSON.stringify(json, null, 2);

            break;
          case "raw":
            txt = await res.text();
            break;
        }
        vscode.workspace
          .openTextDocument({
            language: "text",
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
    vscode.commands.registerCommand("bitcoin.getUtxosForAddress", async () => {
      const address = await vscode.window.showInputBox({
        value: "",
        placeHolder: "Ex: 1DZFfpLerFc2GWA1UncMoQ4oCkWkWJdHVH",
        validateInput: (text) => {
          // ToDo: Validate address
          return null;
        },
      });

      try {
        // https://api.whatsonchain.com/v1/bsv/<network>/address/<address>/unspent
        let res = await fetch(
          "https://api.whatsonchain.com/v1/bsv/main/address/" +
            address +
            "/unspent"
        );

        let txt = "";
        let json = await res.json();

        // This one opens a document in a new tab as an untitled editable doc
        txt = JSON.stringify(json, null, 2);

        vscode.workspace
          .openTextDocument({
            language: "text",
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
      "bitcoin.addressFromPrivateKey",
      async () => {
        const privateKey = await vscode.window.showInputBox({
          value: "",
          placeHolder:
            "Ex: 02f529d7e796072e0ccc9291e47fecfc9c489da39d75bdf1b342703cfa0e88b0c2",
          validateInput: (text) => {
            return bsv.PrivKey.fromHex(text).validate().toHex() === text
              ? null
              : "Invalid private key!";
          },
        });

        if (privateKey) {
          try {
            let pk = bsv.PrivKey.fromHex(privateKey);
            let pubKey = bsv.PubKey.fromPrivKey(pk);
            let address = bsv.Address.fromPubKey(pubKey).toString();
            vscode.env.clipboard.writeText(address);
            // Display a message box to the user
            vscode.window.showInformationMessage("Copied! " + address);
          } catch (e) {
            console.error(e);
          }
        }
      }
    )
  );

  disposables.push(
    vscode.commands.registerCommand("bitcoin.addressFromWIF", async () => {
      const privateKey = await vscode.window.showInputBox({
        value: "",
        placeHolder: "Ex: KyY7i4s63fiRGe2TDEMusXLHkRBQdRmTxVwu63daEf5WujJwmcaS",
        validateInput: (text) => {
          return bsv.PrivKey.fromString(text).validate().toString() === text
            ? null
            : "Invalid private key!";
        },
      });

      if (privateKey) {
        try {
          let pk = bsv.PrivKey.fromString(privateKey);
          let pubKey = bsv.PubKey.fromPrivKey(pk);
          let address = bsv.Address.fromPubKey(pubKey).toString();
          vscode.env.clipboard.writeText(address);
          // Display a message box to the user
          vscode.window.showInformationMessage("Copied! " + address);
        } catch (e) {
          console.error(e);
        }
      }
    })
  );
  
  disposables.push(
    vscode.commands.registerCommand(
      "bitcoin.rawTxToTxo",
      async () => {
        const rawTxHex = await vscode.window.showInputBox({
          value: "",
          placeHolder:
            "paste raw tx hex",
          validateInput: (text) => {
            // TODO: Validation
            return null;
          },
        });

        if (rawTxHex) {


          try { 
            let obj = Shapeshifter.toTxo(rawTxHex);
            // const txbuf = Buffer.from(rawTxHex, 'hex');

            // let txt = "";
            // let tx = bsv.Tx.fromBuffer(txbuf);
            // let json = tx.toJSON();

            let txt = JSON.stringify(obj, null, 2);

            vscode.workspace
              .openTextDocument({
                language: "text",
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
      }
    )
  );
  
  disposables.push(
    vscode.commands.registerCommand(
      "bitcoin.rawTxToBob",
      async () => {
        const rawTxHex = await vscode.window.showInputBox({
          value: "",
          placeHolder:
            "paste raw tx hex",
          validateInput: (text) => {
            // TODO: Validation
            return null;
          },
        });

        if (rawTxHex) {
          try { 
            let obj = Shapeshifter.toBob(rawTxHex);
            // const txbuf = Buffer.from(rawTxHex, 'hex');

            // let txt = "";
            // let tx = bsv.Tx.fromBuffer(txbuf);
            // let json = tx.toJSON();

            let txt = JSON.stringify(obj, null, 2);

            vscode.workspace
              .openTextDocument({
                language: "text",
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
      }
    )
  );

  disposables.push(
    vscode.commands.registerCommand(
      "bitcoin.publicKeyFromPrivateKey",
      async () => {
        const privateKey = await vscode.window.showInputBox({
          value: "",
          placeHolder:
            "Ex: 02f529d7e796072e0ccc9291e47fecfc9c489da39d75bdf1b342703cfa0e88b0c2",
          validateInput: (text) => {
            return bsv.PrivKey.fromHex(text).validate().toHex() === text
              ? null
              : "Invalid private key!";
          },
        });

        if (privateKey) {
          // The code you place here will be executed every time your command is executed
          try {
            let pk = bsv.PrivKey.fromHex(privateKey);
            let pubKey = bsv.PubKey.fromPrivKey(pk);
            vscode.env.clipboard.writeText(pubKey.toString());
            // Display a message box to the user
            vscode.window.showInformationMessage(
              "Copied! " + pubKey.toString()
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
