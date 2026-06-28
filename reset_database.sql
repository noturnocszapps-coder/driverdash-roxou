-- ATENÇÃO: este script apaga dados.
-- Execute somente após backup.
-- -----------------------------------------------------------------------------
-- DriverDash Roxou V3 - Script de Reset Limpo do Banco de Dados
-- Este script limpa todos os dados operacionais e de teste cadastrados,
-- mas PRESERVA INTEGRALMENTE a estrutura das tabelas, as permissões,
-- os índices, as políticas RLS (Row Level Security) e as funções auxiliares.
-- -----------------------------------------------------------------------------

BEGIN;

-- Desativa gatilhos temporariamente se necessário para evitar efeitos colaterais durante o truncate
SET CONSTRAINTS ALL DEFERRED;

-- 1. Limpeza de dados de Telemetria, Logs e Auditoria
TRUNCATE TABLE public.app_logs CASCADE;
TRUNCATE TABLE public.audit_logs CASCADE;
TRUNCATE TABLE public.system_health_snapshots CASCADE;

-- 2. Limpeza de dados operacionais (Ganhos, Despesas, Relatórios, Fechamentos)
TRUNCATE TABLE public.earnings CASCADE;
TRUNCATE TABLE public.expenses CASCADE;
TRUNCATE TABLE public.daily_closings CASCADE;
TRUNCATE TABLE public.weekly_closings CASCADE;
TRUNCATE TABLE public.passenger_reports CASCADE;

-- 3. Limpeza de Metas, Alertas e Configurações de Custos
TRUNCATE TABLE public.financial_goals CASCADE;
TRUNCATE TABLE public.vehicle_cost_settings CASCADE;
TRUNCATE TABLE public.smart_alerts CASCADE;

-- 4. Limpeza de Jornadas (Driver Sessions e Route Points)
TRUNCATE TABLE public.driver_sessions CASCADE;
-- Nota: public.route_points possui FK para driver_sessions com ON DELETE CASCADE, mas TRUNCATE CASCADE limpa ambas com segurança.

-- 5. Limpeza de Configurações do Uber Pass e Sinais de Demanda Simulados
TRUNCATE TABLE public.driver_uber_pass_settings CASCADE;
TRUNCATE TABLE public.demand_signals CASCADE;

-- 6. Limpeza de Veículos
TRUNCATE TABLE public.vehicles CASCADE;

-- 7. Limpeza de Perfis (Profiles)
-- IMPORTANTE: Isto remove apenas os metadados dos perfis na tabela public.profiles.
-- Os usuários cadastrados no Supabase Auth (auth.users) continuarão existindo e sincronizarão seus perfis novamente ao logar.
TRUNCATE TABLE public.profiles CASCADE;

COMMIT;

-- -----------------------------------------------------------------------------
-- O banco de dados agora está limpo e pronto para novos cadastros reais de motoristas.
-- -----------------------------------------------------------------------------
