export const SPECIALIZATIONS = [
  {
    code: 'direito_de_familia',
    name: 'Direito de Família',
    description: 'Casamento, divórcio, guarda e alimentos',
    icon: '👨‍👩‍👧',
    statutes: ['Lei 8.069/90 (ECA)', 'Código Civil, arts. 1.566–1.629'],
    keywords: ['divórcio', 'guarda', 'alimentos', 'casamento', 'pensão'],
    prompt: 'Considere divórcio, guarda, convivência familiar, alimentos e proteção integral de crianças e adolescentes.',
    jurisprudencePrompt: 'Priorize decisões STF/STJ de 2024–2026 sobre divórcio, guarda compartilhada, convivência, alimentos e melhor interesse da criança; indique entendimentos do TJ do estado informado.',
  },
  {
    code: 'direito_trabalhista',
    name: 'Direito Trabalhista',
    description: 'Relações de trabalho, contratos e direitos trabalhistas',
    icon: '👷',
    statutes: ['CLT', 'Lei 8.213/91', 'Orientações Jurisprudenciais do TST'],
    keywords: ['trabalho', 'emprego', 'demissão', 'rescisão', 'salário', 'horas extras'],
    prompt: 'Considere relações de emprego, verbas trabalhistas, contratos, normas da CLT e entendimentos do TST.',
    jurisprudencePrompt: 'Considere decisões TST/STF de 2024–2026 e OJs pertinentes a vínculo, jornada, rescisão e benefícios previdenciários, bem como entendimentos do TRT competente.',
  },
  {
    code: 'direito_civil',
    name: 'Direito Civil',
    description: 'Contratos, responsabilidade civil e sucessões',
    icon: '⚖️',
    statutes: ['Código Civil, arts. 139–280 e 499–570'],
    keywords: ['contrato', 'indenização', 'danos', 'herança', 'sucessão'],
    prompt: 'Considere contratos, obrigações, responsabilidade civil, danos e sucessões.',
    jurisprudencePrompt: 'Considere decisões STF/STJ de 2024–2026 sobre contratos, responsabilidade civil, danos e sucessões, além de precedentes do TJ competente.',
  },
  {
    code: 'direito_imobiliario',
    name: 'Direito Imobiliário',
    description: 'Imóveis, propriedade, locações e condomínio',
    icon: '🏠',
    statutes: ['Lei 8.245/91 (Lei do Inquilinato)', 'Código Civil'],
    keywords: ['imóvel', 'aluguel', 'locação', 'despejo', 'propriedade', 'condomínio'],
    prompt: 'Considere propriedade, posse, locações urbanas, despejo, condomínio e regularização imobiliária.',
    jurisprudencePrompt: 'Considere decisões STF/STJ de 2024–2026 sobre locação, despejo, posse, propriedade e condomínio, e precedentes do TJ competente.',
  },
  {
    code: 'direito_tributario',
    name: 'Direito Tributário',
    description: 'Tributos, impostos e obrigações fiscais',
    icon: '🧾',
    statutes: ['Código Tributário Nacional (Lei 5.172/66)'],
    keywords: ['tributo', 'imposto', 'ICMS', 'PIS', 'COFINS', 'fiscal'],
    prompt: 'Considere competência tributária, obrigações, crédito tributário e tributos como ICMS, PIS e COFINS.',
    jurisprudencePrompt: 'Considere decisões STF/STJ de 2024–2026 sobre ICMS, PIS/COFINS, crédito tributário e obrigações fiscais, além de entendimentos estaduais aplicáveis.',
  },
  {
    code: 'direito_criminal',
    name: 'Direito Criminal',
    description: 'Direito penal, processo penal e defesa',
    icon: '🛡️',
    statutes: ['Código Penal, arts. 1–372', 'Código de Processo Penal'],
    keywords: ['crime', 'prisão', 'acusação', 'defesa', 'inquérito', 'processo penal'],
    prompt: 'Considere tipicidade, garantias da defesa, prova, medidas cautelares e legislação penal e processual penal.',
    jurisprudencePrompt: 'Considere decisões STF/STJ de 2024–2026 sobre garantias da defesa, prova, prisões e medidas cautelares; indique entendimentos do tribunal local sem substituir análise individual do processo.',
  },
  {
    code: 'direito_empresarial',
    name: 'Direito Empresarial',
    description: 'Empresas, sociedades e recuperação judicial',
    icon: '🏢',
    statutes: ['Lei 11.101/05', 'Código Civil'],
    keywords: ['empresa', 'sociedade', 'falência', 'recuperação judicial', 'sócio'],
    prompt: 'Considere sociedades, atividade empresarial, contratos empresariais e recuperação judicial e falência.',
    jurisprudencePrompt: 'Considere decisões STF/STJ de 2024–2026 sobre sociedades, recuperação judicial, falência e contratos empresariais, além de precedentes do TJ competente.',
  },
];

const byCode = new Map(SPECIALIZATIONS.map((specialization) => [specialization.code, specialization]));

export function getSpecialization(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim().toLocaleLowerCase('pt-BR');
  const byNumber = SPECIALIZATIONS[Number(normalized) - 1];
  return byCode.get(normalized)
    || byNumber
    || SPECIALIZATIONS.find((item) => item.name.toLocaleLowerCase('pt-BR') === normalized)
    || null;
}

export function getSpecializationPrompt(value, location) {
  const specialization = getSpecialization(value);
  if (!specialization) return '';

  const localContext = location?.state
    ? `Considere, quando pertinente, regras e precedentes do estado ${location.state}${location.city ? ` (município de ${location.city})` : ''}, sem presumir que exista uma regra local diferente.`
    : 'Pergunte o estado/município quando a jurisdição local puder alterar a resposta.';

  return `\n\nÁREA DE ESPECIALIZAÇÃO DO USUÁRIO: ${specialization.name} (${specialization.code}).
Contexto: ${specialization.prompt}
Referências legislativas relevantes: ${specialization.statutes.join('; ')}.
Jurisprudência a considerar (2024–2026): ${specialization.jurisprudencePrompt}
Ao tratar de jurisprudência STF/STJ atual ou variações estaduais (por exemplo, TJ-SP e TJ-RJ), cite apenas decisões e referências que consiga identificar com segurança; não invente números, datas, ementas nem precedentes. Se não puder verificar uma decisão recente, deixe isso claro e indique consulta a fonte oficial.
${localContext}
Use exemplos práticos hipotéticos, identificando-os como exemplos, e preserve o aviso de que a resposta é educativa e não substitui advogado.`;
}

export function parseSpecializations(value) {
  const selections = String(value || '')
    .split(/[,\n;]/)
    .map((item) => getSpecialization(item))
    .filter(Boolean);
  return [...new Set(selections.map(({ code }) => code))];
}

export function isComplexLegalQuestion(text) {
  const normalized = String(text || '').toLocaleLowerCase('pt-BR');
  return normalized.length >= 180
    || /\b(urgente|prazo|processo|ação judicial|audiência|intimação|liminar|prisão|demissão|despejo|indenização|recurso)\b/.test(normalized);
}
