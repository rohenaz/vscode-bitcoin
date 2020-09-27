// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as bsv from "bsv";
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
