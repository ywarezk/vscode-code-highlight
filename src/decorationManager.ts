import * as vscode from 'vscode';
import {EventEmitter} from 'events';
import {LectureFileDecorationProvider} from './fileDecorationProvider';
import {LineRange} from './types';

class DecorationManager extends EventEmitter {
  private activeDecoration: vscode.TextEditorDecorationType | undefined;
  private activeDimDecoration: vscode.TextEditorDecorationType | undefined;
  private fileDecorationProvider: LectureFileDecorationProvider | undefined = undefined;
  private currentRanges: LineRange[] = [];
  private currentEditor: vscode.TextEditor | undefined = undefined;

  setFileDecorationProvider(provider: LectureFileDecorationProvider): void {
    this.fileDecorationProvider = provider;
  }

  /**
   * Get the currently selected ranges
   */
  getCurrentRanges(): LineRange[] {
    return [...this.currentRanges];
  }

  /**
   * Apply decorations for a single selection (convenience method)
   */
  applyDecorations(editor: vscode.TextEditor, selection: vscode.Selection) {
    const range: LineRange = [selection.start.line, selection.end.line];
    this.applyDecorationsForRanges(editor, [range]);
  }

  /**
   * Apply decorations for multiple ranges
   */
  applyDecorationsForRanges(editor: vscode.TextEditor, ranges: LineRange[]): void {
    // Clear any existing decorations
    this.clearDecorations();

    // Store current ranges and editor
    this.currentRanges = [...ranges];
    this.currentEditor = editor;

    if (ranges.length === 0) {
      return;
    }

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

    // Convert LineRange tuples to vscode.Range objects
    const allRanges: vscode.Range[] = [];
    ranges.forEach(([startLine, endLine]) => {
      const startPos = new vscode.Position(startLine, 0);
      const endLineText = document.lineAt(endLine);
      const endPos = new vscode.Position(endLine, endLineText.text.length);
      allRanges.push(new vscode.Range(startPos, endPos));
    });

    // Apply decoration to all ranges
    editor.setDecorations(this.activeDecoration, allRanges);

    // Dim/blur other text by reducing opacity on other lines
    const allLines: vscode.Range[] = [];
    const selectedLineNumbers = new Set<number>();

    // Collect all selected line numbers
    ranges.forEach(([start, end]) => {
      for (let i = start; i <= end; i++) {
        selectedLineNumbers.add(i);
      }
    });

    // Add all non-selected lines to dimming
    for (let i = 0; i < document.lineCount; i++) {
      if (!selectedLineNumbers.has(i)) {
        allLines.push(document.lineAt(i).range);
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

  /**
   * Add a range to the current decorations
   */
  addRange(range: LineRange): void {
    if (!this.currentEditor) {
      return;
    }

    // Check if range already exists
    const exists = this.currentRanges.some(([start, end]) => start === range[0] && end === range[1]);

    if (!exists) {
      this.currentRanges.push(range);
      this.applyDecorationsForRanges(this.currentEditor, this.currentRanges);
    }
  }

  /**
   * Remove a range from the current decorations
   */
  removeRange(rangeIndex: number): void {
    if (!this.currentEditor || rangeIndex < 0 || rangeIndex >= this.currentRanges.length) {
      return;
    }

    this.currentRanges.splice(rangeIndex, 1);
    this.applyDecorationsForRanges(this.currentEditor, this.currentRanges);
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

    // Clear stored ranges and editor
    this.currentRanges = [];
    this.currentEditor = undefined;
  }

  requestClear() {
    this.clearDecorations();
    this.emit('clear');
  }
}

// Create and export singleton instance
export const decorationManager = new DecorationManager();
