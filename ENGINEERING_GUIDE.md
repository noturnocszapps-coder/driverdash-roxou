# Guia de Engenharia - DriverDash Roxou

Bem-vindo ao Guia de Engenharia oficial do DriverDash Roxou. Este documento detalha as convenções de código, estrutura de pastas, padrões de importação e as diretrizes arquiteturais para manter o projeto livre de bugs e regressões.

---

## 1. Estrutura de Diretórios e Nomenclatura

O projeto adota uma estrutura modular focada em separação de preocupações (Separation of Concerns).

```
/src
  ├── components         # Componentes compartilhados globais de UI (ex: botões, modais)
  ├── context            # Provedores de estado globais (ex: Auth, Toast)
  ├── modules            # Módulos de domínio autocontidos (Regra de Ouro da Arquitetura)
  │     └── journey/     # Exemplo: Módulo de Jornada de Corrida
  ├── pages              # Telas inteiras mapeadas por rotas (ex: JornadaPage, DashboardPage)
  ├── services           # Serviços auxiliares de comunicação de infraestrutura global
  ├── types.ts           # Definições de tipos e enums globais do TypeScript
  └── utils              # Helpers puros e utilitários matemáticos/geográficos
```

### Regras de Nomenclatura de Arquivos:
- **Páginas**: `NomeCompletoPage.tsx` (ex: `JornadaPage.tsx`) - PascalCase terminando em `Page`.
- **Componentes**: `NomeComponente.tsx` (ex: `CardFinanceiro.tsx`) - PascalCase puro.
- **Serviços**: `nomeServico.service.ts` (ex: `telemetrySync.service.ts`) - camelCase com sufixo `.service`.
- **Hooks**: `useNomeHook.ts(x)` (ex: `useJourney.ts`) - camelCase com prefixo `use`.
- **Arquivos auxiliares/Tipos**: `nome.types.ts` ou `nome.utils.ts` (ex: `journey.types.ts`).

---

## 2. Como Criar Novos Elementos

### 📂 Como Criar um Novo Módulo
Ao criar um novo domínio (ex: `vehicle-maintenance` ou `driver-score`):
1. Crie uma subpasta em `/src/modules/nome-modulo`.
2. Adicione os seguintes arquivos conforme necessário:
   - `nomeModulo.service.ts` (para regras de negócio e chamadas à API).
   - `nomeModulo.types.ts` (para interfaces de dados).
   - `nomeModulo.hooks.ts` (para hooks encapsulando estados reativos).
3. **NÃO vaze estados internos do módulo**. Exponha apenas o necessário através do arquivo de hooks ou service.

### 📄 Como Criar uma Nova Página
1. Crie o arquivo na pasta `/src/pages/NomePage.tsx`.
2. Use **Function Components** estruturados com TypeScript.
3. Evite colocar regras complexas de persistência ou rede diretamente na página; delegue isso a hooks e services.
4. Caso a página exiba mapas ou gráficos complexos, separe-os em componentes menores na pasta de componentes do módulo ou de UI global.

### ⚙️ Como Criar um Novo Serviço
1. Crie o arquivo na pasta do módulo correspondente (`modulo.service.ts`).
2. Documente o cabeçalho explicitando a finalidade e dependências de rede.
3. Sempre trate erros localmente lançando exceções limpas e detalhadas (`throw new Error(...)`) para que a UI possa exibi-las em Toasts ou alertas apropriados.
4. Serviços que realizam chamadas remotas de escrita de dados devem suportar redundância local de LocalStorage se puderem ser chamados em trânsito (offline).

### 🪝 Como Criar um Novo Hook
1. Crie hooks com o prefixo `use` (ex: `useLiveLocation.tsx`).
2. Utilize `useEffect` com dependências estritas de tipos primitivos (evite arrays/objetos literais que provocam loops infinitos de render).
3. Retorne estados e callbacks limpos e protegidos de mutabilidade indesejada.

---

## 3. Padrão de Organização de Imports

Mantenha os imports ordenados de fora para dentro para facilitar a leitura dos arquivos:

```typescript
// 1. Bibliotecas externas e frameworks (React, Framer Motion, Lucide, etc.)
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Play, Square, Activity } from 'lucide-react';

// 2. Componentes e contexts compartilhados globais
import { useToast } from '../context/ToastContext';
import { BaseCard } from '../components/BaseCard';

// 3. Módulos e subcomponentes locais do domínio
import { TelemetrySyncService } from './modules/journey/telemetrySync.service';
import { calculateDistanceBetweenPoints } from './modules/journey/journey.calculations';

// 4. Interfaces, types e enums
import { RoutePoint, DriverSession } from './modules/journey/journey.types';
```

---

## 4. Como Documentar Código

Qualquer nova função ou classe deve receber documentação JSDoc clara, facilitando o autocompletar e a auditoria de código futuro:

```typescript
/**
 * Calcula o custo total estimado da viagem com base na quilometragem e combustível.
 * 
 * @param distanceKm - Distância percorrida em quilômetros.
 * @param fuelConsumption - Consumo médio do veículo (km por litro).
 * @param fuelPrice - Preço atual do combustível por litro.
 * @returns O custo estimado da viagem em Reais (BRL).
 */
export function estimateTripCost(
  distanceKm: number,
  fuelConsumption: number,
  fuelPrice: number
): number {
  if (fuelConsumption <= 0) return 0;
  return (distanceKm / fuelConsumption) * fuelPrice;
}
```

---

## 5. Regras Importantes de Segurança e Design
- **Sem API Keys expostas**: Chaves sensíveis de produção nunca devem constar nos arquivos front-end. Devem estar em variáveis de ambiente `.env` e ser acessadas pelo back-end ou proxy seguro.
- **Não altere arquivos rotulados como `STABLE CORE`**: Arquivos com este aviso no topo possuem garantia operacional estabelecida de telemetria e GPS. Alterações neles demandam validações em sandbox e revisão exaustiva.
