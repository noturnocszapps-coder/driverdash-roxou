import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function PageTitleHandler() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    let title = 'DriverDash Roxou';

    if (path === '/dashboard') {
      title = 'DriverDash Roxou • Dashboard';
    } else if (path === '/jornada') {
      title = 'DriverDash Roxou • Jornada Inteligente';
    } else if (path === '/financeiro') {
      title = 'DriverDash Roxou • Inteligência Financeira';
    } else if (path === '/veiculo') {
      title = 'DriverDash Roxou • Meu Veículo';
    } else if (path === '/jornadas') {
      title = 'DriverDash Roxou • Histórico de Jornadas';
    } else if (path.startsWith('/jornadas/')) {
      title = 'DriverDash Roxou • Detalhes da Jornada';
    } else if (path === '/debug') {
      title = 'DriverDash Roxou • Diagnóstico GPS';
    } else if (path === '/status') {
      title = 'DriverDash Roxou • Diagnóstico GPS';
    } else if (path === '/metas') {
      title = 'DriverDash Roxou • Metas';
    } else if (path === '/insights') {
      title = 'DriverDash Roxou • Insights & IA';
    } else if (path === '/planos') {
      title = 'DriverDash Roxou • Planos & Assinaturas';
    } else if (path === '/admin') {
      title = 'DriverDash Roxou • Painel Administrativo';
    } else if (path === '/alertas') {
      title = 'DriverDash Roxou • Configurações de Alertas';
    } else if (path === '/login') {
      title = 'Entrar • DriverDash Roxou';
    } else if (path === '/demanda') {
      title = 'DriverDash Roxou • Mapa de Demanda';
    } else if (path === '/uber-pass') {
      title = 'DriverDash Roxou • Simulador Uber Pass';
    } else if (path === '/relatorios') {
      title = 'DriverDash Roxou • Relatórios & Estatísticas';
    } else {
      title = '404 • DriverDash Roxou';
    }

    document.title = title;
  }, [location]);

  return null;
}
