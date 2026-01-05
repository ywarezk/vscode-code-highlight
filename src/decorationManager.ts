import * as vscode from 'vscode';
import {EventEmitter} from 'events';
import {LectureFileDecorationProvider} from './fileDecorationProvider';

class DecorationManager extends EventEmitter {
  private activeDecoration: vscode.TextEditorDecorationType | undefined;
  private activeDimDecoration: vscode.TextEditorDecorationType | undefined;
  private fileDecorationProvider: LectureFileDecorationProvider | undefined = undefined;

  setFileDecorationProvider(provider: LectureFileDecorationProvider): void {
    this.fileDecorationProvider = provider;
  }

  applyDecorations(editor: vscode.TextEditor, selection: vscode.Selection) {
    // Clear any existing decorations
    this.clearDecorations();

    const document = editor.document;

    // Create decoration type with shadcn alert-like styling
    // Use isWholeLine: true to span the full width for a more unified box appearance
    this.activeDecoration = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(59, 130, 246, 0.1)', // Light blue background
      border: '1px solid rgba(59, 130, 246, 0.3)', // Blue border
      borderRadius: '4px',
      fontWeight: '700', // Make text bolder (increased from 600)
      letterSpacing: '0.5px', // Add letter spacing to make text appear larger/wider
      isWholeLine: true, // Span full width to create a more unified box appearance
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    });

    // Create a range that spans from the start of the first line to the end of the last line
    const startPos = new vscode.Position(selection.start.line, 0);
    const endLineText = document.lineAt(selection.end.line);
    const endPos = new vscode.Position(selection.end.line, endLineText.text.length);
    const fullRange = new vscode.Range(startPos, endPos);

    // Apply decoration to the full range
    editor.setDecorations(this.activeDecoration, [fullRange]);

    // Dim/blur other text by reducing opacity on other lines
    const allLines: vscode.Range[] = [];
    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i);
      // Skip the selected lines
      if (i < selection.start.line || i > selection.end.line) {
        allLines.push(line.range);
      }
    }

    // Create a dimming decoration for other lines
    this.activeDimDecoration = vscode.window.createTextEditorDecorationType({
      opacity: '0.4', // Reduce opacity to create blur-like effect
    });

    editor.setDecorations(this.activeDimDecoration, allLines);

    // Highlight the file in the explorer using FileDecorationProvider
    if (this.fileDecorationProvider) {
      this.fileDecorationProvider.setHighlightedFile(document.uri);
    }
  }

  clearDecorations() {
    if (this.activeDecoration) {
      this.activeDecoration.dispose();
      this.activeDecoration = undefined;
    }
    if (this.activeDimDecoration) {
      this.activeDimDecoration.dispose();
      this.activeDimDecoration = undefined;
    }

    // Clear file decoration in explorer
    if (this.fileDecorationProvider) {
      this.fileDecorationProvider.clearHighlight();
    }
  }

  requestClear() {
    this.clearDecorations();
    this.emit('clear');
  }
}

// Create and export singleton instance
export const decorationManager = new DecorationManager();
