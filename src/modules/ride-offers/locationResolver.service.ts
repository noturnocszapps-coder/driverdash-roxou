/**
 * Location Resolver Service for Ride Offers
 * Normalizes source/destination text and identifies neighborhoods/cities in Presidente Prudente & region.
 */

export interface NeighborhoodInfo {
  name: string;
  riskLabel: 'Baixo' | 'Médio' | 'Atenção' | 'Desconhecido';
  city: string;
  keywords: string[];
}

const KNOWN_NEIGHBORHOODS: NeighborhoodInfo[] = [
  { name: 'Centro', riskLabel: 'Baixo', city: 'Presidente Prudente', keywords: ['centro', 'praca da bandeira', 'calcadao', 'av brasil', 'marcondes'] },
  { name: 'Vila Industrial', riskLabel: 'Médio', city: 'Presidente Prudente', keywords: ['vila industrial', 'industrial', 'estacao', 'militao'] },
  { name: 'Jardim Bongiovani', riskLabel: 'Baixo', city: 'Presidente Prudente', keywords: ['bongiovani', 'jardim bongiovani', 'unoeste campus 1', 'mendes de moraes'] },
  { name: 'Jardim Paulista', riskLabel: 'Baixo', city: 'Presidente Prudente', keywords: ['paulista', 'jardim paulista', 'santa casa', 'av bady'] },
  { name: 'Jardim Aviação', riskLabel: 'Baixo', city: 'Presidente Prudente', keywords: ['aviacao', 'jardim aviacao', 'aeroporto viejo', 'santa casa'] },
  { name: 'Parque do Povo', riskLabel: 'Baixo', city: 'Presidente Prudente', keywords: ['parque do povo', 'av 11 de maio', 'av 14 de setembro', 'povo'] },
  { name: 'Cohab', riskLabel: 'Médio', city: 'Presidente Prudente', keywords: ['cohab', 'cohab 1', 'cohab 2', 'anamaria', 'ana maria'] },
  { name: 'Ana Jacinta', riskLabel: 'Atenção', city: 'Presidente Prudente', keywords: ['ana jacinta', 'conjunto ana jacinta', 'mario amato', 'regina', 'bairro ana jacinta'] },
  { name: 'Brasil Novo', riskLabel: 'Atenção', city: 'Presidente Prudente', keywords: ['brasil novo', 'bairro brasil novo', 'parque de feiras'] },
  { name: 'Montalvão', riskLabel: 'Médio', city: 'Presidente Prudente', keywords: ['montalvao', 'distrito de montalvao', 'vila montalvao'] },
  { name: 'Álvares Machado', riskLabel: 'Médio', city: 'Álvares Machado', keywords: ['alvares machado', 'machado', 'parque dos pinheiros', 'machadao'] },
  { name: 'Regente Feijó', riskLabel: 'Médio', city: 'Regente Feijó', keywords: ['regente feijo', 'regente', 'feijo', 'portal do sol'] },
];

/**
 * Normalizes input text by converting to lowercase, removing accents and trimming
 */
export function normalizeLocationText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .trim();
}

/**
 * Extracts a known neighborhood from text
 */
export function extractNeighborhoodFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const normalized = normalizeLocationText(text);

  for (const item of KNOWN_NEIGHBORHOODS) {
    for (const kw of item.keywords) {
      if (normalized.includes(kw)) {
        return item.name;
      }
    }
  }

  // Fallback heuristic: find patterns like "Bairro XXX" or "Jardim XXX" or "Vila XXX"
  const patterns = [
    /jardim\s+([a-zA-Z\u00C0-\u017F]+)/i,
    /vila\s+([a-zA-Z\u00C0-\u017F]+)/i,
    /parque\s+([a-zA-Z\u00C0-\u017F]+)/i,
    /cohab\s+([a-zA-Z0-9\u00C0-\u017F]+)/i,
    /residencial\s+([a-zA-Z\u00C0-\u017F]+)/i
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match && match[0]) {
      // Capitalize nicely
      return match[0]
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
  }

  return null;
}

/**
 * Extracts city from text, defaults to Presidente Prudente
 */
export function extractCityFromText(text: string | null | undefined): string | null {
  if (!text) return 'Presidente Prudente';
  const normalized = normalizeLocationText(text);

  if (normalized.includes('alvares machado') || normalized.includes('machado')) {
    return 'Álvares Machado';
  }
  if (normalized.includes('regente feijo') || normalized.includes('regente')) {
    return 'Regente Feijó';
  }
  if (normalized.includes('pirapozinho')) {
    return 'Pirapozinho';
  }
  if (normalized.includes('alvares machado')) {
    return 'Álvares Machado';
  }

  return 'Presidente Prudente';
}

/**
 * Resolves a neighborhood's risk level and city info
 */
export function resolveKnownNeighborhood(text: string | null | undefined): {
  name: string;
  isKnown: boolean;
  riskLabel: 'Baixo' | 'Médio' | 'Atenção' | 'Desconhecido';
  city: string;
} {
  const extracted = extractNeighborhoodFromText(text);
  if (!extracted) {
    return {
      name: text || 'Desconhecido',
      isKnown: false,
      riskLabel: 'Desconhecido',
      city: extractCityFromText(text) || 'Presidente Prudente'
    };
  }

  const found = KNOWN_NEIGHBORHOODS.find(n => n.name === extracted);
  if (found) {
    return {
      name: found.name,
      isKnown: true,
      riskLabel: found.riskLabel,
      city: found.city
    };
  }

  return {
    name: extracted,
    isKnown: false,
    riskLabel: 'Desconhecido',
    city: extractCityFromText(text) || 'Presidente Prudente'
  };
}

/**
 * Directly returns risk label for a neighborhood name
 */
export function getNeighborhoodRiskLabel(neighborhood: string | null | undefined): 'Baixo' | 'Médio' | 'Atenção' | 'Desconhecido' {
  if (!neighborhood) return 'Desconhecido';
  const found = KNOWN_NEIGHBORHOODS.find(n => n.name.toLowerCase() === neighborhood.toLowerCase());
  return found ? found.riskLabel : 'Desconhecido';
}
