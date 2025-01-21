// vscode.d.ts (or any name you like)

// First, define the minimal interface returned by acquireVsCodeApi.
interface VsCodeApi {
  postMessage(message: unknown): void;
  setState(newState: unknown): unknown;
  getState(): unknown;
}

// Now augment the global Window type to include the function.
declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeApi;
  }
}

// Don’t forget this line so the file is treated as a module.
export {};