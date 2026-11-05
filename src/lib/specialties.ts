/**
 * Normaliza o nome da especialidade médica:
 * - Remove espaços extras nas pontas e duplos no meio.
 * - Converte todo maiúsculo para minúsculo antes de colocar a primeira em maiúscula.
 * - Mantém a primeira letra maiúscula e o restante do nome conforme formato padrão.
 */
export function normalizeSpecialtyName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ")
  if (!trimmed) return ""
  const normalized = trimmed === trimmed.toUpperCase() ? trimmed.toLowerCase() : trimmed
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

/**
 * Converte o nome da especialidade em um identificador seguro no formato slug:
 * - Minúsculas, sem acentos gráficos.
 * - Conjunções e preposições médicas comuns ('e', 'de', 'da', 'do') são omitidas
 *   para manter compatibilidade com seeds de especialidades brasileiras (ex: ginecologia-obstetricia).
 * - Substitui caracteres não alfanuméricos por traço.
 */
export function slugifySpecialty(name: string): string {
  const withoutAccents = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

  const stripped = withoutAccents
    .replace(/\b(e|de|da|do|das|dos)\b/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  if (stripped) return stripped

  return withoutAccents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export interface SpecialtyValidationResult {
  valid: boolean
  error?: string
  normalized?: string
}

/**
 * Valida o nome de uma especialidade (3 a 60 caracteres).
 */
export function validateSpecialtyName(name: unknown): SpecialtyValidationResult {
  if (typeof name !== "string") {
    return { valid: false, error: "Nome da especialidade é obrigatório." }
  }
  const trimmed = name.trim().replace(/\s+/g, " ")
  if (trimmed.length < 3 || trimmed.length > 60) {
    return { valid: false, error: "O nome da especialidade deve ter entre 3 e 60 caracteres." }
  }
  return { valid: true, normalized: normalizeSpecialtyName(trimmed) }
}
