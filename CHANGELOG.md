# Changelog - DriverDash Roxou

Todas as mudanças e entregas importantes do DriverDash Roxou serão registradas neste arquivo.

## [v0.9.1-beta] - 2026-07-02

### Analytics & Copilot (Copiloto Inteligente do Motorista)
- **Motor de Recomendação UberPass**: Criado recomendador baseado no cruzamento de custos, faturamento acumulado por hora, dias trabalhados e projeção mensal de ganhos com taxa zero.
- **Motor de Hábitos e Padrões (driverHabitsEngine)**: Desenvolvimento de analisador de rotina baseado no histórico local (`ride_logs`). Mapeia os períodos do dia mais lucrativos, velocidade média por turno e bairros campeões de ticket médio.
- **Detecção de Risco de Retorno Vazio**: Algoritmo preditivo que analisa se destinos comuns resultam em trajetos ociosos, gerando insights estratégicos para recusa de corridas ineficientes.
- **Classificação Dinâmica de Contexto Espacial**: Alertas inteligentes integrados para proximidade de aeroportos, rodovias de deslocamento rápido, shopping centers, universidades centrais e polos noturnos/bares.
- **Cruzamento de Trânsito Ativo**: Alerta automático quando o veículo trafega abaixo de 15 km/h na região central durante horários de pico comercial (17h - 19h).
- **Indicador de Confiança IA**: Selo visual que calcula dinamicamente a consistência estatística das recomendações de acordo com o histórico acumulado (Alta confiança se >= 50 corridas, Média se >= 10, e Preliminar/Baixa abaixo de 10).
- **Simulador de Passes Integrado**: Planilha interativa expansível integrada que compara o preço, custo por hora, custo por dia e economia estimada de cada passe Uber (24h, 72h, Ganhos 333 e Ganhos 984), destacando automaticamente a melhor opção.

## [v0.9.0-beta] - 2026-07-02

### Core (Núcleo Estabilizado)
- **GPS Estabilizado**: Implementação robusta baseada em alta precisão e geolocalização do navegador.
- **WatchPosition Revisado**: Configuração nativa de intervalo, cache limpo (`maximumAge: 0`) e gerenciamento de permissões resiliente.
- **Haversine Validado**: Integração de algoritmos puros para medição de distância geodésica ponto a ponto sem ruídos.
- **Rastreamento em Tempo Real**: Renderização dinâmica de trajetos sobrepostos e centralização automática no mapa.
- **Telemetria Estabilizada**: Agrupamento em buffer local e controle de fila FIFO para evitar gargalos de memória.
- **Offline Sync (Sincronização Resiliente)**: Transmissão em lote de 30 registros com Backoff Linear, fila de re-tentativa e Cooldown configurado.
- **Ride Logs**: Histórico robusto em local storage persistido reativamente sob falhas no banco.
- **Road Matching**: Integração com API de Snap-to-Road (Google Roads) via proxy seguro Express para suavização de trajetórias.
- **Encerramento Seguro de Jornada**: Processo automatizado de flush síncrono final dos logs pendentes antes do logout ou encerramento da jornada do motorista.

### Flow (Fluxo Operacional)
- **Aceitar Corrida**: State machine estruturada para inicializar e configurar o início do trajeto de corrida.
- **Passageiro Embarcou**: Captura e gravação instantânea do timestamp exato de embarque para cálculo preditivo do tempo de espera.
- **Finalizar Corrida**: Coleta de dados reais pós-corrida (quilometragem final, plataforma, valor faturado, gorjeta, clima) para treinamento do cérebro da IA.
- **Cancelar Corrida**: Opção de cancelamento seguro com preenchimento do motivo, redefinição de estado, desbloqueio do mapa e salvamento local/remoto para calibração.
- **Editar Corrida**: Ajuste de dados históricos de corridas diretamente na listagem de logs.
- **Encerrar Jornada**: Bloqueio de novos pontos, encerramento de wake locks e sincronização obrigatória remanescente.

### UI (Rhythm & Design System)
- **Dashboard Simplificado**: Layout clean focado nas principais métricas operacionais do dia.
- **Jornada Redesenhada**: Interface de acompanhamento rica com transições de tela fluidas e contraste elevado.
- **Modais Revisados**: Diálogos informativos para finalização de corrida, cancelamento e confirmação de encerramento de jornada.
- **Tracker em Tempo Real**: Mapa com atualização em tempo real baseado em Leaflet, com marcadores e linhas de rota customizadas.
- **Heatmap (Mapa de Calor)**: Visualização rica de alta densidade indicando áreas quentes de demanda e maior faturamento para o motorista.
- **Cards Executivos**: Bento-grid elegante com estatísticas-chave como ganho líquido por hora, custo por KM, e média de lucros.

### Analytics (Módulos Inteligentes)
- **IA de Calibração**: Motor que analisa desvios entre valores estimados e dados reais para refinar a calibração do algoritmo de previsão.
- **IA de Demanda**: Sugestão preditiva de pontos quentes de passageiros com base em fatores temporais e geográficos.
- **IA Preditiva**: Alertas inteligentes automatizados sugerindo paradas, abastecimento ou mudança de rota.
- **Dashboard Financeiro**: Análise profunda com gráficos Recharts integrados de lucro líquido diário e divisão por plataforma (Uber, 99, Indrive).
- **Insights**: Geração dinâmica de cartões de recomendação operacional baseados no comportamento de corrida do motorista.

### Correções Importantes
- **Sobreposição do Leaflet**: Correção de z-index que fazia os mapas se sobreporem incorretamente a modais ou cabeçalhos.
- **Sincronização Offline**: Reparo no fluxo de states que travava o aplicativo sob longos períodos sem conexão à internet.
- **Modais Travados**: Conserto do gerenciamento de backdrop que impedia cliques em botões de confirmação.
- **Cálculo de KM**: Alinhamento do hodômetro que duplicava a distância ao reiniciar sessões ou GPS temporariamente instável.
