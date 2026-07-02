import L from 'leaflet';

interface RegisteredMap {
  id: string;
  map: L.Map;
  onCleanup: () => void;
  createdAt: number;
}

class LeafletManager {
  private activeMaps = new Map<string, RegisteredMap>();
  private watchdogInterval: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.startWatchdog();
    }
  }

  public registerMap(id: string, map: L.Map, onCleanup: () => void) {
    console.log(`[LEAFLET_INSTANCE_CREATED] Map registered: ${id}`);
    
    // Check if there is already another active map instance (Rule 1 & 2)
    if (this.activeMaps.size > 0) {
      console.warn(`[LEAFLET_DUPLICATE_INSTANCE] Duplicate map instance detected when registering ${id}! Cleaning up existing maps first.`);
      this.cleanupAllExcept(id);
    }

    this.activeMaps.set(id, {
      id,
      map,
      onCleanup,
      createdAt: Date.now()
    });

    // Make sure we have proper DOM structure and reset potential blocking layouts
    this.ensureNoLeftoverDOMOverlays();
  }

  public unregisterMap(id: string) {
    if (this.activeMaps.has(id)) {
      const entry = this.activeMaps.get(id);
      this.activeMaps.delete(id);
      console.log(`[LEAFLET_INSTANCE_DESTROYED] Map unregistered: ${id}`);
      if (entry) {
        try {
          entry.onCleanup();
        } catch (err) {
          console.error(`Error during registered onCleanup for ${id}:`, err);
        }
      }
    }
    this.ensureNoLeftoverDOMOverlays();
  }

  public cleanupAllExcept(excludeId?: string) {
    const toCleanup = Array.from(this.activeMaps.values()).filter(m => m.id !== excludeId);
    if (toCleanup.length > 0) {
      console.log(`[LEAFLET_INSTANCE_DESTROYED] Destroying ${toCleanup.length} existing map instances.`);
      for (const entry of toCleanup) {
        this.activeMaps.delete(entry.id);
        try {
          // Thorough cleanup
          entry.map.eachLayer(layer => {
            try {
              entry.map.removeLayer(layer);
            } catch {}
          });
          entry.map.off();
          entry.map.remove();
          entry.onCleanup();
        } catch (err) {
          console.error(`Error destroying map ${entry.id}:`, err);
        }
      }
    }
    if (!excludeId || this.activeMaps.size === 0) {
      this.purgeOrphanedLeafletElements();
    }
  }

  public destroyAll() {
    this.cleanupAllExcept();
  }

  public getActiveMapsCount(): number {
    return this.activeMaps.size;
  }

  private startWatchdog() {
    if (this.watchdogInterval) return;
    this.watchdogInterval = setInterval(() => {
      this.runWatchdog();
    }, 5000);
    // Also run once shortly after initialization
    setTimeout(() => this.runWatchdog(), 1000);
  }

  private runWatchdog() {
    const activeCount = this.activeMaps.size;
    const leafletContainers = document.querySelectorAll('.leaflet-container');
    const containerCount = leafletContainers.length;

    console.log(`[LEAFLET_WATCHDOG] Active maps registered: ${activeCount} | DOM container elements: ${containerCount}`);

    // Rule: We must never have more than 1 map active simultaneously
    if (activeCount > 1) {
      console.error(`[LEAFLET_DUPLICATE_INSTANCE] Multi-map anomaly! More than one map registered. activeCount = ${activeCount}`);
      // Keep only the newest map
      const sorted = Array.from(this.activeMaps.values()).sort((a, b) => b.createdAt - a.createdAt);
      const newest = sorted[0];
      this.cleanupAllExcept(newest.id);
    }

    // Rule: If we have 0 active maps but we have leaflet containers in the DOM, it's a potential leak
    if (activeCount === 0 && containerCount > 0) {
      console.warn(`[LEAFLET_MEMORY_LEAK] DOM has leftover leaflet containers but 0 maps registered! Performing emergency cleanup.`);
      this.purgeOrphanedLeafletElements();
    } else {
      console.log('[LEAFLET_MEMORY_OK] Leaflet memory and instance status within normal limits.');
    }

    // Check for invisible/visible overlays that might block click/pointer interaction
    this.ensureNoLeftoverDOMOverlays();
  }

  public purgeOrphanedLeafletElements() {
    console.log('[LEAFLET_DOM_CLEAN] Purging orphaned Leaflet DOM elements and fixing pointer-events');
    const selectors = [
      '.leaflet-pane',
      '.leaflet-control-container',
      '.leaflet-map-pane',
      '.leaflet-top',
      '.leaflet-bottom',
      '.leaflet-zoom-animated',
      '.leaflet-tile-container',
      '.leaflet-overlay-pane',
      '.leaflet-shadow-pane',
      '.leaflet-marker-pane',
      '.leaflet-popup-pane'
    ];

    selectors.forEach(sel => {
      const elems = document.querySelectorAll(sel);
      elems.forEach(el => {
        try {
          el.parentNode?.removeChild(el);
        } catch {}
      });
    });

    // Reset pointer-events on leftover leaflet containers if they exist but have no map
    const containers = document.querySelectorAll('.leaflet-container');
    containers.forEach(container => {
      if (this.activeMaps.size === 0) {
        (container as HTMLElement).style.pointerEvents = 'none';
        try {
          container.parentNode?.removeChild(container);
        } catch {}
      }
    });
  }

  private ensureNoLeftoverDOMOverlays() {
    const containers = document.querySelectorAll('.leaflet-container');
    if (this.activeMaps.size === 0) {
      containers.forEach(container => {
        (container as HTMLElement).style.pointerEvents = 'none';
      });
    } else {
      // Ensure only registered containers receive pointer-events: auto
      containers.forEach(container => {
        const id = container.id;
        let isRegistered = false;
        for (const [mapId] of this.activeMaps.entries()) {
          if (id === mapId) {
            isRegistered = true;
            break;
          }
        }
        if (isRegistered) {
          (container as HTMLElement).style.pointerEvents = 'auto';
        } else {
          (container as HTMLElement).style.pointerEvents = 'none';
        }
      });
    }
  }
}

export const leafletManager = new LeafletManager();
