/* ==========================================================
   Menengai Geothermal Dashboard (no login / no Firebase)
   All data loads from local GeoJSON files in data/.
   Everyone sees full well details - status, phase, depth,
   temperature - plus a downloadable daily report link if the
   well has one.
   ========================================================== */

const STATUS_COLORS = {
  'Producing': '#E4572E',
  'Non-producing': '#6B7A8F',
  'Injection': '#3EA39E'
};

const map = L.map('map', { zoomControl: true }).setView([-0.196, 36.062], 13);

const satelliteBasemap = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  {
    attribution: 'Tiles © Esri',
    maxZoom: 19
  }
);
const darkBasemap = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  subdomains: 'abcd', maxZoom: 19
});
const streetsBasemap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
  subdomains: 'abc', maxZoom: 19
});
const terrainBasemap = L.tileLayer('https://tiles.maps.eox.at/wmts/1.0.0/terrain-light_3857/default/g/{z}/{y}/{x}.jpg', {
  attribution: 'Terrain Light by <a href="https://maps.eox.at">EOX</a>',
  maxZoom: 14
});
satelliteBasemap.addTo(map);
L.control.layers({
  'Satellite imagery': satelliteBasemap, 'Dark': darkBasemap,
  'Streets': streetsBasemap, 'Terrain': terrainBasemap
}, null, { position: 'topright', collapsed: true }).addTo(map);

/* ==========================================================
   Resistivity survey layer
   Add this whole block into script.js (near the bottom is fine,
   after `map` has been created). Loads data/resistivity.geojson,
   renders year-selector pills, and shows classed-color survey
   points on the map for whichever year is selected.
   ========================================================== */

let resistivityData = [];
let resistivityYears = [];
let selectedYear = null;
let resistivityLayer = L.layerGroup().addTo(map);

// Classed color scale - standard geophysics convention: low resistivity
// (conductive clay cap, a geothermal target indicator) shown in warm
// colors, high resistivity (resistive basement) shown in cool colors.
function resistivityColor(ohmM) {
  if (ohmM < 5) return '#B91C1C';
  if (ohmM < 15) return '#F97316';
  if (ohmM < 40) return '#FACC15';
  if (ohmM < 100) return '#22C55E';
  return '#2563EB';
}

fetch('data/resistivity.geojson')
  .then(r => r.json())
  .then(geojson => {
    resistivityData = geojson.features;
    resistivityYears = [...new Set(resistivityData.map(f => f.properties.year))].sort();
    selectedYear = resistivityYears[resistivityYears.length - 1]; // default to most recent
    renderYearPills();
    renderResistivityLayer();
  })
  .catch(err => console.error('Could not load resistivity data:', err));

function renderYearPills() {
  const container = document.getElementById('yearPills');
  container.innerHTML = '';
  resistivityYears.forEach(year => {
    const pill = document.createElement('button');
    pill.className = 'year-pill' + (year === selectedYear ? ' active' : '');
    pill.textContent = year;
    pill.addEventListener('click', () => {
      selectedYear = year;
      renderYearPills();
      renderResistivityLayer();
    });
    container.appendChild(pill);
  });
}

function renderResistivityLayer() {
  resistivityLayer.clearLayers();
  const stations = resistivityData.filter(f => f.properties.year === selectedYear);

  stations.forEach(f => {
    const [lng, lat] = f.geometry.coordinates;
    const p = f.properties;
    const color = resistivityColor(p.resistivity_ohm_m);

    L.circleMarker([lat, lng], {
      radius: 9,
      fillColor: color,
      fillOpacity: 0.85,
      color: '#171412',
      weight: 1.5
    })
      .bindPopup(`<div class="popup-title">${p.station_id} &middot; ${p.year}</div>
        <div class="popup-row"><span class="popup-label">Resistivity</span> ${p.resistivity_ohm_m} &Omega;&middot;m</div>
        <div class="popup-row"><span class="popup-label">Depth</span> ${p.depth_m} m</div>`)
      .addTo(resistivityLayer);
  });

  const avg = stations.length
    ? Math.round(stations.reduce((s, f) => s + f.properties.resistivity_ohm_m, 0) / stations.length)
    : 0;
  document.getElementById('resistivityStats').innerHTML = `
    <div class="stat-inline"><span class="value mono">${stations.length}</span><span class="label">stations in ${selectedYear}</span></div>
    <div class="stat-inline"><span class="value mono">${avg} &Omega;&middot;m</span><span class="label">average reading</span></div>
  `;
}

document.getElementById('toggleResistivity').addEventListener('change', (e) => {
  e.target.checked ? map.addLayer(resistivityLayer) : map.removeLayer(resistivityLayer);
});
/* ==========================================================
   Resistivity GeoTIFF rasters, categorized by year

   WHERE TO PASTE: right after your existing resistivity point
   layer code in script.js (the block with resistivityColor,
   renderYearPills, renderResistivityLayer).

   ALSO NEEDED in index.html, inside <head> or before your other
   Leaflet scripts, add these two lines (georaster libraries):

   <script src="https://unpkg.com/georaster"></script>
   <script src="https://unpkg.com/georaster-layer-for-leaflet/dist/georaster-layer-for-leaflet.min.js"></script>

   And in the Resistivity Survey panel section of index.html, add
   one more checkbox:
   <label class="toggle"><input type="checkbox" id="toggleResistivityRaster" checked><span>Show resistivity raster</span></label>
   ========================================================== */

// One entry per year you have a GeoTIFF for. To add a new year:
// 1. Drop the .tif file into data/resistivity-rasters/
// 2. Add one line here - that's it, no other code changes needed.
const resistivityRasters = {
  2015: 'data/resistivity-rasters/resistivity_2015.tif',
  2019: 'data/resistivity-rasters/resistivity_2019.tif',
  2023: 'data/resistivity-rasters/resistivity_2023.tif'
};

let resistivityRasterLayer = null;
const georasterCache = {}; // avoids re-fetching the same file if you flip years back and forth

function loadResistivityRaster(year) {
  // Remove whatever raster is currently showing before loading the new one
  if (resistivityRasterLayer) {
    map.removeLayer(resistivityRasterLayer);
    resistivityRasterLayer = null;
  }

  const url = resistivityRasters[year];
  if (!url) return; // no raster on file for this year - that's fine, just skip it

  const showRaster = document.getElementById('toggleResistivityRaster')?.checked ?? true;
  if (!showRaster) return;

  const buildLayer = (georaster) => {
    resistivityRasterLayer = new GeoRasterLayer({
      georaster: georaster,
      opacity: 0.65,
      resolution: 128,
      pixelValuesToColorFn: (values) => {
        const v = values[0];
        // treat common "no data" sentinel values as transparent
        if (v === undefined || v === null || v <= -9999) return null;
        return resistivityColor(v); // reuses the same classed color scale as the points
      }
    });
    resistivityRasterLayer.addTo(map);
  };

  if (georasterCache[year]) {
    buildLayer(georasterCache[year]);
    return;
  }

  fetch(url)
    .then(r => {
      if (!r.ok) throw new Error(`${url} returned HTTP ${r.status}`);
      return r.arrayBuffer();
    })
    .then(arrayBuffer => parseGeoraster(arrayBuffer))
    .then(georaster => {
      georasterCache[year] = georaster;
      buildLayer(georaster);
    })
    .catch(err => console.warn(`Resistivity raster not loaded for ${year}:`, err));
}

// Hook into the existing year-pill click handler so switching years
// updates BOTH the point markers and the raster together.
const _originalRenderResistivityLayer = renderResistivityLayer;
renderResistivityLayer = function () {
  _originalRenderResistivityLayer();
  loadResistivityRaster(selectedYear);
};

const rasterToggle = document.getElementById('toggleResistivityRaster');
if (rasterToggle) {
  rasterToggle.addEventListener('change', () => loadResistivityRaster(selectedYear));
}
let boundaryLayer, plantsLayer, wellsLayer, roadsLayer, infrastructuresLayer;
let wellsData = [];

// Fetches a GeoJSON file but never breaks the whole dashboard if it's
// missing or invalid - logs a warning and returns null instead, so
// Promise.all below doesn't reject just because one optional layer failed.
function safeFetchGeoJSON(path) {
  return fetch(path)
    .then(r => {
      if (!r.ok) throw new Error(`${path} returned HTTP ${r.status}`);
      return r.json();
    })
    .catch(err => {
      console.warn(`Optional layer not loaded - ${path}:`, err);
      return null;
    });
}

Promise.all([
  fetch('data/field_boundary.geojson').then(r => r.json()),
  fetch('data/power_stations.geojson').then(r => r.json()),
  fetch('data/wells.geojson').then(r => r.json()),
  safeFetchGeoJSON('data/AccessRoads.geojson'),
  safeFetchGeoJSON('data/Infrastructures.geojson')
]).then(([boundary, plants, wells, roads, infrastructures]) => {

  boundaryLayer = L.geoJSON(boundary, {
    style: { color: '#E8B33D', weight: 2, dashArray: '6 4', fillOpacity: 0.04, fillColor: '#E8B33D' }
  }).addTo(map);

  plantsLayer = L.geoJSON(plants, {
    pointToLayer: (feature, latlng) => L.marker(latlng, { icon: plantIcon() })
      .bindPopup(plantPopup(feature.properties))
  }).addTo(map);

  wellsData = wells.features;
  wellsLayer = L.layerGroup().addTo(map);
  renderWells();
  renderWellList();
  renderStats(wells.features, plants.features);

  if (roads) {
    roadsLayer = L.geoJSON(roads, {
      style: { color: '#FFB6C1', weight: 0.8, fillOpacity: 0.04, fillColor: '#FFB6C1' }
    }).addTo(map);
  }

  if (infrastructures) {
    infrastructuresLayer = L.geoJSON(infrastructures, {
      style: { color: '#50ef50', weight: 0.8, fillOpacity: 0.04, fillColor: '#50ef50' }
    }).addTo(map);
  }

}).catch(err => {
  document.getElementById('map').innerHTML =
    '<p style="color:#ADA49A;padding:24px;font-family:Inter,sans-serif;">Could not load core data files (boundary/power stations/wells). If you\'re opening index.html directly from disk, browsers block local fetch() — run a local server instead, e.g. <code>python3 -m http.server</code> from this folder, then visit localhost.</p>';
  console.error(err);
});

function plantIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;background:#E8B33D;border:2px solid #171412;border-radius:3px;transform:rotate(45deg);box-shadow:0 0 0 2px #E8B33D66;"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
}

function wellIcon(status) {
  const color = STATUS_COLORS[status] || '#999';
  const pulse = status === 'Producing'
    ? `<div class="pulse-ring" style="position:absolute;top:-4px;left:-4px;width:16px;height:16px;"></div>`
    : '';
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:8px;height:8px;">
             ${pulse}
             <div style="width:8px;height:8px;border-radius:50%;background:${color};border:1.5px solid #171412;"></div>
           </div>`,
    iconSize: [8, 8],
    iconAnchor: [4, 4]
  });
}

function wellPopup(p) {
  const reportLink = p.report_url
    ? `<a class="popup-report-btn" href="${p.report_url}" target="_blank" rel="noopener">Download daily report (PDF)</a>`
    : `<div class="popup-row popup-report-missing">No daily report on file for this well.</div>`;
  return `<div class="popup-title">${p.well_id}</div>
    <div class="popup-row"><span class="popup-label">Status</span> ${p.status}</div>
    <div class="popup-row"><span class="popup-label">Phase</span> ${p.phase}</div>
    <div class="popup-row"><span class="popup-label">Depth</span> ${Number(p.depth_m).toLocaleString()} m</div>
    <div class="popup-row"><span class="popup-label">Reservoir temp</span> ${p.temp_c} &deg;C</div>
    <div class="popup-row"><span class="popup-label">Pressure</span> ${p.pressure_bar} bar</div>
    ${reportLink}`;
}

function plantPopup(p) {
  return `<div class="popup-title">${p.name}</div>
    <div class="popup-row">Capacity: ${p.capacity_mw} MW</div>`;
}
function infrastructuresPopup(p) {
  return `<div class="popup-title">${p.Name}</div>
    <div class="popup-row">Name: ${p.Name} </div>`;
}
function activeStatuses() {
  return Array.from(document.querySelectorAll('.statusFilter'))
    .filter(cb => cb.checked)
    .map(cb => cb.value);
}

function renderWells() {
  wellsLayer.clearLayers();
  const allowed = activeStatuses();
  wellsData
    .filter(f => allowed.includes(f.properties.status))
    .forEach(f => {
      const [lng, lat] = f.geometry.coordinates;
      L.marker([lat, lng], { icon: wellIcon(f.properties.status) })
        .bindPopup(wellPopup(f.properties))
        .addTo(wellsLayer);
    });
}

function renderWellList() {
  const container = document.getElementById('wellList');
  container.innerHTML = '';
  const allowed = activeStatuses();
  wellsData
    .filter(f => allowed.includes(f.properties.status))
    .forEach(f => {
      const p = f.properties;
      const row = document.createElement('div');
      row.className = 'well-row';
      row.innerHTML = `<span>${p.well_id}</span><span class="temp">${p.temp_c}&deg;C</span>`;
      row.addEventListener('click', () => {
        const [lng, lat] = f.geometry.coordinates;
        map.flyTo([lat, lng], 15, { duration: 0.6 });
      });
      container.appendChild(row);
    });
}

function renderStats(wellFeatures, plantFeatures) {
  const total = wellFeatures.length;
  const producing = wellFeatures.filter(f => f.properties.status === 'Producing').length;
  const capacity = plantFeatures.reduce((sum, f) => sum + f.properties.capacity_mw, 0);
  const avgTemp = Math.round(
    wellFeatures.reduce((s, f) => s + f.properties.temp_c, 0) / total
  );

  document.getElementById('statStrip').innerHTML = `
    <div class="stat"><span class="value mono">${total}</span><span class="label">Wells mapped</span></div>
    <div class="stat"><span class="value mono">${producing}</span><span class="label">Producing</span></div>
    <div class="stat"><span class="value mono">${capacity} MW</span><span class="label">Installed capacity</span></div>
    <div class="stat"><span class="value mono">${avgTemp}&deg;C</span><span class="label">Avg. reservoir temp</span></div>
  `;
}

// ---------------- Controls ----------------
document.getElementById('toggleBoundary').addEventListener('change', (e) => {
  e.target.checked ? map.addLayer(boundaryLayer) : map.removeLayer(boundaryLayer);
});
document.getElementById('togglePlants').addEventListener('change', (e) => {
  e.target.checked ? map.addLayer(plantsLayer) : map.removeLayer(plantsLayer);
});
document.getElementById('toggleWells').addEventListener('change', (e) => {
  e.target.checked ? map.addLayer(wellsLayer) : map.removeLayer(wellsLayer);
});
document.getElementById('toggleRoads').addEventListener('change', (e) => {
  e.target.checked ? map.addLayer(roadsLayer) : map.removeLayer(roadsLayer);
});
   document.getElementById('toggleInfrastructures').addEventListener('change', (e) => {
  e.target.checked ? map.addLayer(infrastructuresLayer) : map.removeLayer(infrastructuresLayer);
});
document.querySelectorAll('.statusFilter').forEach(cb => {
  cb.addEventListener('change', () => { renderWells(); renderWellList(); });
});
/* ==========================================================
   I ♥ GDC signage layer

   WHERE TO PASTE: at the very bottom of script.js (after all
   your other code, so `map` already exists).

   ALSO NEEDED:
   1. data/gdc.geojson            (the point file)
   2. images/i-love-gdc.gif       (create an "images" folder in the repo)
   3. In index.html, inside the Layers panel, add this line:
      <label class="toggle"><input type="checkbox" id="toggleGDC" checked><span>I &hearts; GDC signage</span></label>
   4. The CSS from gdc-style.css added to the end of style.css
   ========================================================== */

let gdcLayer;

function gdcIcon() {
  return L.divIcon({
    className: 'gdc-marker',
    html: `<div class="gdc-float">
             <img class="gdc-gif" src="images/i-love-gdc.gif" alt="I love GDC" draggable="false">
           </div>
           <div class="gdc-stem"></div>
           <div class="gdc-ring"></div>`,
    iconSize: [150, 95],
    iconAnchor: [75, 95],      // bottom-centre of the sign sits on the coordinate
    popupAnchor: [0, -90]
  });
}

// Own fetch with its own catch, so a missing file never breaks the rest of the dashboard.
fetch('data/gdc.geojson')
  .then(r => {
    if (!r.ok) throw new Error('gdc.geojson returned HTTP ' + r.status);
    return r.json();
  })
  .then(geojson => {
    gdcLayer = L.geoJSON(geojson, {
      pointToLayer: (feature, latlng) =>
        L.marker(latlng, { icon: gdcIcon(), zIndexOffset: 1000 }),
      onEachFeature: (feature, layer) => {
        const p = feature.properties || {};
        layer.bindPopup(
          `<div class="popup-title">${p.name || 'I ♥ GDC'}</div>
           <div class="popup-row">${p.message || ''}</div>`
        );
      }
    }).addTo(map);
  })
  .catch(err => console.warn('GDC signage layer not loaded:', err));

const gdcToggle = document.getElementById('toggleGDC');
if (gdcToggle) {
  gdcToggle.addEventListener('change', (e) => {
    if (!gdcLayer) return;
    e.target.checked ? map.addLayer(gdcLayer) : map.removeLayer(gdcLayer);
  });
}
/* ==========================================================
   Bounding-box export tool
   Draw a rectangle on the map, pick which layers to include,
   download a .zip containing:
     - a clipped GeoJSON file per selected vector layer
     - a cropped PNG of the current satellite basemap (optional)

   WHERE TO PASTE: at the very bottom of script.js (needs `map`
   and your existing layer variables - wellsLayer, plantsLayer,
   boundaryLayer, roadsLayer, infrastructuresLayer,
   resistivityLayer - to already exist).

   ALSO NEEDED in index.html, before script.js:
   <script src="https://unpkg.com/jszip@3.10.1/dist/jszip.min.js"></script>
   <script src="https://unpkg.com/leaflet-image@0.4.0/leaflet-image.js"></script>
   <script src="https://unpkg.com/@turf/turf@6/turf.min.js"></script>

   AND the export-tool-panel.html snippet added to the sidebar,
   and export-tool-style.css added to style.css.
   ========================================================== */

let drawing = false;
let startLatLng = null;
let bboxLayer = null;
let drawnBounds = null;

const startDrawBtn = document.getElementById('startDrawBtn');
const bboxStatusEl = document.getElementById('bboxStatus');
const downloadExportBtn = document.getElementById('downloadExportBtn');
const exportStatusEl = document.getElementById('exportStatus');

startDrawBtn.addEventListener('click', () => {
  drawing = true;
  startLatLng = null;
  map.dragging.disable();
  map.getContainer().style.cursor = 'crosshair';
  bboxStatusEl.textContent = 'Click and drag on the map to draw a box.';
  if (bboxLayer) { map.removeLayer(bboxLayer); bboxLayer = null; }
  drawnBounds = null;
  downloadExportBtn.disabled = true;
  exportStatusEl.textContent = '';
});

map.on('mousedown', (e) => {
  if (!drawing) return;
  startLatLng = e.latlng;
  if (bboxLayer) map.removeLayer(bboxLayer);
  bboxLayer = L.rectangle([startLatLng, startLatLng], {
    color: '#4FA8E0', weight: 2, fillOpacity: 0.08
  }).addTo(map);
  map.on('mousemove', onDrawMove);
});

function onDrawMove(e) {
  if (!drawing || !startLatLng) return;
  bboxLayer.setBounds(L.latLngBounds(startLatLng, e.latlng));
}

map.on('mouseup', (e) => {
  if (!drawing || !startLatLng) return;
  const bounds = L.latLngBounds(startLatLng, e.latlng);
  map.off('mousemove', onDrawMove);
  drawing = false;
  map.dragging.enable();
  map.getContainer().style.cursor = '';

  if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
    bboxStatusEl.textContent = 'That was just a click, not a drag — try again, holding the mouse down while you drag.';
    if (bboxLayer) { map.removeLayer(bboxLayer); bboxLayer = null; }
    startLatLng = null;
    return;
  }

  drawnBounds = bounds;
  bboxLayer.setBounds(drawnBounds);
  startLatLng = null;

  const ne = drawnBounds.getNorthEast(), sw = drawnBounds.getSouthWest();
  bboxStatusEl.innerHTML =
    `Box set: <span class="mono">${sw.lat.toFixed(4)}, ${sw.lng.toFixed(4)}</span> to <span class="mono">${ne.lat.toFixed(4)}, ${ne.lng.toFixed(4)}</span>`;
  downloadExportBtn.disabled = false;
});

// ---------------- Clipping ----------------
function clipFeatureCollectionToBBox(fc, bounds) {
  const west = bounds.getWest(), south = bounds.getSouth();
  const east = bounds.getEast(), north = bounds.getNorth();
  const turfBBox = [west, south, east, north];
  const out = { type: 'FeatureCollection', features: [] };

  (fc.features || []).forEach((f) => {
    if (!f.geometry) return;

    if (f.geometry.type === 'Point') {
      const [lng, lat] = f.geometry.coordinates;
      if (lng >= west && lng <= east && lat >= south && lat <= north) out.features.push(f);
      return;
    }

    try {
      const clipped = turf.bboxClip(f, turfBBox);
      if (clipped.geometry && clipped.geometry.coordinates && clipped.geometry.coordinates.length) {
        clipped.properties = f.properties;
        out.features.push(clipped);
      }
    } catch (e) {
      console.warn('Could not clip a feature (unsupported geometry type) - skipped:', e);
    }
  });

  return out;
}

// ---------------- Imagery capture ----------------
// ---------------- Imagery capture (FIXED: no longer hangs) ----------------
// Replace your existing captureImageryBlob function with this one.
//
// What was wrong: it waited on map.once('moveend', ...) before starting the
// screenshot, but fitBounds() doesn't fire 'moveend' at all if the map was
// already showing that area - so if your drawn box was already visible,
// the capture would wait forever for an event that was never coming.
//
// The fix: start the capture either when 'moveend' fires, OR after a short
// fallback delay, whichever comes first - with a guard so it only actually
// runs once. Also added an overall 20-second timeout so a flaky tile or
// network issue surfaces as a clear error instead of an endless spinner.

function captureImageryBlob(bounds) {
  return new Promise((resolve, reject) => {
    const prevCenter = map.getCenter();
    const prevZoom = map.getZoom();
    function restoreView() { map.setView(prevCenter, prevZoom, { animate: false }); }

    let settled = false;
    let captureStarted = false;

    const overallTimeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      restoreView();
      reject(new Error('Imagery capture timed out after 20 seconds'));
    }, 20000);

    function startCapture() {
      if (captureStarted) return;
      captureStarted = true;

      // Give tiles a moment to finish loading after the programmatic fit.
      setTimeout(() => {
        leafletImage(map, (err, canvas) => {
          if (settled) return;
          clearTimeout(overallTimeout);

          if (err) {
            settled = true;
            restoreView();
            reject(err);
            return;
          }

          try {
            const topLeft = map.latLngToContainerPoint(bounds.getNorthWest());
            const bottomRight = map.latLngToContainerPoint(bounds.getSouthEast());
            const sx = Math.max(0, Math.round(topLeft.x));
            const sy = Math.max(0, Math.round(topLeft.y));
            const sw = Math.max(1, Math.round(bottomRight.x - topLeft.x));
            const sh = Math.max(1, Math.round(bottomRight.y - topLeft.y));

            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = sw;
            cropCanvas.height = sh;
            cropCanvas.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

            cropCanvas.toBlob((blob) => {
              settled = true;
              restoreView();
              blob ? resolve(blob) : reject(new Error('Canvas produced no image data'));
            }, 'image/png');
          } catch (e) {
            settled = true;
            restoreView();
            reject(e); // typically a tainted-canvas error from a non-CORS tile source
          }
        });
      }, 700);
    }

    map.once('moveend', startCapture);
    map.fitBounds(bounds, { animate: false, padding: [20, 20] });

    // Fallback: if the box was already fully in view, fitBounds won't move
    // the map, so 'moveend' never fires. Start the capture anyway shortly
    // after - the captureStarted guard above makes this safe even if
    // 'moveend' DOES also fire around the same time.
    setTimeout(startCapture, 400);
  });
}

// ---------------- Main export ----------------
downloadExportBtn.addEventListener('click', runExport);

async function runExport() {
  if (!drawnBounds) return;
  downloadExportBtn.disabled = true;
  exportStatusEl.textContent = 'Preparing export...';

  const zip = new JSZip();
  const selected = Array.from(document.querySelectorAll('.exportLayer'))
    .filter((cb) => cb.checked).map((cb) => cb.value);

  const layerMap = {
    wells: wellsLayer,
    powerStations: plantsLayer,
    boundary: boundaryLayer,
    roads: typeof roadsLayer !== 'undefined' ? roadsLayer : null,
    infrastructure: typeof infrastructuresLayer !== 'undefined' ? infrastructuresLayer : null,
    resistivity: typeof resistivityLayer !== 'undefined' ? resistivityLayer : null
  };

  let addedAny = false;

  selected.filter((k) => k !== 'imagery').forEach((key) => {
    const layer = layerMap[key];
    if (!layer) return; // this layer never loaded (e.g. optional roads/infrastructure file missing)
    let fc;
    try {
      fc = layer.toGeoJSON();
    } catch (e) {
      console.warn('Could not read layer for export:', key, e);
      return;
    }
    const clipped = clipFeatureCollectionToBBox(fc, drawnBounds);
    if (clipped.features.length) {
      zip.file(`${key}.geojson`, JSON.stringify(clipped, null, 2));
      addedAny = true;
    }
  });

  if (selected.includes('imagery')) {
    exportStatusEl.textContent = 'Capturing imagery...';
    try {
      const blob = await captureImageryBlob(drawnBounds);
      zip.file('satellite_imagery.png', blob);
      addedAny = true;
    } catch (err) {
      console.warn('Imagery capture failed:', err);
      exportStatusEl.textContent = 'Imagery capture blocked by the current basemap\'s CORS policy — exported vector layers only. Try switching to the Satellite imagery basemap and exporting again.';
    }
  }

  if (!addedAny) {
    exportStatusEl.textContent = 'Nothing to export — check your layer selection and your box.';
    downloadExportBtn.disabled = false;
    return;
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `menengai-export-${Date.now()}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  if (!exportStatusEl.textContent.includes('blocked')) {
    exportStatusEl.textContent = 'Export downloaded.';
  }
  downloadExportBtn.disabled = false;
}
