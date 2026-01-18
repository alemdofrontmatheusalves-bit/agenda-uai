/**
 * Utilitários para manipulação de telefones brasileiros
 * Padrão de armazenamento: E.164 (+5511999999999)
 */

/**
 * Remove todos os caracteres não numéricos
 */
export function extractDigits(input: string): string {
  return input.replace(/\D/g, '');
}

/**
 * Valida se é um telefone brasileiro válido
 * Aceita: 10-11 dígitos (com DDD) ou 12-13 dígitos (com código país)
 */
export function isValidBrazilianPhone(phone: string): boolean {
  const digits = extractDigits(phone);
  
  // Telefone com código do país (55) + DDD + número
  if (digits.length === 12 || digits.length === 13) {
    if (!digits.startsWith('55')) return false;
    const ddd = digits.substring(2, 4);
    return isValidDDD(ddd);
  }
  
  // Telefone com DDD + número (10 ou 11 dígitos)
  if (digits.length === 10 || digits.length === 11) {
    const ddd = digits.substring(0, 2);
    return isValidDDD(ddd);
  }
  
  return false;
}

/**
 * Valida DDDs brasileiros válidos (11-99, excluindo alguns inválidos)
 */
function isValidDDD(ddd: string): boolean {
  const num = parseInt(ddd, 10);
  // DDDs válidos: 11-99, mas alguns não existem (como 10, 20, 30, etc.)
  // Para simplificar, aceitamos 11-99
  return num >= 11 && num <= 99;
}

/**
 * Normaliza qualquer formato de telefone para E.164
 * Entrada: "(11) 99999-9999", "11999999999", "+5511999999999", "5511999999999"
 * Saída: "+5511999999999"
 * 
 * Retorna null se o telefone for inválido
 */
export function normalizePhone(input: string): string | null {
  if (!input || input.trim() === '') return null;
  
  const digits = extractDigits(input);
  
  // Remove zero inicial se houver
  const cleanDigits = digits.startsWith('0') ? digits.substring(1) : digits;
  
  // Já tem código do país (55)
  if (cleanDigits.length === 12 || cleanDigits.length === 13) {
    if (cleanDigits.startsWith('55')) {
      return `+${cleanDigits}`;
    }
  }
  
  // Apenas DDD + número (10 ou 11 dígitos)
  if (cleanDigits.length === 10 || cleanDigits.length === 11) {
    return `+55${cleanDigits}`;
  }
  
  // Formato inválido
  return null;
}

/**
 * Formata telefone E.164 para exibição brasileira
 * Entrada: "+5511999999999"
 * Saída: "(11) 99999-9999"
 */
export function formatPhoneDisplay(e164Phone: string | null | undefined): string {
  if (!e164Phone) return '';
  
  const digits = extractDigits(e164Phone);
  
  // Remove código do país se presente
  const nationalNumber = digits.startsWith('55') ? digits.substring(2) : digits;
  
  // Celular: 11 dígitos (DDD + 9 dígitos)
  if (nationalNumber.length === 11) {
    const ddd = nationalNumber.substring(0, 2);
    const firstPart = nationalNumber.substring(2, 7);
    const secondPart = nationalNumber.substring(7, 11);
    return `(${ddd}) ${firstPart}-${secondPart}`;
  }
  
  // Fixo: 10 dígitos (DDD + 8 dígitos)
  if (nationalNumber.length === 10) {
    const ddd = nationalNumber.substring(0, 2);
    const firstPart = nationalNumber.substring(2, 6);
    const secondPart = nationalNumber.substring(6, 10);
    return `(${ddd}) ${firstPart}-${secondPart}`;
  }
  
  // Formato não reconhecido, retorna original
  return e164Phone;
}

/**
 * Aplica máscara de telefone durante digitação
 * Para uso em inputs controlados
 */
export function applyPhoneMask(input: string): string {
  const digits = extractDigits(input);
  
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.substring(0, 2)}) ${digits.substring(2)}`;
  if (digits.length <= 11) {
    const ddd = digits.substring(0, 2);
    const firstPart = digits.substring(2, 7);
    const secondPart = digits.substring(7);
    return `(${ddd}) ${firstPart}-${secondPart}`;
  }
  
  // Limita a 11 dígitos
  const limited = digits.substring(0, 11);
  const ddd = limited.substring(0, 2);
  const firstPart = limited.substring(2, 7);
  const secondPart = limited.substring(7, 11);
  return `(${ddd}) ${firstPart}-${secondPart}`;
}
