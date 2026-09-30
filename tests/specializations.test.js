import { describe, expect, it } from 'vitest';
import {
  getSpecialization,
  getSpecializationPrompt,
  isComplexLegalQuestion,
  parseSpecializations,
  SPECIALIZATIONS,
} from '../lib/specializations.js';
import {
  createLawyerDashboardToken,
  parseOab,
  verifyLawyerDashboardToken,
} from '../lib/lawyers.js';

describe('especializações jurídicas', () => {
  it('expõe as sete áreas e resolve códigos, nomes e posições', () => {
    expect(SPECIALIZATIONS).toHaveLength(7);
    expect(SPECIALIZATIONS.every((item) => item.statutes.length && item.jurisprudencePrompt.length > 20)).toBe(true);
    expect(getSpecialization('1')?.code).toBe('direito_de_familia');
    expect(getSpecialization('DIREITO_CIVIL')?.name).toBe('Direito Civil');
    expect(getSpecialization('Direito Imobiliário')?.code).toBe('direito_imobiliario');
    expect(getSpecialization('desconhecida')).toBeNull();
  });

  it('cria contexto fundamentado sem afirmar jurisprudência não verificada', () => {
    const prompt = getSpecializationPrompt('direito_de_familia', { state: 'SP', city: 'Santos' });
    expect(prompt).toContain('Lei 8.069/90');
    expect(prompt).toContain('2024–2026');
    expect(prompt).toContain('TJ-SP');
    expect(prompt).toContain('não invente números');
  });

  it('converte seleção de áreas em códigos únicos e detecta consultas complexas', () => {
    expect(parseSpecializations('1, direito_de_familia, 2')).toEqual([
      'direito_de_familia',
      'direito_trabalhista',
    ]);
    expect(isComplexLegalQuestion('Fui intimado para uma audiência.')).toBe(true);
    expect(isComplexLegalQuestion('Olá, tudo bem?')).toBe(false);
  });
});

describe('cadastro e acesso de advogados', () => {
  it('valida OAB com UF brasileira', () => {
    expect(parseOab('SP123456')).toEqual({ state: 'SP', number: 'SP123456' });
    expect(parseOab('SP 123456')).toEqual({ state: 'SP', number: 'SP123456' });
    expect(parseOab('123456 XX')).toBeNull();
    expect(parseOab(`SP${' '.repeat(1000)}123456`)).toBeNull();
  });

  it('emite token temporário assinado, válido apenas para o Telegram ID correto', () => {
    const token = createLawyerDashboardToken('123456', 'segredo-do-bot', 1000);
    expect(verifyLawyerDashboardToken(token, 'segredo-do-bot', 2000)).toBe('123456');
    expect(verifyLawyerDashboardToken(token, 'outro-segredo', 2000)).toBeNull();
    expect(verifyLawyerDashboardToken(token, 'segredo-do-bot', 901001)).toBeNull();
  });
});
