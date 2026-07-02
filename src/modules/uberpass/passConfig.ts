/**
 * UberPass Configuration Constants
 * Module: UberPass (uberpass)
 * STABLE - Easy to edit values for passes
 */

export interface UberPassOption {
  id: string;
  name: string;
  type: 'time' | 'earnings';
  price: number;
  durationHours?: number; // for time based passes
  earningsLimit?: number; // for earnings based passes
  description: string;
}

export const UBER_PASS_OPTIONS: UberPassOption[] = [
  {
    id: 'pass_24h',
    name: 'Passe 24h',
    type: 'time',
    price: 40.0,
    durationHours: 24,
    description: 'Acesso por 24 horas consecutivas.'
  },
  {
    id: 'pass_72h',
    name: 'Passe 72h',
    type: 'time',
    price: 106.0,
    durationHours: 72,
    description: 'Acesso por 72 horas consecutivas.'
  },
  {
    id: 'pass_earnings_333',
    name: 'Passe Ganhos R$333',
    type: 'earnings',
    price: 104.0,
    earningsLimit: 333.0,
    description: 'Isenção de taxa para até R$ 333 em faturamento.'
  },
  {
    id: 'pass_earnings_984',
    name: 'Passe Ganhos R$984',
    type: 'earnings',
    price: 291.0,
    earningsLimit: 984.0,
    description: 'Isenção de taxa para até R$ 984 em faturamento.'
  }
];
