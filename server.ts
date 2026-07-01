import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

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
          
          for (const comp of firstResult.address_components) {
            if (
              comp.types.includes('sublocality') || 
              comp.types.includes('sublocality_level_1') || 
              comp.types.includes('sublocality_level_2') || 
              comp.types.includes('neighborhood') || 
              comp.types.includes('colloquial_area') || 
              comp.types.includes('political')
            ) {
              // Prefer sublocality or neighborhood over generic political
              if (!neighborhood || comp.types.includes('sublocality_level_1') || comp.types.includes('neighborhood')) {
                neighborhood = comp.long_name;
              }
            }
            if (comp.types.includes('administrative_area_level_2')) {
              city = comp.long_name;
            }
          }

          console.log(`[GEOCODE] Sucesso via Google: ${neighborhood}, ${city}`);
          return res.json({
            address,
            neighborhood,
            city,
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
        
        // Ensure we check all possible keys for "bairro": suburb, neighbourhood, district, city_district, quarter, village, hamlet, administrative_area
        const neighborhood = addr.suburb || addr.neighbourhood || addr.neighbourhood_level_1 || addr.district || addr.city_district || addr.quarter || addr.village || addr.hamlet || '';
        const city = addr.city || addr.town || addr.municipality || 'Presidente Prudente';

        console.log(`[GEOCODE] Sucesso via Nominatim: Bairro="${neighborhood}", Cidade="${city}"`);
        return res.json({
          address,
          neighborhood,
          city,
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
      neighborhood: '',
      city: 'Presidente Prudente',
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
