export function parseSubjectTokens(subject: string): string[] {
  return subject.split(".");
}

/**
 * Check if a subject matches a NATS subject filter.
 * `*` matches a single token, `>` matches one or more trailing tokens.
 */
export function subjectMatchesFilter(
  subject: string,
  filter: string,
): boolean {
  const subjectTokens = parseSubjectTokens(subject);
  const filterTokens = parseSubjectTokens(filter);

  for (let i = 0; i < filterTokens.length; i++) {
    const ft = filterTokens[i];

    if (ft === ">") {
      // > must be the last token and matches one or more remaining
      return i < subjectTokens.length;
    }

    if (i >= subjectTokens.length) {
      return false;
    }

    if (ft !== "*" && ft !== subjectTokens[i]) {
      return false;
    }
  }

  return subjectTokens.length === filterTokens.length;
}
