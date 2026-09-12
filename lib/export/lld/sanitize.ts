/**
 * Identifier sanitization for export targets.
 *
 * This matters more than it looks: Mermaid silently fails to render a class
 * whose name contains a space or punctuation, and unquoted SQL identifiers
 * break on reserved words and mixed case. Getting it wrong produces output that
 * looks fine here and fails in the target tool.
 */

/** Mermaid class/entity/state id: alphanumeric and underscore only. */
export function mermaidIdent(name: string, fallback = 'Unnamed'): string {
  const cleaned = name
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (!cleaned) return fallback
  // Must not start with a digit.
  return /^[0-9]/.test(cleaned) ? `_${cleaned}` : cleaned
}

/** Mermaid label text inside quotes — escape the quote character. */
export function mermaidLabel(text: string): string {
  return text.replace(/"/g, '#quot;').replace(/\n/g, ' ').trim()
}

/** Mermaid type text: generics use ~T~ rather than angle brackets. */
export function mermaidType(type: string): string {
  return type
    .trim()
    .replace(/</g, '~')
    .replace(/>/g, '~')
    .replace(/[,]/g, ' ')
    .replace(/\s+/g, ' ')
}

/** PlantUML identifier — quote it when it is not a bare word. */
export function plantUmlIdent(name: string, fallback = 'Unnamed'): string {
  const trimmed = name.trim() || fallback
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed) ? trimmed : `"${trimmed.replace(/"/g, '\\"')}"`
}

/** Double-quoted SQL identifier, with embedded quotes doubled. */
export function sqlIdent(name: string, fallback = 'unnamed'): string {
  const trimmed = name.trim() || fallback
  return `"${trimmed.replace(/"/g, '""')}"`
}

/** Single-quoted SQL literal, with embedded quotes doubled. */
export function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

/** Ensure names are unique after sanitization, appending _2, _3, … */
export function uniquify(names: string[]): string[] {
  const seen = new Map<string, number>()
  return names.map((n) => {
    const count = seen.get(n) ?? 0
    seen.set(n, count + 1)
    return count === 0 ? n : `${n}_${count + 1}`
  })
}
