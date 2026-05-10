export const escapeCell = (value) => {
  const text = String(value ?? "");
  return `"${text.split('"').join('""')}"`;
};

export const toCsv = (header, rows) => {
  const lines = [header, ...rows].map((line) => line.map(escapeCell).join(","));
  return lines.join("\n");
};
