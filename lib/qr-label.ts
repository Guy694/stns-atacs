/**
 * Text layout for asset QR stickers. SVG text does not wrap, so labels are measured in "visible"
 * characters (Thai above/below marks take no width) and broken on word boundaries.
 */
const THAI_NON_SPACING = /[ัิ-ฺ็-๎]/u;

export function visibleLength(text: string) {
  return Array.from(text).filter((char) => !THAI_NON_SPACING.test(char)).length;
}

// Long official prefixes and their common abbreviations, used only when the full name does not fit.
const ABBREVIATIONS: Array<[RegExp, string]> = [
  [/โรงพยาบาลส่งเสริมสุขภาพตำบล\s*/u, "รพ.สต."],
  [/สำนักงานสาธารณสุขจังหวัด\s*/u, "สสจ."],
  [/สำนักงานสาธารณสุขอำเภอ\s*/u, "สสอ."],
  [/ศูนย์สุขภาพชุมชน\s*/u, "ศสช."],
  [/โรงพยาบาล\s*/u, "รพ."],
];

function segments(text: string) {
  const Segmenter = (Intl as unknown as { Segmenter?: new (locale: string, options: { granularity: string }) => { segment(input: string): Iterable<{ segment: string }> } }).Segmenter;
  if (Segmenter) return Array.from(new Segmenter("th", { granularity: "word" }).segment(text), (part) => part.segment);
  return text.split(/(\s+)/);
}

/** Breaks text into at most `maxLines` lines of `maxChars` visible characters; the last line ends with "…" if cut. */
export function wrapLabel(text: string, maxChars: number, maxLines: number) {
  const lines: string[] = [];
  let current = "";
  const words = segments(text.trim().replace(/\s+/g, " "));
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    if (visibleLength(current + word) <= maxChars) { current += word; continue; }
    if (current.trim()) lines.push(current.trim());
    current = word.trimStart();
    // A single segment longer than a line is split by characters (never between a letter and its marks).
    while (visibleLength(current) > maxChars) {
      const chars = Array.from(current);
      let cut = 0;
      let width = 0;
      while (cut < chars.length && (width < maxChars || THAI_NON_SPACING.test(chars[cut]))) {
        if (!THAI_NON_SPACING.test(chars[cut])) width += 1;
        cut += 1;
      }
      lines.push(chars.slice(0, cut).join(""));
      current = chars.slice(cut).join("");
    }
    if (lines.length >= maxLines) break;
  }
  if (current.trim() && lines.length < maxLines) lines.push(current.trim());
  const used = lines.slice(0, maxLines);
  const consumed = used.join("").replace(/\s/g, "").length;
  if (consumed < text.replace(/\s/g, "").length) {
    const last = Array.from(used[used.length - 1] ?? "");
    while (last.length && visibleLength(last.join("")) > maxChars - 1) last.pop();
    used[used.length - 1] = `${last.join("").trimEnd()}…`;
  }
  return used;
}

/** Facility name for the sticker header: full name when it fits in two lines, otherwise abbreviated. */
export function facilityLabelLines(name: string, maxChars = 24, maxLines = 2) {
  const full = name.trim();
  if (!full) return [];
  const fits = (value: string) => wrapLabel(value, maxChars, maxLines + 1).length <= maxLines;
  if (fits(full)) return wrapLabel(full, maxChars, maxLines);
  let short = full;
  for (const [pattern, replacement] of ABBREVIATIONS) short = short.replace(pattern, replacement);
  return wrapLabel(short, maxChars, maxLines);
}

/** Always-short facility name for small stickers: official prefixes abbreviated, district/province dropped. */
export function shortFacilityName(name: string) {
  let short = name.trim().replace(/\s+/g, " ");
  for (const [pattern, replacement] of ABBREVIATIONS) short = short.replace(pattern, replacement);
  return short.replace(/\s+(?:อำเภอ|อ\.|จังหวัด|จ\.)\S*.*$/u, "").trim();
}
