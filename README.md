# DriverDash Roxou - Painel de Controle de Ganhos Premium 💜

DriverDash Roxou é uma plataforma web premium, moderna e de alta fidelidade desenhada especificamente para motoristas de aplicativos (como Uber, 99 e InDrive) e frotas particulares gerenciarem seus faturamentos, despesas rodoviárias, metas fiscais e limites operacionais.

Esta é a **Fase 1** do projeto – focada em desenvolvimento local, testes, simulações em sandbox e estabilização de regras de negócio antes do deploy completo em produção.

---

## 🚀 Funcionalidades da Fase 1

1. **Autenticação Dupla (Supabase Auth)**:
   - Login instantâneo de Motoristas via Google.
   - Login administrativo seguro via E-mail / Senha.
2. **Sincronização de Perfil Automática**: Trigger PostgreSQL integrado que detecta inscrições de usuários e cria registros correspondentes na tabela `public.profiles`.
3. **Módulo de Veículo**: Controle dinâmico do ativo circulante, taxa de km por litro, estimativas de custos fixos recorrentes e limites de km contratuais periódicos (alugados).
4. **Módulo Financeiro Completo**:
   - Registro detalhado de Faturamento Bruto, provisões de km (vazio vs útil), tempos de espera operacionais e quantidade de corridas.
   - Registro categorizado de Despesas Operacionais (combustível, seguro, manutenção, IPVA, etc.).
5. **Cálculo de Indicadores Operacionais**:
   - Faturamento bruto consolidado.
   - Soma de despesas reais.
   - Lucros líquidos exatos.
   - Somatório de Km rodados.
   - Custo financeiro por Km rodado (`Despesas / Km`).
   - Lucro líquido gerado por Km rodado (`Lucro / Km`).
6. **Fechamentos Consolidados**: Geração de fechamento diário e semanal manual com armazenamento de auditorias no histórico.
7. **Cockpit Administrativo**:
   - Painel contendo divisão de planos de condutores.
   - Criação de coeficientes de pico com multiplicadores tarifários.
   - Monitoramento comunitário de alertas de segurança em bairros.

---

## 🛠️ Como Executar o Projeto Localmente

### 1. Pré-requisitos
- Node.js instalado (v18 ou superior recomendado).
- NPM ou Yarn.

### 2. Configurando o Banco de Dados (Supabase)
1. Crie um projeto gratuito na plataforma [Supabase](https://supabase.com).
2. Acesse a aba **SQL Editor** no painel da esquerda do console do seu projeto do Supabase.
3. Copie o conteúdo completo do arquivo `supabase_schema.sql` (localizado na raiz do seu workspace) e cole-o no SQL Editor.
4. Execute o script. Ele gerará todas as tabelas necessários, ativará o Row-Level Security (RLS) e registrará as triggers automáticas.

### 3. Configurando as Variáveis de Ambiente
Duplique o arquivo `.env.example` e renomeie-o para `.env` na raiz do projeto:
```env
VITE_SUPABASE_URL=https://<seu-projeto>.supabase.co
VITE_SUPABASE_ANON_KEY=<sua-chave-anonima>
```

### 4. Instalando e Iniciando
Abra o seu terminal na raiz da pasta e execute:
```bash
# Instala todas as dependências do projeto
npm install

# Inicia o servidor de desenvolvimento local
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no seu navegador para usufruir da experiência!

---

## 🔮 Preparação para Próximas Fases
A arquitetura de código da Fase 1 foi projetada de forma extensível para receber integrações futuras de:
- Visualização de Mapas interativos e rotas GPS em tempo real.
- Rastreamento dinâmico de quilometragem e velocidades médias.
- Mapas de calor de demanda (Heatmap).
- Coeficiente Roxou de Demanda com automação por API.
- Detecção automatizada de tráfego paralisado.
