/**
 * Winziger, robuster CSV-Zeilenparser für die Tessie-Rohexporte.
 * Kommas werden respektiert, wenn sie in doppelten Anführungszeichen stehen;
 * verdoppelte Quotes ("") innerhalb eines Feldes werden zu einem Quote entwertet.
 * Sowohl das leere Quote-Feld ("") als auch das nackte Leerfeld (,,) liefern null.
 *
 * In den Exportdateien kommen weder eingebettete Kommas noch Zeilenumbrüche vor,
 * aber der Parser behandelt sie trotzdem korrekt (defensiv, siehe M24-Vorgabe).
 */
export function parseCsvLine(line: string): (string | null)[] {
  const fields: (string | null)[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        // Verdoppeltes Quote → literales Quote, sonst schließt es das Feld.
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(cur === "" ? null : cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur === "" ? null : cur);

  return fields;
}
