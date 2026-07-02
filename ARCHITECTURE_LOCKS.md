# ARCHITECTURE LOCKS - DRIVERDASH ROXOU
Este documento registra o congelamento de arquitetura dos módulos estáveis do **DriverDash Roxou** para evitar regressões, quebras de sincronização, ou corrupção de dados operacionais e de telemetria.

---

## 1. MÓDULOS CONGELADOS (PROTEGIDOS)
Os seguintes módulos foram auditados e classificados como **ESTÁVEIS**. Qualquer alteração nestas lógicas é **estritamente proibida** sem autorização expressa:

### 🛰️ GPS Core & watchPosition
* **Arquivos Sensíveis**: `/src/modules/journey/journey.gps.ts`
* **Funções Críticas**: `gpsTracker.watchPosition`, `gpsTracker.clearWatch`, `gpsTracker.checkPermission`
* **Responsabilidade**: Interface nativa com a API de Geolocalização do Navegador. Opera em altíssima precisão (`enableHighAccuracy: true`), controle estrito de cache (`maximumAge: 0`) e tratamento de timeout.
* **Risco de Regressão**: **CRÍTICO / ALTO**. Alterações aqui podem interromper o rastreamento em segundo plano ou causar perda de precisão de quilometragem.

### 📐 Cálculos de KM & Haversine
* **Arquivos Sensíveis**: `/src/modules/journey/journey.calculations.ts`, `/src/pages/JornadaPage.tsx`
* **Funções Críticas**: `calculateDistanceBetweenPoints` (Haversine), `calculateTotalSessionDistance`, `reconstructJourneyFromPoints`
* **Responsabilidade**: Fórmulas matemáticas puras para calcular distâncias geodésicas na superfície da Terra e reconstrução de jornada com alta fidelidade financeira e de quilometragem.
* **Risco de Regressão**: **ALTO**. Erros de arredondamento ou alteração na fórmula invalidam os cálculos de custo por KM, lucros e relatórios para a contabilidade dos motoristas.

### 🔄 Sincronização Telemetria & driver_ride_logs
* **Arquivos Sensíveis**: `/src/modules/journey/telemetrySync.service.ts`, `/src/modules/journey/journeyClassifier.service.ts`
* **Funções Críticas**: `TelemetrySyncService.queuePoint`, `TelemetrySyncService.sync`, `TelemetrySyncService.finalFlushBeforeEnd`, `getCurrentSegment`
* **Responsabilidade**: Mecanismo de sincronização offline resiliente. Organiza pontos de GPS em lotes de 30, implementa Backoff Linear com Cooldowns locais, remove duplicatas e faz o flush limpo do buffer no encerramento de jornada.
* **Risco de Regressão**: **CRÍTICO / ALTO**. Falhas de sincronização podem causar sobrecarga de banco (Supabase) ou perda de pontos de trajeto dos motoristas durante períodos offline.

### 🏁 Fluxo da Corrida (Finalizar / Cancelar / Calibração IA)
* **Arquivos Sensíveis**: `/src/modules/journey/rideCalibration.service.ts`, `/src/pages/JornadaPage.tsx`
* **Funções Críticas**: `handleConfirmCancelRide`, `handleConfirmEndJourney`, `persistCalibratedRide`, `validateRideData`
* **Responsabilidade**: Registro manual de dados contextuais das corridas, endereços, plataforma, valores, clima e cálculo automático de tempos de embarque/desembarque para treinamento do modelo preditivo de IA.
* **Risco de Regressão**: **ALTO**. Mudanças no salvamento ou no fluxo de states podem travar o modal de encerramento seguro ou falhar ao fechar a corrida em modo offline.

---

## 2. MAPA DE CAMADAS DE ARQUITETURA

O sistema está estritamente particionado em 4 camadas de responsabilidade isoladas. Mudanças em uma camada **nunca** devem vazar efeitos colaterais para camadas anteriores:

```
┌────────────────────────────────────────────────────────┐
│                      ANALYTICS                         │ (IA, Insights, Relatórios, IA Predictive)
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│                          UI                            │ (Modais, Cards, RealTimeTrackerMap, Leaflet)
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│                         FLOW                           │ (Eventos da Corrida, Embarque, Cancelar, Encerrar)
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│                         CORE                           │ (GPS, Haversine, TelemetrySync, Supabase)
└────────────────────────────────────────────────────────┘
```

### Regras de Ouro de Isolamento:
1. **Mudanças de UI não podem alterar CORE**: Refatorar componentes visuais, alterar cores de mapa ou layout de cards nunca deve influenciar variáveis de estado de rastreamento de GPS ou persistência local.
2. **Mudanças de Analytics não podem alterar FLOW**: Módulos que computam estatísticas de IA ou geram relatórios consolidados trabalham de forma reativa a partir dos dados persistidos; eles nunca devem interceptar ou pausar o ciclo de vida ativo de uma corrida.
3. **Mudanças de Dashboard não podem alterar GPS**: O dashboard financeiro ou histórico lê bancos de dados locais e remotos; ele não pode desligar ou reiniciar o watcher do GPS de segundo plano.

---

## 3. CHECKLIST OBRIGATÓRIO DE PRÉ-ALTERAÇÃO

Antes de abrir qualquer arquivo listado como sensível, responda à este checklist:

- [ ] A alteração solicitada altera alguma lógica matemática de distância (Haversine)? *(Se sim, rejeitar ou testar exaustivamente em ambiente controlado).*
- [ ] O componente sendo modificado possui a anotação `// STABLE CORE - NÃO ALTERAR SEM AUTORIZAÇÃO EXPLÍCITA`?
- [ ] A mudança afeta o fluxo de states de persistência local ou chamadas do Supabase em modo Offline?
- [ ] Foi verificado se o linter (`npm run lint`) e o build (`npm run build`) continuam passando sem nenhum erro de tipagem no TypeScript?

---

## 4. CHECKLIST DE TESTES MANUAIS DE VALIDAÇÃO

Para assegurar que o núcleo protegido do aplicativo permanece intacto, execute os seguintes testes no ambiente de Preview sempre que alterações forem feitas em áreas adjacentes:

### Teste 1: Fluxo de Jornada e Rastreamento
1. Acesse `/jornada` e inicie uma jornada de trabalho.
2. Verifique se o indicador de status do GPS fica ativo e se as coordenadas são mockadas/lidas de forma contínua.
3. Verifique se o hodômetro de KM hoje começa a incrementar conforme a telemetria é gerada.

### Teste 2: Início, Passageiro a Bordo e Finalização de Corrida
1. Durante a jornada ativa, clique em **"Iniciar Corrida"**.
2. Preencha os dados de origem, destino estimados e clique em confirmar.
3. Clique em **"Passageiro Embarcou"** para registrar o timestamp de embarque.
4. Clique em **"Finalizar Corrida"** e insira os dados reais consolidados para a calibração de IA.
5. Confirme e verifique se o modal fecha corretamente, gerando o log de corrida no painel inferior.

### Teste 3: Cancelamento de Corrida Seguro
1. Inicie uma nova corrida.
2. Clique em **"Cancelar Corrida"** no painel de controle.
3. Escolha o motivo do cancelamento e confirme.
4. Verifique se o estado da corrida é resetado, liberando o mapa em tempo real e gravando o log correspondente no histórico.

### Teste 4: Sincronização Offline e Encerramento Seguro de Jornada
1. Clique em **"Encerrar Jornada"**.
2. O sistema apresentará a tela de sincronização obrigatória dos pontos de telemetria pendentes.
3. Aguarde a sincronização de todos os pontos locais antes de finalizar a sessão.
4. Verifique se a jornada encerra e os relatórios financeiros re-calculam corretamente no Dashboard.
