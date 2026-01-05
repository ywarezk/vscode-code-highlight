import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface LectureNote {
  file: string;
  start: number;
  end: number;
  notes: string;
}

const NOTES_FILENAME = 'lecture-notes.json';

export async function saveNote(notes: string, file: string, start: number, end: number): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    throw new Error('No workspace folder found');
  }

  const vscodeFolder = path.join(workspaceFolder.uri.fsPath, '.vscode');
  const notesFile = path.join(vscodeFolder, NOTES_FILENAME);

  // Ensure .vscode folder exists
  if (!fs.existsSync(vscodeFolder)) {
    fs.mkdirSync(vscodeFolder, {recursive: true});
  }

  // Read existing notes or create new array
  let allNotes: LectureNote[] = [];

  if (fs.existsSync(notesFile)) {
    try {
      const content = fs.readFileSync(notesFile, 'utf8');
      allNotes = JSON.parse(content);
    } catch (error) {
      console.error('Error reading lecture notes file:', error);
    }
  }

  // Add new note
  const relativePath = path.relative(workspaceFolder.uri.fsPath, file);
  allNotes.push({
    file: relativePath,
    start: start,
    end: end,
    notes: notes,
  });

  // Write back to file
  try {
    fs.writeFileSync(notesFile, JSON.stringify(allNotes, null, 2), 'utf8');
  } catch (error) {
    throw new Error(`Failed to save notes: ${error}`);
  }
}

export function getNotesFilePath(): string | undefined {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return undefined;
  }

  return path.join(workspaceFolder.uri.fsPath, '.vscode', NOTES_FILENAME);
}

export function loadNotes(): LectureNote[] {
  const notesFile = getNotesFilePath();
  if (!notesFile || !fs.existsSync(notesFile)) {
    return [];
  }

  try {
    const content = fs.readFileSync(notesFile, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error reading lecture notes file:', error);
    return [];
  }
}
