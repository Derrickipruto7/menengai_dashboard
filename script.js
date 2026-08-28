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

const satelliteBasemap = L.tileLayer('https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg', {
  attribution: 'Sentinel-2 cloudless by <a href="https://s2maps.eu">EOX IT Services GmbH</a> (Contains modified Copernicus Sentinel data)',
  maxZoom: 14
});
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

let boundaryLayer, plantsLayer, wellsLayer;
let wellsData = [];

Promise.all([
  fetch('data/field_boundary.geojson').then(r => r.json()),
  fetch('data/power_stations.geojson').then(r => r.json()),
  fetch('data/wells.geojson').then(r => r.json())
]).then(([boundary, plants, wells]) => {

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

}).catch(err => {
  document.getElementById('map').innerHTML =
    '<p style="color:#ADA49A;padding:24px;font-family:Inter,sans-serif;">Could not load data files. If you\'re opening index.html directly from disk, browsers block local fetch() — run a local server instead, e.g. <code>python3 -m http.server</code> from this folder, then visit localhost.</p>';
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
document.querySelectorAll('.statusFilter').forEach(cb => {
  cb.addEventListener('change', () => { renderWells(); renderWellList(); });
});
