// ============================================================================
// DRIVERDASH ROXOU — STABLE CORE
//
// ARQUIVO CRÍTICO PROTEGIDO DURANTE O MODO DE ESTABILIZAÇÃO.
//
// NÃO ALTERAR SEM SOLICITAÇÃO EXPLÍCITA.
//
// Este módulo participa de operações críticas do sistema:
// -> Responsável pela captura, filtros de precisão e ciclo de vida de coordenadas GPS.
//
// Mudanças não autorizadas podem causar regressões, inconsistência de dados
// ou perda de informações da jornada.
//
// Antes de qualquer alteração futura:
// 1. identificar o bug reproduzível;
// 2. documentar a causa raiz;
// 3. aplicar a menor correção possível;
// 4. não realizar refatoração oportunista;
// 5. executar typecheck;
// 6. executar build;
// 7. informar exatamente quais linhas e comportamentos foram alterados.
//
// STATUS: PROTEGIDO
// ============================================================================

export interface GPSTrackingCoords {
  latitude: number;
  longitude: number;
  speed: number | null;
  timestamp: string;
}

export const gpsTracker = {
  /**
   * Request permission or check if geolocation is available.
   */
  checkPermission(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(false);
        return;
      }
      navigator.permissions?.query({ name: 'geolocation' as PermissionName })
        .then((result) => {
          resolve(result.state === 'granted' || result.state === 'prompt');
        })
        .catch(() => {
          resolve(true); // default option if permission api is not full supporting
        });
    });
  },

  /**
   * Starts a watchPosition query.
   */
  watchPosition(
    onSuccess: (coords: GPSTrackingCoords) => void,
    onError: (err: GeolocationPositionError) => void
  ): number {
    if (!navigator.geolocation) {
      throw new Error("Geolocation is not supported by your browser environment.");
    }

    return navigator.geolocation.watchPosition(
      (pos) => {
        onSuccess({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          speed: pos.coords.speed !== null && pos.coords.speed >= 0 ? pos.coords.speed * 3.6 : 0, // Convert m/s -> km/h
          timestamp: new Date().toISOString()
        });
      },
      onError,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  },

  /**
   * Clears an active position watch.
   */
  clearWatch(watchId: number): void {
    if (navigator.geolocation && watchId) {
      navigator.geolocation.clearWatch(watchId);
    }
  }
};
