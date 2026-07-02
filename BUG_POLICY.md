# Política de Resolução de Bugs - DriverDash Roxou

Qualquer ajuste, reparo ou correção de bug introduzido no repositório do DriverDash Roxou deve obrigatoriamente seguir a seguinte esteira disciplinada de 7 passos. Esta regra visa garantir a estabilidade do sistema e evitar efeitos colaterais indesejados.

---

## 🛡️ Protocolo de Resolução em 7 Passos

### Passo 1: Reproduzir o Bug
- Não tente adivinhar a correção.
- Crie um cenário isolado de teste, alterne estados locais ou use ferramentas de simulação de telemetria para registrar exatamente sob quais circunstâncias o erro ocorre.
- Documente os passos de reprodução.

### Passo 2: Identificar o Módulo Afetado
- Rastreie a cadeia de chamadas até identificar de onde o erro se origina.
- Verifique se a origem está localizada em um arquivo sensível (ex: GPS Core ou Sincronização de Telemetria).

### Passo 3: Classificar o Escopo do Erro
Classifique o erro em uma das quatro categorias estanques definidas na arquitetura:
- **CORE**: Problemas relacionados a GPS, leitura de watchPosition, cálculos de distância geodésica, persistência física em LocalStorage ou sincronização remota do banco de dados.
- **FLOW**: Problemas que afetam o andamento lógico de corridas (ex: transição de estados de início, embarque, cancelamento ou conclusão de jornada).
- **UI**: Erros puramente estéticos, quebras de layout, falhas de z-index de mapas Leaflet, visualização de gráficos Recharts ou design de cards.
- **ANALYTICS**: Problemas em relatórios, cálculos secundários de IA, geração de insights reativos e heatmap preditivo de demanda.

### Passo 4: Corrigir Exclusivamente o Módulo Classificado
- Faça a alteração cirúrgica unicamente no módulo classificado como origem do erro.
- **Regra Antitransbordamento**: Nunca altere lógica do **CORE** para corrigir problemas de visualização de mapas (**UI**). Nunca interfira no ciclo de vida de rastreamento (**FLOW**) para consertar regras de exibição de gráficos (**ANALYTICS**).

### Passo 5: Executar o Compilador de Produção (Build)
- Garanta que a modificação efetuada não gerou erros de TypeScript ou falhas de bundle.
- Execute:
  ```bash
  npm run build
  ```
- O build de produção deve completar com sucesso sem nenhuma mensagem de alerta ou erro crítico.

### Passo 6: Executar a Verificação Estática (Lint)
- Valide as tipagens e garanta que nenhuma convenção técnica do projeto foi quebrada.
- Execute:
  ```bash
  npm run lint
  ```
- O compilador do TypeScript (`tsc --noEmit`) deve passar completamente limpo.

### Passo 7: Executar o Checklist Manual de Validação
- Realize o fluxo de teste manual do motor completo a partir do arquivo `TEST_CHECKLIST.md`.
- Garanta que a funcionalidade modificada foi totalmente corrigida e que as demais áreas do software mantiveram o comportamento estável esperado.
