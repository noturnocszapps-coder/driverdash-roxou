# DriverDash Roxou - Android Accessibility Service Integration Roadmap

Este documento define a arquitetura, diretrizes de privacidade e especificações de integração para a futura camada Android nativa do **DriverDash Roxou**. Esta camada coletará ofertas de corrida em tempo real de aplicativos como **Uber** e **99** usando as APIs nativas do Android e as enviará ao DriverDash para análise de lucratividade e tomada de decisão instantânea.

---

## 1. Objetivo da Integração

Automatizar a leitura de ofertas de corridas exibidas em tela ou em notificações nos aplicativos parceiros (Uber, 99, InDrive). 
Através do uso do **AccessibilityService (Serviço de Acessibilidade)** do Android, o DriverDash será capaz de:
- Identificar quando uma nova oferta surge.
- Extrair em milissegundos o valor da tarifa, a distância estimada, a duração estimada, e os bairros de origem/destino.
- Realizar a análise de rentabilidade (R$/km, R$/hora, custo operacional e lucro estimado).
- Apresentar um overlay flutuante (HUD) na tela do motorista com o veredito (**Excelente**, **Boa**, **Atenção**, **Retorno**, **Ruim**), ajudando o motorista a aceitar ou recusar de forma rápida e segura.

---

## 2. Fluxo Esperado (Arquitetura)

```
[ Aplicativo Uber / 99 ]
        │
        ▼ (Nova oferta exibida na tela)
[ DriverDash AccessibilityService ] (Ativo em background no Android)
        │
        ├─► 1. Captura a árvore de nós da UI (AccessibilityNodeInfo)
        ├─► 2. Faz o parse do texto em tempo real (Regex local / OCR se necessário)
        │
        ▼ (Dados brutos estruturados)
[ DriverDash Android Core Engine ]
        │
        ├─► 3. Consulta custos locais do veículo (via REST API ou DB offline SQLite)
        ├─► 4. Executa o algoritmo de decisão instantâneo (RideOfferDecisionEngine)
        │
        ├───► [ Overlay flutuante nativo (HUD) ] (Mostra veredito em 0.2 segundos)
        │
        ▼ (Sincronização opcional via REST em background)
[ DriverDash Supabase Web App ] (Tabela public.ride_offers para estatísticas e histórico)
```

---

## 3. Uso Responsável do AccessibilityService & Consentimento

O Android impõe regras rígidas de segurança para o uso de Serviços de Acessibilidade. O DriverDash seguirá estritamente as diretrizes da Google Play Store:

### Permissões Necessárias
1. **`android.permission.BIND_ACCESSIBILITY_SERVICE`**: Permite que o aplicativo aja como serviço de acessibilidade.
2. **`android.permission.SYSTEM_ALERT_WINDOW`**: Permite desenhar o overlay flutuante (HUD) sobre outros aplicativos.
3. **`android.permission.FOREGROUND_SERVICE`**: Garante que o serviço de background continue funcionando de forma persistente e estável durante a jornada do motorista.

### Consentimento Ativo do Usuário (Disclosure)
Antes de ativar a acessibilidade, o aplicativo Android exibirá uma tela de consentimento detalhada esclarecendo:
- Por que a permissão é necessária.
- Que apenas telas específicas de ofertas da Uber e 99 serão lidas.
- Que nenhum dado de terceiros ou dados pessoais será coletado.

---

## 4. Política de Privacidade e Proteção de Dados (Crucial)

Garantir a privacidade do motorista e dos passageiros é o pilar central desta integração.

### O que SERÁ capturado:
- **Dados da Oferta**: Tarifa (R$), distância total (km), tempo de deslocamento (minutos), categoria (UberX, Comfort, Pop, etc.).
- **Localização Textual**: Nome da rua, bairro ou cidade de embarque e destino exibidos na janela de oferta.
- **Nome do Provedor**: Identificação visual do aplicativo emissor ('uber', '99', 'indrive').

### O que NÃO SERÁ capturado (Privacidade Estrita):
- ❌ **Mensagens Pessoais**: Conversas de WhatsApp, SMS ou chats internos dos aplicativos.
- ❌ **Dados de Identificação do Passageiro**: Nomes, fotos ou notas de passageiros.
- ❌ **Credenciais e Dados Bancários**: Senhas, números de cartão de crédito, saldos ou contas digitais.
- ❌ **Outros Aplicativos**: Qualquer tela que não pertença estritamente à interface de oferta de corridas dos aplicativos de transporte autorizados.

---

## 5. Sem Automação de Cliques (No Auto-Click / No Auto-Accept)

O DriverDash Roxou **NÃO** realizará ações automatizadas de clique, aceitação ou recusa automática de corridas. 

### Motivos:
1. **Termos de Uso das Plataformas**: A automação de cliques (auto-clicker) viola os Termos de Serviço da Uber e 99, podendo causar o banimento imediato e definitivo do motorista.
2. **Segurança do Motorista**: O motorista deve ser sempre o decisor soberano, pois as condições de trânsito reais, cansaço ou segurança do local de embarque exigem discernimento humano que algoritmos não podem prever totalmente.
3. **Diretrizes do Google Play**: Aplicativos que usam acessibilidade para clicar em telas sem interação humana ativa são frequentemente banidos da Google Play Store por abuso de privilégios.

---

## 6. Estrutura de Envio de Dados para a API Web

Quando o Android capturar a oferta, ele poderá realizar um POST para o endpoint `/api/ride-offers` ou se conectar diretamente ao cliente Supabase:

### Payload de Envio (Exemplo JSON)
```json
{
  "provider": "uber",
  "raw_text": "UberX - R$ 24,50 • 8,2 km • 14 min • Embarque: Jardim Bongiovani • Destino: Centro",
  "fare_amount": 24.50,
  "estimated_distance_km": 8.2,
  "estimated_duration_min": 14,
  "pickup_text": "Jardim Bongiovani",
  "destination_text": "Centro",
  "pickup_neighborhood": "Jardim Bongiovani",
  "destination_neighborhood": "Centro",
  "pickup_city": "Presidente Prudente",
  "destination_city": "Presidente Prudente",
  "confidence_score": 98.5,
  "source": "android_accessibility",
  "status": "detected",
  "detected_at": "2026-06-30T13:28:26-07:00"
}
```

---

## 7. Próximos Passos de Implementação (Roadmap Técnico)

1. **Fase 1 (Atual)**: Criação das tabelas no Supabase, regras RLS, engines de decisão no Web App e telas de acompanhamento no painel de administração e motorista.
2. **Fase 2 (Nativo)**: Desenvolvimento do módulo Kotlin (`AccessibilityService`) no projeto Android.
3. **Fase 3 (Integração Local)**: Implementação de banco de dados SQLite local no Android para guardar custos do veículo de forma offline e garantir cálculos em menos de 100ms.
4. **Fase 4 (Interface HUD)**: Criação da janela flutuante customizada com animações fluidas exibindo os scores da corrida.
5. **Fase 5 (Testes de Campo)**: Homologação prática do parsing com diferentes resoluções e layouts atualizados das plataformas Uber/99.
