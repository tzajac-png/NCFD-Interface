export type SheetRow = Record<string, string>;

export interface ParsedSheet {
  headers: string[];
  rows: SheetRow[];
}
