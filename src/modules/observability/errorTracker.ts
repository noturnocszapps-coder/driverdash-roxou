/**
 * Exception and Error Tracker - FASE 5.2
 * Location: src/modules/observability/errorTracker.ts
 * Description: Captures JS errors, GPS errors, network drops, and logs them.
 */

import { observabilityService } from './observability.service';
import { LogCategory } from './observability.types';

export const errorTracker = {
  /**
   * Logs a standard typescript exception with severity levels.
   */
  trackException(
    category: LogCategory,
    message: string,
    error: any,
    additionalMetadata: Record<string, any> = {}
  ): void {
    const errorDetails = {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      ...additionalMetadata
    };

    console.error(`[ErrorTracker] Exception [${category}]: ${message}`, error);

    observabilityService.log(
      'error',
      category,
      `${message} (Details: ${errorDetails.errorMessage})`,
      errorDetails
    );
  },

  /**
   * Specific helper for logging location and telemetry failures
   */
  trackGPSError(reason: string, permissionState?: string): void {
    observabilityService.log(
      'critical',
      'gps',
      `GPS Telemetry Error: ${reason}`,
      { permissionState, timestamp: new Date().toISOString() }
    );
  },

  /**
   * Tracks sync degradation or replication conflicts
   */
  trackSyncError(moduleName: string, error: any): void {
    this.trackException('sync', `Synchronization failed in active module: ${moduleName}`, error);
  },

  /**
   * Tracks database connection lost or RLS rejections
   */
  trackSupabaseError(action: string, error: any): void {
    const errorDetails = {
      errorMessage: error instanceof Error ? error.message : (error?.message || String(error)),
      errorStack: error instanceof Error ? error.stack : undefined,
      code: error?.code || '',
      details: error?.details || '',
      hint: error?.hint || '',
      status: error?.status || error?.statusCode,
      timestamp: new Date().toISOString(),
    };

    const message = errorDetails.errorMessage;
    const code = errorDetails.code;
    const status = errorDetails.status;

    // Classification Logic
    let classification: 'auth' | 'schema' | 'network' | 'unknown' = 'unknown';
    let categoryTitle = '';
    let recommendation = '';

    // 1. Check for Authentication Errors
    const isAuth = 
      code === 'PGRST301' || 
      code === '42501' || 
      status === 401 || 
      status === 403 ||
      message.toLowerCase().includes('jwt') ||
      message.toLowerCase().includes('unauthorized') ||
      message.toLowerCase().includes('authentication') ||
      message.toLowerCase().includes('permission denied') ||
      message.toLowerCase().includes('insufficient privilege');

    // 2. Check for Schema Errors
    const isSchema = 
      code === '42P01' || // relation/table does not exist
      code === '42703' || // column does not exist
      code.startsWith('22') || // data exception (e.g. data type mismatch, string too long)
      code.startsWith('23') || // integrity constraint violation
      code.startsWith('PGRST2') || // PostgREST schema errors
      message.toLowerCase().includes('relation') ||
      message.toLowerCase().includes('column') ||
      message.toLowerCase().includes('does not exist') ||
      message.toLowerCase().includes('type mismatch') ||
      message.toLowerCase().includes('constraint') ||
      message.toLowerCase().includes('violates');

    // 3. Check for Network / Connection Errors
    const isNetwork = 
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      message.toLowerCase().includes('fetch') ||
      message.toLowerCase().includes('network') ||
      message.toLowerCase().includes('conn') ||
      message.toLowerCase().includes('timeout') ||
      message.toLowerCase().includes('abort') ||
      message.toLowerCase().includes('dns') ||
      code === '0' ||
      code === 'FETCH_ERROR';

    if (isAuth) {
      classification = 'auth';
      categoryTitle = 'ERRO DE AUTENTICAÇÃO / RLS';
      recommendation = 'Verifique se o usuário está logado ou se o token JWT expirou. Certifique-se também de que as políticas de RLS estão habilitadas e configuradas adequadamente para a tabela no banco remoto.';
    } else if (isSchema) {
      classification = 'schema';
      categoryTitle = 'ERRO DE SCHEMA / ESTRUTURA';
      recommendation = 'A estrutura da tabela ou coluna está incompatível. Verifique se executou o script SQL completo "supabase_schema.sql" no console do seu projeto do Supabase.';
    } else if (isNetwork) {
      classification = 'network';
      categoryTitle = 'ERRO DE CONEXÃO / REDE';
      recommendation = 'O dispositivo está sem internet ou o endpoint do Supabase está inacessível. O aplicativo continuará em modo de persistência local (offline) até que a conexão seja reestabelecida.';
    } else {
      classification = 'unknown';
      categoryTitle = 'ERRO DESCONHECIDO DO SUPABASE';
      recommendation = 'Ocorreu um erro não mapeado. Revise os detalhes técnicos no console do navegador e a resposta do banco.';
    }

    const structuredMessage = `[Supabase] [${categoryTitle}] Falha na ação [${action}]: ${errorDetails.errorMessage}. Recomendação: ${recommendation}`;

    console.error(`[ErrorTracker] [${classification.toUpperCase()}] ${structuredMessage}`, errorDetails);

    observabilityService.log(
      'error',
      'supabase',
      structuredMessage,
      {
        ...errorDetails,
        classification,
        recommendation
      }
    );
  }
};
