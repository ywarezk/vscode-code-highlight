import * as vscode from 'vscode';

export class LectureFileDecorationProvider implements vscode.FileDecorationProvider {
  private _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[]>();
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  private highlightedFileUri: vscode.Uri | undefined = undefined;

  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    // Check if this is the file we want to highlight
    if (this.highlightedFileUri && uri.toString() === this.highlightedFileUri.toString()) {
      return {
        color: new vscode.ThemeColor('charts.blue'), // Use blue color to match the code highlight
        tooltip: 'Currently highlighted in lecture',
      };
    }
    return undefined;
  }

  // Set the file to highlight
  setHighlightedFile(uri: vscode.Uri | undefined): void {
    const previousUri = this.highlightedFileUri;
    this.highlightedFileUri = uri;

    // Refresh decorations for both the previous and new file
    const urisToRefresh: vscode.Uri[] = [];
    if (previousUri) {
      urisToRefresh.push(previousUri);
    }
    if (uri) {
      urisToRefresh.push(uri);
    }

    if (urisToRefresh.length > 0) {
      this._onDidChangeFileDecorations.fire(urisToRefresh);
    }
  }

  // Clear the highlight
  clearHighlight(): void {
    if (this.highlightedFileUri) {
      const uriToRefresh = this.highlightedFileUri;
      this.highlightedFileUri = undefined;
      this._onDidChangeFileDecorations.fire(uriToRefresh);
    }
  }
}
