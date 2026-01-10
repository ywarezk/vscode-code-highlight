import * as vscode from 'vscode';

class Logger {
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Code Highlight for Lectures');
  }

  log(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    this.outputChannel.appendLine(`[${timestamp}] ${message}`);
  }

  error(message: string, error?: unknown): void {
    const timestamp = new Date().toLocaleTimeString();
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.outputChannel.appendLine(`[${timestamp}] ERROR: ${message}`);
    if (errorMessage) {
      this.outputChannel.appendLine(`  ${errorMessage}`);
      if (error instanceof Error && error.stack) {
        this.outputChannel.appendLine(`  ${error.stack}`);
      }
    }
    // Automatically show output channel when errors occur
    this.outputChannel.show(true);
  }

  warn(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    this.outputChannel.appendLine(`[${timestamp}] WARN: ${message}`);
    // Show output channel for warnings too
    this.outputChannel.show(true);
  }

  info(message: string, showOutput = false): void {
    const timestamp = new Date().toLocaleTimeString();
    this.outputChannel.appendLine(`[${timestamp}] INFO: ${message}`);
    // Optionally show output channel for important info messages
    if (showOutput) {
      this.outputChannel.show(true);
    }
  }

  show(): void {
    this.outputChannel.show(true);
  }

  dispose(): void {
    this.outputChannel.dispose();
  }
}

// Export singleton instance
export const logger = new Logger();
