/**
 * ตัวอ่าน CSV ของระบบเอง (RFC 4180) ใช้แทนไลบรารี xlsx สำหรับไฟล์ .csv
 * - ค่าทุกช่องคงเป็นข้อความตามที่ผู้ใช้กรอก (วันที่ 2022-10-01 ไม่ถูกแปลงเป็น 10/1/22, Serial 00123 ไม่เสียเลข 0)
 * - รองรับ BOM ของไฟล์ "CSV UTF-8" จาก Excel, เครื่องหมายคำพูด, จุลภาคและขึ้นบรรทัดใหม่ในช่อง, CRLF
 */
export type CsvRow = Record<string, string>;

export function parseCsvRecords(text: string, maxRecords = Number.POSITIVE_INFINITY): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;
  let index = text.charCodeAt(0) === 0xfeff ? 1 : 0;

  const endRecord = () => {
    record.push(field);
    field = "";
    // ข้ามบรรทัดว่างทั้งบรรทัด
    if (!(record.length === 1 && record[0] === "")) records.push(record);
    record = [];
  };

  while (index < text.length) {
    if (records.length >= maxRecords) return records;
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
      } else {
        field += char;
      }
      index += 1;
      continue;
    }
    if (char === '"' && field === "") inQuotes = true;
    else if (char === ",") {
      record.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      endRecord();
      if (char === "\r" && text[index + 1] === "\n") index += 1;
    } else field += char;
    index += 1;
  }
  if (field !== "" || record.length) endRecord();
  return records.slice(0, maxRecords);
}

/** แปลงเป็นอ็อบเจ็กต์ตามหัวตาราง (แถวแรก) อ่านข้อมูลไม่เกิน maxRows แถว */
export function parseCsvObjects(text: string, maxRows: number): CsvRow[] {
  const [header, ...rows] = parseCsvRecords(text, maxRows + 1);
  if (!header) return [];
  const keys = header.map((key) => key.replace(/^﻿/, "").trim());
  return rows.map((values) => {
    const row: CsvRow = Object.create(null);
    keys.forEach((key, column) => {
      if (key && key !== "__proto__" && key !== "constructor" && key !== "prototype") row[key] = values[column] ?? "";
    });
    return { ...row };
  });
}
