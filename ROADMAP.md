# Roadmap - DriverDash Roxou

Este arquivo apresenta as fases planejadas e o progresso correspondente para o desenvolvimento do DriverDash Roxou.

---

## FASE 1: Core de Telemetria e GPS
*Status: **CONCLUÍDO***

### Objetivos Principais:
- [x] Rastreamento preciso usando `navigator.geolocation.watchPosition`.
- [x] Implementação de filtro de ruído e cálculo geodésico com fórmula de Haversine.
- [x] Criação de buffer de pontos local resiliente para gravação offline em LocalStorage.
- [x] Motor de sincronização em lote (`telemetrySync.service.ts`) integrado com Supabase.
- [x] Garantia de encerramento seguro limpando o cache de pontos e executando o flush final.

---

## FASE 2: Fluxo Operacional de Corrida
*Status: **95% (Estabilizado e em Validação Final)***

### Objetivos Principais:
- [x] Estados reativos de controle de corrida (Iniciar, Embarque, Finalizar, Cancelar).
- [x] Armazenamento unificado das corridas com persistência local redundante.
- [x] Processo de cancelamento documentado e seguro que redefine e resguarda estados de GPS.
- [x] Integração de calibração inteligente pós-corrida alimentando bancos de treinamento.
- [ ] Ajuste fino do sincronizador de corridas pendentes em background ao reestabelecer rede (5% restantes).

---

## FASE 3: UI/UX e Design System
*Status: **EM ANDAMENTO***

### Objetivos Principais:
- [x] Layout premium baseado no tema "Roxou" (Slate escuro, roxos vibrantes e contrastes refinados).
- [x] Integração completa de bibliotecas gráficas interativas (`recharts`).
- [x] Renderização limpa de mapas em tempo real com `Leaflet` e overlays ajustados de z-index.
- [ ] Implementação de animações de transição suaves usando `motion/react` nas trocas de modais e abas (Em andamento).
- [ ] Suporte nativo à adaptação avançada de fontes e contrastes customizados para visualização noturna sob sol forte.

---

## FASE 4: Analytics e Inteligência Artificial (Brain)
*Status: **EM EVOLUÇÃO***

### Objetivos Principais:
- [x] IA de Recomendação de Áreas Quentes baseado em mapas de densidade acumulada (Heatmap).
- [x] Análise heurística local para sugerir ações operacionais (abastecimento, paradas para descanso).
- [ ] Integração com Modelos de Linguagem para relatórios descritivos de performance financeira mensal (Em desenvolvimento).
- [ ] Análise preditiva robusta de tarifas cruzadas entre aplicativos concorrentes em tempo real.

---

## FASE 5: Expansão Mobile (Android Native Bridge)
*Status: **PLANEJADO***

### Objetivos Principais:
- [ ] Portabilidade dos módulos de cálculo (`journey.calculations.ts`) para TypeScript compilável em plataformas nativas.
- [ ] Criação de interfaces de ponte para recebimento contínuo de coordenadas de GPS nativas do Android.
- [ ] Serviço nativo persistente para garantir execução em segundo plano (Background Service) sem interrupção do sistema operacional.

---

## FASE 6: Integração de Acessibilidade
*Status: **PLANEJADO***

### Objetivos Principais:
- [ ] Integração nativa com APIs de Acessibilidade de plataformas Android para leitura de telas de aplicativos terceiros (Uber, 99).
- [ ] Captura automatizada de ofertas de corridas em background, reduzindo a necessidade de interação manual do motorista durante a direção.
- [ ] Garantia de total segurança de dados e privacidade em conformidade com as diretrizes do sistema operacional.
