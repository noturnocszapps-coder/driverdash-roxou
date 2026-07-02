# Checklist de Testes - DriverDash Roxou

Este arquivo contém o checklist obrigatório que deve ser testado manualmente ou via scripts automatizados antes de consolidar qualquer release do DriverDash Roxou.

---

## 📋 Checklist de Validação Geral

### 🛰️ Core de Geolocalização (GPS)
- [ ] **GPS inicia**: Ao ligar a jornada, o rastreador de GPS (`watchPosition`) é ativado sem travar a interface e recebe coordenadas contínuas.
- [ ] **GPS encerra**: Ao finalizar a jornada, todos os watchers do GPS são desativados com segurança, liberando memória e interrompendo o consumo em segundo plano.
- [ ] **KM atualiza**: O odômetro reativo atualiza a quilometragem total em tempo real com base na rota percorrida e na fórmula de Haversine.

### 🏁 Fluxo Operacional da Corrida
- [ ] **Aceitar corrida**: O motorista consegue preencher as estimativas iniciais e aceitar a oferta de corrida atualizando a interface para o modo de acompanhamento ativo.
- [ ] **Passageiro embarcou**: O botão de embarque registra com sucesso o timestamp exato e altera o estado do fluxo operacional.
- [ ] **Finalizar corrida**: Ao clicar em finalizar, o modal de calibração exibe os dados corretos, permite inserção de dados reais consolidados e grava o log correspondente.
- [ ] **Cancelar corrida**: O botão de cancelamento abre o modal de justificativa, redefine e limpa o estado de corrida ativa e reestabelece o rastreamento em tempo real do mapa sem erros.
- [ ] **Encerrar jornada**: Ao finalizar a sessão diária, o aplicativo encerra wake locks e realiza o sync síncrono remanescente.

### 🔄 Resiliência de Conectividade (Modo Offline)
- [ ] **Offline**: Com a rede desabilitada, a aplicação continua rastreando, grava os pontos de telemetria e o progresso da corrida no cache local (`LocalStorage`) perfeitamente.
- [ ] **Online**: Ao reestabelecer conexão com a rede, o motor de sincronização reativa as chamadas ao Supabase, limpando o cache acumulado sem perdas.

### 📊 Telas e Módulos de Interface (UI)
- [ ] **Dashboard**: Exibição limpa de dados estatísticos diários integrados de lucros, faturamento bruto, faturamento por hora e consumo do veículo.
- [ ] **IA (Insights)**: Geração dinâmica de cartões de desempenho preditivos no rodapé baseados nas corridas ativas.
- [ ] **Heatmap**: Renderização correta do mapa de calor de demanda e faturamento com os gradientes ajustados de opacidade sobre o Leaflet.
- [ ] **Relatórios**: Histórico detalhado de corridas do dia exibido em logs que podem ser selecionados e editados.
