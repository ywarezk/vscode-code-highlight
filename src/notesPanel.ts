import * as vscode from 'vscode';
import {saveNote} from './notesStorage';
import {decorationManager} from './decorationManager';

interface SelectionInfo {
  file: string;
  start: number;
  end: number;
}

let notesPanel: vscode.WebviewPanel | undefined = undefined;
let currentSelection: SelectionInfo | undefined = undefined;

export function createOrShowNotesPanel(context: vscode.ExtensionContext, selectionInfo: SelectionInfo) {
  const columnToShowIn = vscode.ViewColumn.Beside;
  currentSelection = selectionInfo;

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
          if (currentSelection) {
            try {
              await saveNote(message.text, currentSelection.file, currentSelection.start, currentSelection.end);
              vscode.window.showInformationMessage('Lecture notes saved!');
              notesPanel?.dispose();
            } catch (error) {
              vscode.window.showErrorMessage(error instanceof Error ? error.message : 'Failed to save notes');
            }
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
    },
    null,
    context.subscriptions
  );
}

function getWebviewContent(): string {
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
  </style>
</head>
<body>
  <div class="section-header">Lecture Notes</div>
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
