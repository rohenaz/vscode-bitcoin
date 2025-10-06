// Acquire VS Code API once and export it
declare function acquireVsCodeApi(): any;

let vscode: any;

export function getVscode() {
  if (!vscode) {
    vscode = acquireVsCodeApi();
  }
  return vscode;
}
