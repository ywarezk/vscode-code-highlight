/**
 * Type definitions for the Academeez Lecture extension
 */

/**
 * Represents a line range as a tuple [start, end]
 * Both are 0-based line numbers (inclusive)
 */
export type LineRange = [number, number];

/**
 * A general note that doesn't reference any code
 */
export interface GeneralNote {
  type: 'general';
  markdown: string;
}

/**
 * A code note that references specific line ranges in a file
 */
export interface CodeNote {
  type: 'code';
  file: string; // Relative path from workspace root
  ranges: LineRange[]; // Array of [start, end] tuples for non-adjacent ranges
  markdown: string;
}

/**
 * Union type for all note types
 */
export type LectureNote = GeneralNote | CodeNote;

/**
 * Represents a complete lesson with all its notes
 */
export interface Lesson {
  id: number; // Unique identifier, starting from 1
  title: string;
  notes: LectureNote[];
}

/**
 * Represents a lesson summary (used in the master index)
 */
export interface LessonSummary {
  id: number;
  title: string;
}

/**
 * Master state file that tracks all lessons and the active one
 * Stored at: .vscode/lessons.json
 */
export interface LessonsMasterState {
  activeLessonId: number | null; // null if no lesson is active
  lessons: LessonSummary[]; // List of all lessons with their metadata
}

