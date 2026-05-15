/** Minimal RFC-style CSV parser (handles quotes and commas). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += c;
      i += 1;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ",") {
      pushCell();
      i += 1;
      continue;
    }
    if (c === "\r") {
      i += 1;
      continue;
    }
    if (c === "\n") {
      pushCell();
      pushRow();
      i += 1;
      continue;
    }
    cell += c;
    i += 1;
  }

  pushCell();
  if (row.length > 1 || (row.length === 1 && row[0] !== "")) {
    pushRow();
  }

  return rows;
}

export function gridToObjects(grid: string[][]): { headers: string[]; rows: Record<string, string>[] } {
  if (grid.length === 0) return { headers: [], rows: [] };
  const headers = grid[0].map((h, idx) => h.trim() || `Column ${idx + 1}`);
  const rows: Record<string, string>[] = [];
  for (let r = 1; r < grid.length; r++) {
    const line = grid[r];
    if (line.every((c) => c.trim() === "")) continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, c) => {
      obj[h] = line[c] ?? "";
    });
    rows.push(obj);
  }
  return { headers, rows };
}
