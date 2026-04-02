interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState<T>(state: T): T;
}

declare function acquireVsCodeApi(): VsCodeApi;

class VSCodeAPIWrapper {
  private readonly vsCodeApi: VsCodeApi | undefined;

  constructor() {
    if (typeof acquireVsCodeApi === "function") {
      this.vsCodeApi = acquireVsCodeApi();
    }
  }

  postMessage(message: unknown): void {
    if (this.vsCodeApi) {
      this.vsCodeApi.postMessage(message);
    } else {
      console.log("[dev] postMessage:", message);
    }
  }

  getState(): unknown {
    return this.vsCodeApi?.getState();
  }

  setState<T>(state: T): T {
    if (this.vsCodeApi) {
      return this.vsCodeApi.setState(state);
    }
    return state;
  }
}

export const vscode = new VSCodeAPIWrapper();
