import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {Lesson, LessonsMasterState, LessonSummary} from './types';

class LessonManager {
  private masterStatePath: string | undefined;
  private lessonsDir: string | undefined;
  private statusBarItem: vscode.StatusBarItem | undefined;

  /**
   * Initialize the lesson manager with workspace paths
   */
  initialize(): void {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('No workspace folder found');
    }

    const vscodeDir = path.join(workspaceFolder.uri.fsPath, '.vscode');
    this.masterStatePath = path.join(vscodeDir, 'lessons.json');
    this.lessonsDir = path.join(vscodeDir, 'lessons');

    // Ensure .vscode directory exists
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, {recursive: true});
    }

    // Ensure lessons directory exists
    if (!fs.existsSync(this.lessonsDir)) {
      fs.mkdirSync(this.lessonsDir, {recursive: true});
    }

    // Initialize status bar item if not already created
    if (!this.statusBarItem) {
      this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
      this.statusBarItem.command = 'code-highlight.createLesson';
      this.updateStatusBar();
    }
  }

  /**
   * Get the path to the master state file
   */
  private getMasterStatePath(): string {
    if (!this.masterStatePath) {
      this.initialize();
    }
    return this.masterStatePath!;
  }

  /**
   * Get the path to the lessons directory
   */
  private getLessonsDir(): string {
    if (!this.lessonsDir) {
      this.initialize();
    }
    return this.lessonsDir!;
  }

  /**
   * Load the master state file
   */
  private loadMasterState(): LessonsMasterState {
    const statePath = this.getMasterStatePath();

    if (!fs.existsSync(statePath)) {
      // Return default state if file doesn't exist
      return {
        activeLessonId: null,
        lessons: [],
      };
    }

    try {
      const content = fs.readFileSync(statePath, 'utf-8');
      return JSON.parse(content) as LessonsMasterState;
    } catch (error) {
      // If file is corrupted, return default state
      console.error('Error loading master state:', error);
      return {
        activeLessonId: null,
        lessons: [],
      };
    }
  }

  /**
   * Save the master state file
   */
  private saveMasterState(state: LessonsMasterState): void {
    const statePath = this.getMasterStatePath();
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
    this.updateStatusBar();
  }

  /**
   * Update the status bar to show the active lesson
   */
  private updateStatusBar(): void {
    if (!this.statusBarItem) {
      return;
    }

    const activeLesson = this.getActiveLessonWithoutUpdate();
    if (activeLesson) {
      this.statusBarItem.text = `$(book) Lesson: ${activeLesson.title}`;
      this.statusBarItem.tooltip = `Active lesson: ${activeLesson.title}`;
      this.statusBarItem.show();
    } else {
      this.statusBarItem.text = '$(book) No active lesson';
      this.statusBarItem.tooltip = 'Click to create a new lesson';
      this.statusBarItem.show();
    }
  }

  /**
   * Get the currently active lesson without updating the status bar (to avoid recursion)
   */
  private getActiveLessonWithoutUpdate(): Lesson | null {
    const state = this.loadMasterState();
    if (state.activeLessonId === null) {
      return null;
    }

    const lessonPath = path.join(this.getLessonsDir(), `lesson-${state.activeLessonId}.json`);
    if (!fs.existsSync(lessonPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(lessonPath, 'utf-8');
      return JSON.parse(content) as Lesson;
    } catch (error) {
      console.error(`Error loading lesson ${state.activeLessonId}:`, error);
      return null;
    }
  }

  /**
   * Get the next available lesson ID
   */
  private getNextLessonId(): number {
    const state = this.loadMasterState();
    if (state.lessons.length === 0) {
      return 1;
    }
    // Find the highest ID and increment
    const maxId = Math.max(...state.lessons.map(l => l.id));
    return maxId + 1;
  }

  /**
   * Create a new lesson
   */
  createLesson(title: string): Lesson {
    this.initialize();

    const state = this.loadMasterState();
    const newId = this.getNextLessonId();

    // Create the lesson object
    const lesson: Lesson = {
      id: newId,
      title: title.trim(),
      notes: [],
    };

    // Save the lesson file
    const lessonPath = path.join(this.getLessonsDir(), `lesson-${newId}.json`);
    fs.writeFileSync(lessonPath, JSON.stringify(lesson, null, 2), 'utf-8');

    // Update master state
    state.lessons.push({
      id: newId,
      title: lesson.title,
    });
    state.activeLessonId = newId;
    this.saveMasterState(state);

    return lesson;
  }

  /**
   * Get the currently active lesson
   */
  getActiveLesson(): Lesson | null {
    this.initialize();

    const state = this.loadMasterState();
    if (state.activeLessonId === null) {
      this.updateStatusBar();
      return null;
    }

    const lesson = this.getLessonById(state.activeLessonId);
    // Update status bar when getting active lesson (in case it changed externally)
    this.updateStatusBar();
    return lesson;
  }

  /**
   * Get a lesson by ID
   */
  getLessonById(id: number): Lesson | null {
    this.initialize();

    const lessonPath = path.join(this.getLessonsDir(), `lesson-${id}.json`);

    if (!fs.existsSync(lessonPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(lessonPath, 'utf-8');
      return JSON.parse(content) as Lesson;
    } catch (error) {
      console.error(`Error loading lesson ${id}:`, error);
      return null;
    }
  }

  /**
   * Get all lessons summary
   */
  getAllLessons(): LessonSummary[] {
    const state = this.loadMasterState();
    return state.lessons;
  }

  /**
   * Set the active lesson
   */
  setActiveLesson(id: number): void {
    this.initialize();

    const state = this.loadMasterState();
    // Verify lesson exists
    if (!state.lessons.find(l => l.id === id)) {
      throw new Error(`Lesson with ID ${id} does not exist`);
    }

    state.activeLessonId = id;
    this.saveMasterState(state);
  }

  /**
   * Save a lesson to disk
   */
  saveLesson(lesson: Lesson): void {
    this.initialize();

    const lessonPath = path.join(this.getLessonsDir(), `lesson-${lesson.id}.json`);
    fs.writeFileSync(lessonPath, JSON.stringify(lesson, null, 2), 'utf-8');
  }

  /**
   * Delete a lesson
   */
  deleteLesson(id: number): void {
    this.initialize();

    const state = this.loadMasterState();
    const lessonIndex = state.lessons.findIndex(l => l.id === id);

    if (lessonIndex === -1) {
      throw new Error(`Lesson with ID ${id} does not exist`);
    }

    // Delete the lesson file
    const lessonPath = path.join(this.getLessonsDir(), `lesson-${id}.json`);
    if (fs.existsSync(lessonPath)) {
      fs.unlinkSync(lessonPath);
    }

    // Remove from master state
    state.lessons.splice(lessonIndex, 1);

    // If the deleted lesson was active, set activeLessonId to null or the first available lesson
    if (state.activeLessonId === id) {
      state.activeLessonId = state.lessons.length > 0 ? state.lessons[0].id : null;
    }

    this.saveMasterState(state);
  }
}

// Create and export singleton instance
export const lessonManager = new LessonManager();
