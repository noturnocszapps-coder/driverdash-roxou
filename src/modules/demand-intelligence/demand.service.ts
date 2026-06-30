import { RegionDemandData, DemandRecommendation, UpcomingEvent } from './demand.types';

const PP_REGIONS: Omit<RegionDemandData, 'score' | 'demandLevel' | 'emptyRunRisk' | 'rideChance' | 'returnChance'>[] = [
  {
    name: 'Centro',
    bestTime: '08:00 - 19:00',
    tip: 'Concentração de escritórios, bancos e comércio tradicional. Giro muito rápido.',
    isPeripheral: false
  },
  {
    name: 'Parque do Povo',
    bestTime: '17:00 - 22:00',
    tip: 'Bares, restaurantes, academias e pistas de caminhada. Ideal para início de noite.',
    isPeripheral: false
  },
  {
    name: 'Prudenshopping',
    bestTime: '10:00 - 22:00',
    tip: 'Grande fluxo de passageiros nas entradas principais e praça de alimentação.',
    isPeripheral: false
  },
  {
    name: 'Jardim Bongiovani',
    bestTime: '11:00 - 23:00',
    tip: 'Região universitária e médica. Bastante movimento de estudantes e profissionais.',
    isPeripheral: false
  },
  {
    name: 'Jardim Aviação',
    bestTime: '07:00 - 18:00',
    tip: 'Clínicas médicas e escritórios. Ótimo para corridas curtas e médias de alto padrão.',
    isPeripheral: false
  },
  {
    name: 'Vila Industrial',
    bestTime: '06:00 - 18:00',
    tip: 'Região comercial e industrial leve. Movimento forte de trabalhadores.',
    isPeripheral: false
  },
  {
    name: 'Cidade Universitária',
    bestTime: '07:00 - 22:30',
    tip: 'Estudantes da Unoeste e comércios adjacentes. Alta demanda em horários de aula.',
    isPeripheral: false
  },
  {
    name: 'Ana Jacinta',
    bestTime: '06:00 - 09:00',
    tip: 'Bairro residencial populoso. Altíssima demanda de manhã, risco de retorno vazio à noite.',
    isPeripheral: true
  },
  {
    name: 'Brasil Novo',
    bestTime: '05:30 - 08:30',
    tip: 'Extremo norte residencial. Ótimo para levar pessoas ao centro pela manhã.',
    isPeripheral: true
  },
  {
    name: 'Cohab',
    bestTime: '06:00 - 14:00',
    tip: 'Área residencial densa. Bom fluxo de idas e vindas de trabalhadores.',
    isPeripheral: true
  },
  {
    name: 'Montalvão',
    bestTime: '07:00 - 15:00',
    tip: 'Distrito industrial e chácaras. Cuidado com o retorno vazio nas viagens para cá.',
    isPeripheral: true
  },
  {
    name: 'Álvares Machado',
    bestTime: '06:00 - 09:00',
    tip: 'Cidade satélite integrada. Excelente para conexões metropolitanas matinais.',
    isPeripheral: true
  },
  {
    name: 'Regente Feijó',
    bestTime: '06:00 - 10:00',
    tip: 'Grande movimentação em direção a Presidente Prudente pela rodovia.',
    isPeripheral: true
  }
];

export const demandIntelligenceService = {
  /**
   * Calculates the demand metrics for a specific date and time (simulates actual operational hour checks)
   */
  getRegionsDemand(currentHour: number): RegionDemandData[] {
    const isPeakWindow = currentHour >= 17 && currentHour <= 20;

    return PP_REGIONS.map(reg => {
      let score = 50;
      let demandLevel: 'alta' | 'media' | 'baixa' = 'media';
      let emptyRunRisk: 'good' | 'attention' | 'risk' = 'attention';
      let rideChance = '65%';
      let returnChance = '60%';

      if (isPeakWindow) {
        // Peak hours logic (17h - 20h)
        if (['Centro', 'Parque do Povo', 'Prudenshopping'].includes(reg.name)) {
          score = 94 + Math.floor(Math.random() * 5); // 94-98
          demandLevel = 'alta';
          emptyRunRisk = 'good';
          rideChance = '98%';
          returnChance = '95%';
        } else if (['Jardim Bongiovani', 'Cidade Universitária'].includes(reg.name)) {
          score = 82 + Math.floor(Math.random() * 6); // 82-87
          demandLevel = 'alta'; // Média/Alta
          emptyRunRisk = 'good';
          rideChance = '88%';
          returnChance = '80%';
        } else if (reg.isPeripheral) {
          score = 35 + Math.floor(Math.random() * 10); // 35-45
          demandLevel = 'baixa';
          emptyRunRisk = 'risk';
          rideChance = '40%';
          returnChance = '30%';
        } else {
          // Other central/intermediate regions
          score = 65 + Math.floor(Math.random() * 10);
          demandLevel = 'media';
          emptyRunRisk = 'attention';
          rideChance = '70%';
          returnChance = '65%';
        }
      } else {
        // Standard hours logic
        if (reg.name === 'Centro') {
          score = 80;
          demandLevel = 'alta';
          emptyRunRisk = 'good';
          rideChance = '85%';
          returnChance = '85%';
        } else if (reg.isPeripheral) {
          score = 45;
          demandLevel = 'media';
          emptyRunRisk = 'attention';
          rideChance = '55%';
          returnChance = '45%';
        } else {
          score = 60;
          demandLevel = 'media';
          emptyRunRisk = 'good';
          rideChance = '70%';
          returnChance = '70%';
        }
      }

      return {
        ...reg,
        score,
        demandLevel,
        emptyRunRisk,
        rideChance,
        returnChance
      };
    }).sort((a, b) => b.score - a.score);
  },

  /**
   * Identifies the absolute best region right now and reasons
   */
  getBestRecommendation(currentHour: number): DemandRecommendation {
    const isPeakWindow = currentHour >= 17 && currentHour <= 20;

    if (isPeakWindow) {
      return {
        bestRegion: 'Parque do Povo & Centro',
        score: 97,
        reason: 'O pico das 18h concentra a saída de escritórios no Centro e a movimentação para bares/lazer no Parque do Povo e Prudenshopping.',
        practicalTip: 'Foque em aceitar corridas que conectem a zona central a esses polos para manter o giro ativo sem rodar sem passageiro.'
      };
    }

    return {
      bestRegion: 'Centro',
      score: 82,
      reason: 'Região central concentra o maior fluxo comercial e bancário durante o horário padrão de funcionamento.',
      practicalTip: 'Posicione-se próximo a calçadões ou eixos comerciais de grande movimento.'
    };
  },

  /**
   * Future integrations pipeline preparation. Returns upcoming external events affecting demand
   */
  getUpcomingEvents(): UpcomingEvent[] {
    return [
      {
        id: 'evt-1',
        title: 'Festa Universitária InterPrudente',
        category: 'show',
        location: 'Recinto de Exposições Jacob Tosello',
        time: 'Sábado a partir das 21:00',
        expectedDemand: 'alta',
        description: 'Mais de 5.000 estudantes universitários. Previsão de tarifa dinâmica agressiva.'
      },
      {
        id: 'evt-2',
        title: 'Frente Fria e Chuva Moderada',
        category: 'weather',
        location: 'Presidente Prudente e Região',
        time: 'Hoje das 17:30 às 22:00',
        expectedDemand: 'alta',
        description: 'Aumento repentino de 40% na demanda por transporte de passageiros em curtas distâncias.'
      },
      {
        id: 'evt-3',
        title: 'Desembarques da Tarde',
        category: 'bus',
        location: 'Terminal Rodoviário',
        time: 'Diariamente entre 16:00 e 19:00',
        expectedDemand: 'media',
        description: 'Chegada de ônibus intermunicipais de São Paulo, Londrina e Maringá.'
      }
    ];
  }
};
