// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {createOrShowNotesPanel, getNotesPanel, updateNotesPanelRanges} from './notesPanel';
import {decorationManager} from './decorationManager';
import {LectureFileDecorationProvider} from './fileDecorationProvider';
import {lessonManager} from './lessonManager';
import {LineRange} from './types';

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
  const addNotesDisposable = vscode.commands.registerCommand('code-highlight.addNotes', async () => {
    const editor = vscode.window.activeTextEditor;

    // Check if there's an active editor
    if (!editor) {
      vscode.window.showErrorMessage('Please open a file to add lecture notes.');
      return;
    }

    // Check if there's an active lesson
    const activeLesson = lessonManager.getActiveLesson();
    if (!activeLesson) {
      const createLesson = await vscode.window.showWarningMessage(
        'No active lesson. Would you like to create one?',
        {modal: true},
        'Create Lesson'
      );
      if (createLesson === 'Create Lesson') {
        vscode.commands.executeCommand('code-highlight.createLesson');
      }
      return;
    }

    // Check if notes panel is already open
    const existingPanel = getNotesPanel();
    if (existingPanel) {
      // Panel is open - add range to existing panel
      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.window.showWarningMessage('Please select a code range to add.');
        return;
      }

      const newRange: LineRange = [selection.start.line, selection.end.line];
      const currentRanges = decorationManager.getCurrentRanges();

      // Check if range already exists
      const exists = currentRanges.some(([start, end]) => start === newRange[0] && end === newRange[1]);

      if (exists) {
        vscode.window.showWarningMessage('This range is already selected.');
        return;
      }

      // Add the new range
      const updatedRanges = [...currentRanges, newRange];
      decorationManager.applyDecorationsForRanges(editor, updatedRanges);

      // Update the notes panel
      updateNotesPanelRanges(updatedRanges, editor.document.uri.fsPath);

      vscode.window.showInformationMessage(`Range added: Lines ${newRange[0] + 1}-${newRange[1] + 1}`);
      return;
    }

    // Panel is not open - create new panel
    const selection = editor.selection;
    if (selection.isEmpty) {
      // Allow opening panel for general notes
      createOrShowNotesPanel(context, undefined, true);
      return;
    }

    // Get selection info
    const filePath = editor.document.uri.fsPath;
    const startLine = selection.start.line;
    const endLineNumber = selection.end.line;

    // Apply decorations using the decoration manager
    decorationManager.applyDecorations(editor, selection);

    // Create or reveal the notes panel with initial range
    createOrShowNotesPanel(context, {
      file: filePath,
      ranges: [[startLine, endLineNumber]],
    });
  });

  context.subscriptions.push(addNotesDisposable);

  // Register the "Create New Lesson" command
  const createLessonDisposable = vscode.commands.registerCommand('code-highlight.createLesson', async () => {
    // Prompt user for lesson title
    const lessonTitle = await vscode.window.showInputBox({
      prompt: 'Enter the title for the new lesson',
      placeHolder: 'e.g., Introduction to React',
      validateInput: value => {
        if (!value || value.trim().length === 0) {
          return 'Lesson title cannot be empty';
        }
        return null;
      },
    });

    if (!lessonTitle) {
      // User cancelled
      return;
    }

    try {
      // Create the lesson and set it as active
      const lesson = lessonManager.createLesson(lessonTitle);
      vscode.window.showInformationMessage(`Lesson "${lesson.title}" created and activated!`);
    } catch (error) {
      vscode.window.showErrorMessage(error instanceof Error ? error.message : 'Failed to create lesson');
    }
  });

  context.subscriptions.push(createLessonDisposable);

  // Register the "Delete Lesson" command
  const deleteLessonDisposable = vscode.commands.registerCommand('code-highlight.deleteLesson', async () => {
    try {
      const allLessons = lessonManager.getAllLessons();

      if (allLessons.length === 0) {
        vscode.window.showInformationMessage('No lessons available to delete.');
        return;
      }

      // Show quick pick to select a lesson
      const lessonItems = allLessons.map(lesson => ({
        label: lesson.title,
        description: `ID: ${lesson.id}`,
        id: lesson.id,
      }));

      const selected = await vscode.window.showQuickPick(lessonItems, {
        placeHolder: 'Select a lesson to delete',
      });

      if (!selected) {
        // User cancelled
        return;
      }

      // Show confirmation dialog
      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to delete "${selected.label}"? This action cannot be undone.`,
        {modal: true},
        'Delete'
      );

      if (confirm === 'Delete') {
        lessonManager.deleteLesson(selected.id);
        vscode.window.showInformationMessage(`Lesson "${selected.label}" has been deleted.`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(error instanceof Error ? error.message : 'Failed to delete lesson');
    }
  });

  context.subscriptions.push(deleteLessonDisposable);

  // Register the "Set Active Lesson" command
  const setActiveLessonDisposable = vscode.commands.registerCommand('code-highlight.setActiveLesson', async () => {
    try {
      const allLessons = lessonManager.getAllLessons();

      if (allLessons.length === 0) {
        vscode.window.showInformationMessage('No lessons available. Create a lesson first.');
        return;
      }

      const activeLesson = lessonManager.getActiveLesson();
      const activeLessonId = activeLesson?.id;

      // Show quick pick to select a lesson
      const lessonItems = allLessons.map(lesson => ({
        label: lesson.title,
        description: lesson.id === activeLessonId ? 'Currently active' : `ID: ${lesson.id}`,
        id: lesson.id,
        picked: lesson.id === activeLessonId, // Mark the current active lesson
      }));

      const selected = await vscode.window.showQuickPick(lessonItems, {
        placeHolder: 'Select a lesson to set as active',
      });

      if (!selected) {
        // User cancelled
        return;
      }

      // Only set if it's different from the current active lesson
      if (selected.id !== activeLessonId) {
        lessonManager.setActiveLesson(selected.id);
        vscode.window.showInformationMessage(`Lesson "${selected.label}" is now active.`);
      } else {
        vscode.window.showInformationMessage(`Lesson "${selected.label}" is already active.`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(error instanceof Error ? error.message : 'Failed to set active lesson');
    }
  });

  context.subscriptions.push(setActiveLessonDisposable);

  // Subscribe to decoration clear events
  decorationManager.on('clear', () => {
    // Decorations are already cleared by the manager
  });
}

// This method is called when your extension is deactivated
export function deactivate() {}
