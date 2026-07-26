export function normalizeTranscript(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function appendUniqueTranscript(current: string, next: string) {
  const cleanNext = next.trim();
  if (!cleanNext) return current;
  if (!current.trim()) return cleanNext;

  const lines = current.split("\n").filter((line) => line.trim());
  const last = lines.at(-1) || "";
  const normalizedNext = normalizeTranscript(cleanNext);
  const normalizedLast = normalizeTranscript(last);

  if (
    lines.some((line) => normalizeTranscript(line) === normalizedNext) ||
    normalizedLast.startsWith(normalizedNext)
  ) {
    return current;
  }
  if (normalizedNext.startsWith(normalizedLast)) {
    return [...lines.slice(0, -1), cleanNext].join("\n");
  }
  return `${current}\n${cleanNext}`;
}

export function replaceStreamingTranscript(
  current: string,
  previousHypothesis: string,
  nextHypothesis: string,
) {
  const cleanNext = nextHypothesis.trim();
  if (!cleanNext) return current;
  if (!previousHypothesis.trim()) {
    return appendUniqueTranscript(current, cleanNext);
  }

  const lines = current.split("\n");
  const lastIndex = lines.length - 1;
  if (
    normalizeTranscript(lines[lastIndex] || "") ===
    normalizeTranscript(previousHypothesis)
  ) {
    lines[lastIndex] = cleanNext;
    return lines.join("\n");
  }

  return appendUniqueTranscript(current, cleanNext);
}
