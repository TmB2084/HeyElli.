// Minimal Node 24 SQLite surface used here; installed @types/node targets Node 20.
declare module "node:sqlite" {
  type Value = null | number | bigint | string | Uint8Array;
  interface StatementSync {
    get(...values: Value[]): Record<string, Value> | undefined;
    all(...values: Value[]): Record<string, Value>[];
    run(...values: Value[]): { lastInsertRowid: number | bigint; changes: number | bigint };
  }
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
