// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {createOrShowNotesPanel} from './notesPanel';
import {decorationManager} from './decorationManager';
import {LectureFileDecorationProvider} from './fileDecorationProvider';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "code-highlight" is now active!');

  // Register the file decoration provider to highlight files in the explorer
  const fileDecorationProvider = new LectureFileDecorationProvider();
  const fileDecorationDisposable = vscode.window.registerFileDecorationProvider(fileDecorationProvider);
  decorationManager.setFileDecorationProvider(fileDecorationProvider);
  context.subscriptions.push(fileDecorationDisposable);

  // Register the "Add Lecture Notes" command
  const addNotesDisposable = vscode.commands.registerCommand('code-highlight.addNotes', () => {
    const editor = vscode.window.activeTextEditor;

    // Check if there's an active editor
    if (!editor) {
      vscode.window.showErrorMessage('Please open a file to add lecture notes.');
      return;
    }

    // Check if the user has selected code
    const selection = editor.selection;
    if (selection.isEmpty) {
      vscode.window.showErrorMessage('Please select a code section to add lecture notes.');
      return;
    }

    // Apply decorations using the decoration manager
    // This will also highlight the file in the explorer via FileDecorationProvider
    decorationManager.applyDecorations(editor, selection);

    // Get selection info
    const filePath = editor.document.uri.fsPath;
    const startLine = selection.start.line;
    const endLineNumber = selection.end.line;

    // Create or reveal the notes panel with selection info (with slight delay to ensure reveal completes)
    setTimeout(() => {
      createOrShowNotesPanel(context, {
        file: filePath,
        start: startLine,
        end: endLineNumber,
      });
    }, 100);
  });

  context.subscriptions.push(addNotesDisposable);

  // Subscribe to decoration clear events
  decorationManager.on('clear', () => {
    // Decorations are already cleared by the manager
  });
}

// This method is called when your extension is deactivated
export function deactivate() {}
