import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // API endpoint for Google Roads snapToRoads proxy
  app.post('/api/roads/snap', async (req, res) => {
    const { points } = req.body;
    if (!points || !Array.isArray(points)) {
      return res.status(400).json({ error: 'Points array is required.' });
    }

    const googleKey = process.env.GOOGLE_MAPS_PLATFORM_KEY;
    if (!googleKey) {
      console.warn('[ROADS_PROXY] Google Maps Platform Key is not configured. Returning empty snappedPoints.');
      return res.json({ snappedPoints: [] });
    }

    try {
      console.log(`[ROADS_PROXY] Proxying ${points.length} points to snapToRoads API...`);
      // Google Roads API allows up to 100 points
      const batches: any[][] = [];
      for (let i = 0; i < points.length; i += 100) {
        batches.push(points.slice(i, i + 100));
      }

      const allSnappedPoints: any[] = [];
      for (const batch of batches) {
        const pathParam = batch.map(p => `${p.lat},${p.lng}`).join('|');
        const url = `https://roads.googleapis.com/v1/snapToRoads?path=${encodeURIComponent(pathParam)}&interpolate=true&key=${googleKey}`;
        const response = await fetch(url);
        if (!response.ok) {
          const errText = await response.text();
          console.error('[ROADS_PROXY] Roads API error:', errText);
          continue;
        }
        const data = await response.json();
        if (data.snappedPoints && Array.isArray(data.snappedPoints)) {
          allSnappedPoints.push(...data.snappedPoints);
        }
      }

      console.log(`[ROADS_PROXY] Snap completed. Total snapped points: ${allSnappedPoints.length}`);
      return res.json({ snappedPoints: allSnappedPoints });
    } catch (err: any) {
      console.error('[ROADS_PROXY] Critical error proxying to Google Roads:', err);
      return res.status(500).json({ error: err.message || 'Internal server error proxying to Google Roads.' });
    }
  });

  // API endpoint for reverse geocoding with fallbacks and debug logs
  app.get('/api/geocode', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'Parâmetros lat e lng são obrigatórios.' });
    }

    const googleKey = process.env.GOOGLE_MAPS_PLATFORM_KEY;
    if (googleKey) {
      try {
        console.log(`[GEOCODE] Tentando Google Geocoding para ${lat}, ${lng}...`);
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleKey}&language=pt-BR`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' && data.results && data.results.length > 0) {
          const firstResult = data.results[0];
          const address = firstResult.formatted_address;
          
          let neighborhood = '';
          let city = 'Presidente Prudente';
          let state = 'São Paulo';
          let street = '';
          let postalCode = '';
          
          for (const comp of firstResult.address_components) {
            if (
              comp.types.includes('sublocality') || 
              comp.types.includes('sublocality_level_1') || 
              comp.types.includes('sublocality_level_2') || 
              comp.types.includes('neighborhood') || 
              comp.types.includes('colloquial_area') || 
              comp.types.includes('political')
            ) {
              if (!neighborhood || comp.types.includes('sublocality_level_1') || comp.types.includes('neighborhood')) {
                neighborhood = comp.long_name;
              }
            }
            if (comp.types.includes('administrative_area_level_2') || comp.types.includes('locality')) {
              city = comp.long_name;
            }
            if (comp.types.includes('administrative_area_level_1')) {
              state = comp.short_name; // e.g. "SP"
            }
            if (comp.types.includes('route')) {
              street = comp.long_name;
            }
            if (comp.types.includes('postal_code')) {
              postalCode = comp.long_name;
            }
          }

          console.log(`[GEOCODE] Sucesso via Google: ${street}, ${neighborhood}, ${city} - ${state}, ${postalCode}`);
          return res.json({
            address,
            neighborhood: neighborhood || 'Ponto Desconhecido',
            city,
            state,
            street,
            postalCode,
            source: 'google'
          });
        } else {
          console.warn(`[GEOCODE] Google API retornou status: ${data.status}`);
        }
      } catch (err) {
        console.error('[GEOCODE] Erro na API do Google Maps:', err);
      }
    }

    // Try Nominatim (OpenStreetMap) if Google fails or is unconfigured
    try {
      console.log(`[GEOCODE] Tentando Nominatim para ${lat}, ${lng}...`);
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'DriverDashApp/1.0 (noturnocszapps@gmail.com)'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const address = data.display_name || '';
        const addr = data.address || {};
        
        const neighborhood = addr.suburb || addr.neighbourhood || addr.neighbourhood_level_1 || addr.district || addr.city_district || addr.quarter || addr.village || addr.hamlet || 'Ponto Desconhecido';
        const city = addr.city || addr.town || addr.municipality || 'Presidente Prudente';
        const state = addr.state || 'São Paulo';
        const street = addr.road || addr.street || '';
        const postalCode = addr.postcode || '';

        console.log(`[GEOCODE] Sucesso via Nominatim: Bairro="${neighborhood}", Cidade="${city}", Estado="${state}", Rua="${street}", CEP="${postalCode}"`);
        return res.json({
          address,
          neighborhood,
          city,
          state,
          street,
          postalCode,
          source: 'nominatim'
        });
      }
    } catch (err) {
      console.error('[GEOCODE] Erro no Nominatim:', err);
    }

    // Fallback if everything fails
    console.log(`[GEOCODE] Usando fallback local para ${lat}, ${lng}...`);
    return res.json({
      address: 'Presidente Prudente, SP',
      neighborhood: 'Centro',
      city: 'Presidente Prudente',
      state: 'SP',
      street: '',
      postalCode: '',
      source: 'fallback'
    });
  });

  // Serve static files in production or register Vite middleware in development
  if (process.env.NODE_ENV !== 'production') {
    console.log('Starting in DEVELOPMENT mode with Vite Middleware...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('Starting in PRODUCTION mode, serving static files...');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    // SPA Fallback
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
