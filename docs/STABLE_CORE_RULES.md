# REGRAS DO STABLE CORE — DRIVERDASH ROXOU

Este documento estabelece as diretrizes de governança e proteção do código durante a fase de estabilização do DriverDash Roxou. A alteração indevida de arquivos do Core pode causar sérios problemas como perda de dados, erros de telemetria, falha de GPS e problemas de calibração financeira.

---

## 1. Módulos Críticos e Responsabilidades

Abaixo estão listados os arquivos blindados e de alto risco do sistema:

### 1. `src/modules/journey/journey.gps.ts`
* **Classificação:** STABLE CORE — GPS CRÍTICO
* **Responsabilidade:** Gerencia chamadas `watchPosition`, filtros de precisão de coordenadas e ciclo de vida do rastreamento.
* **Riscos:** Perda de rastreamento, travamento do navegador/app, perda de coordenadas válidas em segundo plano.

### 2. `src/modules/journey/journey.calculations.ts`
* **Classificação:** STABLE CORE — CÁLCULOS CRÍTICOS
* **Responsabilidade:** Implementa a fórmula de Haversine, cálculo de distâncias (metros/km), tempo de movimento, tempo parado e métricas financeiras de custo por km.
* **Riscos:** Distorção de quilometragem percorrida, corrupção de valores financeiros e de relatórios semanais/diários.

### 3. `src/modules/journey/telemetrySync.service.ts`
* **Classificação:** STABLE CORE — SINCRONIZAÇÃO CRÍTICA
* **Responsabilidade:** Fila offline persistente, processamento em lote de pontos (`route_points`), mecanismo de retry exponencial e fallback automático.
* **Riscos:** Perda massiva de coordenadas de telemetria, duplicidade de inserções, corrupção de banco de dados ou QuotaExceededError no local storage.

### 4. `src/modules/journey/rideCalibration.service.ts`
* **Classificação:** STABLE CORE — CALIBRAÇÃO E PERSISTÊNCIA
* **Responsabilidade:** Encerramento de corridas, calibração, persistência remota/local e categorização inteligente de falhas do banco de dados (distinguindo problemas de autenticação, permissão, offline real e erros de schema).
* **Riscos:** Falha no salvamento final de corridas calibradas e inconsistências financeiras.

### 5. `src/modules/journey/journeyClassifier.service.ts`
* **Classificação:** STABLE CORE — CLASSIFICAÇÃO INTELIGENTE
* **Responsabilidade:** Classificação de segmentos de corrida, divisão de quilometragem produtiva e vazia, estados de viagem.
* **Riscos:** Classificação errônea de despesas e lucros por km, gerando relatórios imprecisos para o motorista.

### 6. `src/modules/journey/smartRideDetection.service.ts`
* **Classificação:** STABLE CORE — DETECÇÃO AUTOMÁTICA
* **Responsabilidade:** Máquina de estados de detecção em tempo real e detecção automática de embarque e desembarque.
* **Riscos:** Interrupção do recurso de "mãos livres" ou detecções incorretas que distorcem o fluxo normal de trabalho.

### 7. `src/modules/journey/roadMatching.service.ts`
* **Classificação:** CORE SENSÍVEL — TRATAMENTO DE TRAJETO
* **Responsabilidade:** Filtros de ruído de GPS e interpolação de rotas através da API de estradas.
* **Riscos:** Distorção visual dos trajetos ou cálculos imprecisos de posicionamento no mapa.

### 8. `src/modules/journey/journey.hooks.tsx`
* **Classificação:** ORQUESTRADOR CRÍTICO
* **Responsabilidade:** Controle de sessões de jornada do motorista, listeners de geolocalização e limpeza de estados internos.
* **Riscos:** Travamento de sessão ativa, falha na inicialização ou no encerramento da jornada do motorista.

### 9. `src/pages/JornadaPage.tsx`
* **Classificação:** ARQUIVO ALTAMENTE SENSÍVEL — UI + ORQUESTRAÇÃO
* **Responsabilidade:** Concentra a maior interface operacional do motorista (mapa, botões de ação rápida, resumos).
* **Riscos:** Erros na renderização, quebra nos fluxos de confirmação e alta probabilidade de regressões devido ao alto acoplamento de handlers e estados.

### 10. `src/context/AppContext.tsx`
* **Classificação:** ORQUESTRADOR GLOBAL SENSÍVEL
* **Responsabilidade:** Estado compartilhado centralizado do aplicativo (auth, dados financeiros, veículos).
* **Riscos:** Inoperabilidade geral do aplicativo em múltiplas telas por re-renders ou inconsistência de estado global.

---

## 2. Regras Estritas para Alterações futuras

Durante a fase de estabilização, **qualquer alteração nos arquivos acima está proibida**, exceto sob as seguintes regras obrigatórias:

1. **Sem Refatoração Oportunista:** Nunca mude a estrutura do código, nomes de funções, propriedades ou contratos para deixá-lo "mais bonito" ou "mais limpo".
2. **Diagnóstico Primeiro:** Antes de tocar em qualquer linha de código, o bug deve ser reproduzido e sua causa raiz identificada e detalhada de forma técnica.
3. **Mínimo Impacto Técnico:** O patch de correção deve alterar o menor número de linhas possível para sanar estritamente o problema identificado.
4. **Verificação Dupla Completa:** Após qualquer correção, é obrigatório executar:
   - `npm run lint` (ou verificação de tipos via `tsc --noEmit`)
   - `npm run build` (para testar compatibilidade de produção)

---

## 3. Matriz de Risco de Regressão

| Módulo/Serviço | Classificação de Risco | Impacto de Falha |
|---|---|---|
| Rastreamento GPS (`journey.gps.ts`) | **CRÍTICO** | Perda total de rastreamento do motorista |
| Fila Offline & Sync (`telemetrySync.service.ts`) | **CRÍTICO** | Perda irreversível de dados de viagem |
| Calibração de Corridas (`rideCalibration.service.ts`) | **ALTO** | Falha de salvamento ou corrupção financeira |
| Interface de Jornada (`JornadaPage.tsx`) | **ALTO** | Interface de usuário inoperável ou travada |
| Estado Global (`AppContext.tsx`) | **ALTO** | Pane generalizada e quebra em cascata no app |
| Classificador de KM (`journeyClassifier.service.ts`) | **MÉDIO** | Estatísticas de km produtivo incorretas |
| Detecção Automática (`smartRideDetection.service.ts`) | **MÉDIO** | Comportamento imprevisível da IA de detecção |
| Snap to Road (`roadMatching.service.ts`) | **BAIXO** | Ruído visual ou rotas ligeiramente desalinhadas |

---

## 4. Plano de Trabalho de Modularização (Futuro)

Apenas quando a fase de estabilização for concluída, o projeto seguirá as seguintes etapas recomendadas para modularização segura:

* **Etapa 1:** Fixação de documentações protetivas e inserção de cabeçalhos de blindagem (Concluído).
* **Etapa 2:** Extração de helpers e tipos de negócios para arquivos isolados (por exemplo, desacoplar os tipos de `AppContext.tsx`).
* **Etapa 3:** Separação estrita de Handlers da UI (mover manipuladores de eventos pesados de `JornadaPage.tsx` para Custom Hooks ou State Machines).
* **Etapa 4:** Migração de lógicas e validações matemáticas complexas para domínios específicos de cálculo puro e testável.
* **Etapa 5:** Isolação completa dos adapters de Storage (local, session ou IndexedDB) e Sync (Supabase), permitindo mocks robustos.
* **Etapa 6:** Escrita e execução de testes automatizados de regressão focados no motor de telemetria e calibração de rotas.
