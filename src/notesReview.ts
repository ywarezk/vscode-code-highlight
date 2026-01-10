import * as vscode from 'vscode';
import * as path from 'path';
import {lessonManager} from './lessonManager';
import {decorationManager} from './decorationManager';
import {LectureNote} from './types';

const REVIEW_CONTEXT_KEY = 'codeHighlight.reviewMode';
const REVIEW_SCHEME = 'academeez-lecture-notes-review';
const REVIEW_URI = vscode.Uri.parse(`${REVIEW_SCHEME}:/lecture-notes.md`);

class NotesReviewContentProvider implements vscode.TextDocumentContentProvider {
  private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  private markdown: string = '';

  provideTextDocumentContent(): string {
    return this.markdown;
  }

  setMarkdown(markdown: string): void {
    this.markdown = markdown;
    this._onDidChange.fire(REVIEW_URI);
  }
}

export class NotesReviewController {
  private provider: NotesReviewContentProvider | undefined;
  private lessonNotes: LectureNote[] = [];
  private currentIndex: number = 0;
  private previewOpened: boolean = false;

  constructor(private readonly context: vscode.ExtensionContext) {}

  register(): void {
    if (!this.provider) {
      this.provider = new NotesReviewContentProvider();
      this.context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider(REVIEW_SCHEME, this.provider)
      );
    }

    this.context.subscriptions.push(
      vscode.commands.registerCommand('code-highlight.reviewNotes', async () => this.start()),
      vscode.commands.registerCommand('code-highlight.reviewNextNote', async () => this.next()),
      vscode.commands.registerCommand('code-highlight.reviewPrevNote', async () => this.prev()),
      vscode.commands.registerCommand('code-highlight.exitReviewNotes', async () => this.stop())
    );
  }

  private async start(): Promise<void> {
    const activeLesson = lessonManager.getActiveLesson();
    if (!activeLesson) {
      vscode.window.showErrorMessage('No active lesson. Please create or select a lesson first.');
      return;
    }

    if (activeLesson.notes.length === 0) {
      vscode.window.showInformationMessage('No lecture notes found in the active lesson.');
      return;
    }

    this.lessonNotes = [...activeLesson.notes];
    this.currentIndex = 0;
    this.previewOpened = false;

    await vscode.commands.executeCommand('setContext', REVIEW_CONTEXT_KEY, true);
    await this.showCurrent();
  }

  private async stop(): Promise<void> {
    this.lessonNotes = [];
    this.currentIndex = 0;
    this.previewOpened = false;
    decorationManager.requestClear();
    await vscode.commands.executeCommand('setContext', REVIEW_CONTEXT_KEY, false);

    // Assumes the markdown preview is focused when exiting via Escape.
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  }

  private async next(): Promise<void> {
    if (this.lessonNotes.length === 0) {
      return;
    }
    if (this.currentIndex >= this.lessonNotes.length - 1) {
      vscode.window.showInformationMessage('Reached the end of the lecture notes.');
      return;
    }
    this.currentIndex += 1;
    await this.showCurrent();
  }

  private async prev(): Promise<void> {
    if (this.lessonNotes.length === 0) {
      return;
    }
    if (this.currentIndex <= 0) {
      vscode.window.showInformationMessage('Already at the first lecture note.');
      return;
    }
    this.currentIndex -= 1;
    await this.showCurrent();
  }

  private async focusPreviewPanel(textEditorColumn?: vscode.ViewColumn): Promise<void> {
    // Restore focus to the preview panel so arrow keys continue to work
    // Markdown previews are webviews shown in an editor group
    // We should NOT open the document as a text editor - just focus the preview group

    // Use a small delay to ensure the file opening has completed
    await new Promise(resolve => setTimeout(resolve, 50));

    // Simply focus the next editor group (where the preview is)
    // This won't open any new documents, just focus the existing preview
    await vscode.commands.executeCommand('workbench.action.focusNextGroup');
  }

  private async showCurrent(): Promise<void> {
    const note = this.lessonNotes[this.currentIndex];
    if (!note || !this.provider) {
      return;
    }

    // Navigate/highlight code for code notes
    if (note.type === 'code') {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (workspaceFolder) {
        const absolutePath = path.join(workspaceFolder.uri.fsPath, note.file);
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(absolutePath));

        // Find an editor column that contains text editors (not preview)
        // Since the preview panel might have focus, we need to find a text editor column
        let targetColumn = vscode.ViewColumn.One;

        // Try to find any visible text editor that's not our review preview document
        for (const visibleEditor of vscode.window.visibleTextEditors) {
          if (visibleEditor.document.uri.scheme !== REVIEW_SCHEME) {
            targetColumn = visibleEditor.viewColumn ?? vscode.ViewColumn.One;
            break;
          }
        }

        // Open in the target column (text editor side), not in the focused preview panel
        const editor = await vscode.window.showTextDocument(doc, {
          viewColumn: targetColumn,
          preview: false,
        });

        // Apply decorations for all ranges, and reveal the first one
        decorationManager.applyDecorationsForRanges(editor, note.ranges);

        const [startLine, endLine] = note.ranges[0];
        const endPos = new vscode.Position(endLine, doc.lineAt(endLine).text.length);
        const revealRange = new vscode.Range(new vscode.Position(startLine, 0), endPos);
        editor.revealRange(revealRange, vscode.TextEditorRevealType.InCenter);
        editor.selection = new vscode.Selection(revealRange.start, revealRange.start);

        // Update markdown content first
        this.provider.setMarkdown(note.markdown);

        // Open preview only once - subsequent updates will refresh automatically via onDidChange
        if (!this.previewOpened) {
          await vscode.commands.executeCommand('markdown.showPreviewToSide', REVIEW_URI);
          this.previewOpened = true;
        } else {
          // Restore focus to the preview panel so arrow keys continue to work
          // The preview is in the column beside the text editor (targetColumn)
          await this.focusPreviewPanel(targetColumn);
        }
        return; // Early return for code notes
      }
    } else {
      // General notes don't point to code
      decorationManager.requestClear();
    }

    // Update markdown content first
    this.provider.setMarkdown(note.markdown);

    // Open preview only once - subsequent updates will refresh automatically via onDidChange
    if (!this.previewOpened) {
      await vscode.commands.executeCommand('markdown.showPreviewToSide', REVIEW_URI);
      this.previewOpened = true;
    } else {
      // For general notes, try to focus the preview (it should be in a side column)
      await this.focusPreviewPanel();
    }
  }
}
