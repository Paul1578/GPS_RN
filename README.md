FleetFlow - Guia de costos y performance (mapas, rutas, tracking)
=================================================================

Objetivo
--------
Mantener el producto rentable en produccion sin sacrificar UX.  
Los 3 costos principales son: tiles (mapas), routing (OSRM) y tracking.

Resumen ejecutivo (lo importante)
---------------------------------
1) Tiles: usar CDN + cache. Evitar tiles publicos directos en produccion.
2) Routing: cachear geometria por combinacion de puntos (origen/destino/paradas).
3) Tracking: enviar solo si hay movimiento y cada 10-30s como maximo.
4) Lecturas: polling en web cada 20-30s, no mas agresivo.
5) Retencion: TTL para tracking (7-30 dias), indices por routeId + recordedAt.

Arquitectura minima rentable
----------------------------
- Tiles: proxy propio + CDN (cache largo, dias/meses).
- Routing: OSRM publico ahora, pero cache de resultados en backend.
- Tracking: throttle + distancia minima para enviar posicion.

Cost drivers (y como controlarlos)
----------------------------------
1) Tiles:
   - Driver: muchas peticiones por minuto.
   - Mitigacion: CDN, cache, limitar zoom maximo si es necesario.

2) Routing (OSRM):
   - Driver: cada calculo de ruta consume CPU.
   - Mitigacion: cache por hash de puntos (origen+paradas+destino).

3) Tracking:
   - Driver: escrituras constantes + lecturas por dashboards.
   - Mitigacion: enviar cada 10-30s, solo si se movio (30-50m).
   - Solo rutas activas (estado en_progreso).

Plan de costos (modelo simple, ajustable)
-----------------------------------------
Este plan NO incluye precios en USD. Se usan formulas para que el equipo
complete con los precios del proveedor elegido (tiles/routing/hosting).

Variables (rellenar con datos reales):
- V = vehiculos activos diarios
- T = intervalo tracking en segundos (ej: 20s)
- D = horas promedio de conduccion por dia (ej: 8h)
- A = admins concurrentes viendo mapas
- P = personas que usan el mapa por dia (incluye chofer)
- Z = requests de tiles por minuto por usuario (depende de zoom/uso)
- R = rutas nuevas creadas por dia (o recalculos)

Formulas base:
1) Tracking writes/dia:
   writes = V * (D * 3600 / T)

2) Tracking reads/dia (web):
   reads = A * (D * 3600 / 20)   # si poll cada 20s

3) Tiles requests/dia:
   tiles = P * (D * 60 * Z)

4) Routing calls/dia:
   routing = R
   (con cache, idealmente 70-95% hit)

Ejemplo rapido (solo ilustrativo):
- V=100, D=8h, T=20s => writes ~ 144,000 / dia
- A=5 => reads ~ 7,200 / dia
- P=120, Z=60 tiles/min => tiles ~ 3,456,000 / dia
- R=200 rutas/dia => routing 200/dia (con cache 80%, llamadas reales 40)

Notas practicas
---------------
- Tiles: CDN con cache-control agresivo reduce costo drásticamente.
- OSRM: cachear respuesta por hash de puntos evita recalcular.
- Tracking: si velocidad < umbral o distancia < 30-50m, no enviar.
- Retencion: borrar tracking viejo con job diario (TTL 7-30 dias).
- Indices DB: (routeId, recordedAt) y (driverId, recordedAt) si aplica.

Checklist de produccion
-----------------------
1) Proxy de tiles + CDN configurado.
2) Cache de rutas (OSRM) implementado en backend.
3) Throttle + distancia minima en tracking.
4) Polling de 20-30s en web (no 5s).
5) TTL para tracking + indices.
6) Alertas: requests/min, cache hit, errors OSRM.

Decision recomendada ahora
--------------------------
Mantener OSRM publico + cache local mientras validamos producto.  
