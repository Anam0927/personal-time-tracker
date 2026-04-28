/**
 * TUI layer scaffold.
 * TODO(AA-379): Implement interactive terminal UI screens and keyboard navigation.
 */
export interface TuiApp {
  run(): Promise<void>;
}

export class TuiAppStub implements TuiApp {
  async run(): Promise<void> {
    console.log("TUI is not implemented yet.");
  }
}
