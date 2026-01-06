import * as vscode from 'vscode';
import {decorationManager} from './decorationManager';
import {lessonManager} from './lessonManager';
import {LineRange} from './types';

interface SelectionInfo {
  file: string;
  ranges: LineRange[]; // Array of [start, end] tuples
}

let notesPanel: vscode.WebviewPanel | undefined = undefined;
let currentSelection: SelectionInfo | undefined = undefined;
let isWaitingForRangeSelection: boolean = false;
let rangeSelectionDisposable: vscode.Disposable | undefined = undefined;

/**
 * Get the current notes panel (for use by extension.ts)
 */
export function getNotesPanel(): vscode.WebviewPanel | undefined {
  return notesPanel;
}

/**
 * Update the notes panel with new ranges
 */
export function updateNotesPanelRanges(ranges: LineRange[], file: string): void {
  if (currentSelection) {
    currentSelection.ranges = ranges;
    currentSelection.file = file;
  } else {
    currentSelection = {
      file: file,
      ranges: ranges,
    };
  }

  if (notesPanel) {
    notesPanel.webview.html = getWebviewContent();
  }
}

export function createOrShowNotesPanel(
  context: vscode.ExtensionContext,
  selectionInfo?: SelectionInfo,
  isGeneralNote: boolean = false
) {
  const columnToShowIn = vscode.ViewColumn.Beside;

  // If selectionInfo is provided, update currentSelection and apply decorations
  if (selectionInfo) {
    currentSelection = selectionInfo;
    const editor = vscode.window.activeTextEditor;
    if (editor && selectionInfo.ranges.length > 0) {
      decorationManager.applyDecorationsForRanges(editor, selectionInfo.ranges);
    }
  } else if (!isGeneralNote) {
    // If no selection info provided, try to get from decoration manager
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const existingRanges = decorationManager.getCurrentRanges();
      if (existingRanges.length > 0) {
        currentSelection = {
          file: editor.document.uri.fsPath,
          ranges: existingRanges,
        };
      } else {
        currentSelection = {
          file: editor.document.uri.fsPath,
          ranges: [],
        };
      }
    }
  }

  if (notesPanel) {
    // If panel already exists, update it with new selection info
    notesPanel.reveal(columnToShowIn, false);
    notesPanel.webview.html = getWebviewContent();
    return;
  }

  // Create a new panel
  notesPanel = vscode.window.createWebviewPanel('lectureNotes', 'Lecture Notes', columnToShowIn, {
    enableScripts: true,
    retainContextWhenHidden: true,
  });

  // Set initial content
  notesPanel.webview.html = getWebviewContent();

  // Handle messages from the webview
  notesPanel.webview.onDidReceiveMessage(
    async message => {
      switch (message.command) {
        case 'save':
          try {
            const activeLesson = lessonManager.getActiveLesson();
            if (!activeLesson) {
              vscode.window.showErrorMessage('No active lesson. Please create or select a lesson first.');
              return;
            }

            // Save the note to the active lesson
            await saveNoteToLesson(message.text, currentSelection);
            vscode.window.showInformationMessage('Lecture notes saved!');
            decorationManager.requestClear();
            notesPanel?.dispose();
          } catch (error) {
            vscode.window.showErrorMessage(error instanceof Error ? error.message : 'Failed to save notes');
          }
          break;
        case 'cancel':
          decorationManager.requestClear();
          notesPanel?.dispose();
          // Restore focus to the text editor using command
          setTimeout(() => {
            vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
          }, 100);
          break;
        case 'removeRange':
          if (currentSelection && message.rangeIndex !== undefined) {
            // Remove range using decoration manager
            decorationManager.removeRange(message.rangeIndex);
            // Update currentSelection to match decoration manager
            currentSelection.ranges = decorationManager.getCurrentRanges();
            // Update the panel
            if (notesPanel) {
              notesPanel.webview.html = getWebviewContent();
            }
          }
          break;
      }
    },
    undefined,
    context.subscriptions
  );

  // Clean up when the panel is closed
  notesPanel.onDidDispose(
    () => {
      notesPanel = undefined;
      currentSelection = undefined;
      isWaitingForRangeSelection = false;
    },
    null,
    context.subscriptions
  );
}

/**
 * Save note to the active lesson
 */
async function saveNoteToLesson(markdown: string, selection: SelectionInfo | undefined): Promise<void> {
  const activeLesson = lessonManager.getActiveLesson();
  if (!activeLesson) {
    throw new Error('No active lesson');
  }

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    throw new Error('No workspace folder found');
  }

  // Determine if it's a general note or code note
  if (!selection || selection.ranges.length === 0) {
    // General note
    activeLesson.notes.push({
      type: 'general',
      markdown,
    });
  } else {
    // Code note - get relative file path
    const filePath = selection.file;
    const relativePath = vscode.workspace.asRelativePath(filePath);

    activeLesson.notes.push({
      type: 'code',
      file: relativePath,
      ranges: selection.ranges,
      markdown,
    });
  }

  // Save the lesson
  const lessonPath = require('path').join(
    workspaceFolder.uri.fsPath,
    '.vscode',
    'lessons',
    `lesson-${activeLesson.id}.json`
  );
  require('fs').writeFileSync(lessonPath, JSON.stringify(activeLesson, null, 2), 'utf-8');
}

function getWebviewContent(): string {
  const activeLesson = lessonManager.getActiveLesson();
  const lessonTitle = activeLesson ? activeLesson.title : 'No active lesson';
  const ranges = currentSelection?.ranges || [];
  const rangesHtml = ranges
    .map(
      (range, index) => `
    <div class="range-item">
      <span class="range-text">Lines ${range[0] + 1}-${range[1] + 1}</span>
      <button class="button-remove" data-range-index="${index}">×</button>
    </div>
  `
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lecture Notes</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: var(--vscode-font-family);
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }

    .section-header {
      padding: 8px 12px;
      background-color: var(--vscode-titleBar-activeBackground);
      border-bottom: 1px solid var(--vscode-panel-border);
      font-size: 12px;
      font-weight: 600;
      color: var(--vscode-titleBar-activeForeground);
    }

    textarea {
      flex: 1;
      width: 100%;
      padding: 12px;
      border: none;
      outline: none;
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
      resize: none;
      line-height: 1.6;
    }

    .button-container {
      padding: 12px;
      border-top: 1px solid var(--vscode-panel-border);
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      background-color: var(--vscode-editor-background);
    }

    button {
      padding: 6px 16px;
      border: 1px solid var(--vscode-button-border);
      border-radius: 2px;
      font-family: var(--vscode-font-family);
      font-size: 13px;
      cursor: pointer;
    }

    .button-cancel {
      background-color: transparent;
      color: var(--vscode-foreground);
    }

    .button-cancel:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }

    .button-save {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    .button-save:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    .ranges-container {
      padding: 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      background-color: var(--vscode-editor-background);
    }

    .ranges-title {
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--vscode-foreground);
    }

    .ranges-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 8px;
    }

    .range-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      background-color: var(--vscode-badge-background);
      border-radius: 3px;
      font-size: 11px;
    }

    .range-text {
      color: var(--vscode-badge-foreground);
    }

    .button-remove {
      background: none;
      border: none;
      color: var(--vscode-badge-foreground);
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      padding: 0;
      width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .button-remove:hover {
      color: var(--vscode-errorForeground);
    }
  </style>
</head>
<body>
  <div class="section-header">Lecture Notes - ${lessonTitle}</div>
  <div class="ranges-container">
    <div class="ranges-title">Selected Ranges:</div>
    <div class="ranges-list" id="ranges-list">
      ${
        rangesHtml ||
        '<span style="color: var(--vscode-descriptionForeground); font-size: 11px;">No ranges selected. Select code and press Ctrl+Alt+L to add ranges.</span>'
      }
    </div>
  </div>
  <textarea id="markdown-editor" placeholder="Write your lecture notes in Markdown here..."></textarea>
  <div class="button-container">
    <button class="button-cancel" id="cancel-button">Cancel</button>
    <button class="button-save" id="save-button">Save</button>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    const editor = document.getElementById('markdown-editor');
    const saveButton = document.getElementById('save-button');
    const cancelButton = document.getElementById('cancel-button');

    if (editor) {
      editor.focus();
    }

    saveButton.addEventListener('click', () => {
      const text = editor.value;
      vscode.postMessage({
        command: 'save',
        text: text
      });
    });

    cancelButton.addEventListener('click', () => {
      vscode.postMessage({
        command: 'cancel'
      });
    });

    // Handle remove range buttons
    document.querySelectorAll('.button-remove').forEach(button => {
      button.addEventListener('click', (e) => {
        const rangeIndex = parseInt(e.target.getAttribute('data-range-index'));
        vscode.postMessage({
          command: 'removeRange',
          rangeIndex: rangeIndex
        });
      });
    });

    // Handle Escape key to cancel
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        vscode.postMessage({
          command: 'cancel'
        });
      }
    });
  </script>
</body>
</html>`;
}
