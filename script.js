/* ==========================================================
   MENENGAI GEOTHERMAL DASHBOARD
   ==========================================================

   Features:
   - Esri satellite basemap
   - Dark / Streets / Terrain basemaps
   - Baringo resistivity PNG overlay (with dynamic legend)
   - Field boundary
   - Power stations
   - Wells
   - Roads
   - Infrastructure
   - GDC signage
   - Well filtering
   - Bounding-box image export
   - High-resolution PNG export

   ========================================================== */


/* ==========================================================
   STATUS COLORS
   ========================================================== */

const STATUS_COLORS = {
  'Producing': '#E4572E',
  'Non-producing': '#6B7A8F',
  'Injection': '#3EA39E'
};


/* ==========================================================
   MAP
   ========================================================== */

const map = L.map('map', {
  zoomControl: true,
  preferCanvas: true
}).setView([-0.196, 36.062], 13);


/* ==========================================================
   BASEMAPS
   ========================================================== */

const satelliteBasemap = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  {
    attribution: 'Tiles © Esri',
    maxZoom: 19,
    maxNativeZoom: 19,
    crossOrigin: true
  }
);



const streetsBasemap = L.tileLayer(
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  {
    attribution: '&copy; OpenStreetMap contributors',
    subdomains: 'abc',
    maxZoom: 19,
    maxNativeZoom: 19,
    crossOrigin: true
  }
);

const terrainBasemap = L.tileLayer(
  'https://tiles.maps.eox.at/wmts/1.0.0/terrain-light_3857/default/g/{z}/{y}/{x}.jpg',
  {
    attribution: 'Terrain Light by <a href="https://maps.eox.at">EOX</a>',
    maxZoom: 14,
    maxNativeZoom: 14,
    crossOrigin: true
  }
);


/* Add default basemap */

satelliteBasemap.addTo(map);


/* Layer control */

L.control.layers(
  {
    'Satellite imagery': satelliteBasemap,
   
    'Streets': streetsBasemap,
    'Terrain': terrainBasemap
  },
  null,
  {
    position: 'topright',
    collapsed: true
  }
).addTo(map);


/* ==========================================================
   BARINGO RESISTIVITY OVERLAY
   ========================================================== */

const baringoBounds = L.latLngBounds(
  [0.513865, 35.926064],   // SW corner
  [0.751210, 36.179994]    // NE corner
);

const baringoResistivityOverlay = L.imageOverlay(
  'images/baringo-resistivity.png',
  baringoBounds,
  { opacity: 0.75 }
);


/* ============================================
   DYNAMIC RESISTIVITY LEGEND
   ============================================ */

// Create a legend control on the map
const resistivityLegend = L.control({
    position: 'bottomright'
});

resistivityLegend.onAdd = function () {
    const div = L.DomUtil.create(
        'div',
        'map-resistivity-legend'
    );

    div.style.cssText = `
        background: rgba(15, 20, 25, 0.94);
        padding: 12px;
        border: 1px solid #888;
        border-radius: 8px;
        color: white;
        max-width: 230px;
        display: none;
    `;

    div.innerHTML = `
        <div id="resistivityLegendTitle"
             style="font-weight:bold;
                    margin-bottom:8px;">
            Resistivity Legend
        </div>

        <img id="resistivityLegendImage"
             src=""
             alt="Resistivity colour scale"
             style="width:100%;
                    height:auto;
                    display:block;">
    `;

    return div;
};

resistivityLegend.addTo(map);


// Change the legend to match the selected layer
function showResistivityLegend(title, imagePath) {
    const box = document.querySelector(
        '.map-resistivity-legend'
    );

    const image = document.getElementById(
        'resistivityLegendImage'
    );

    const heading = document.getElementById(
        'resistivityLegendTitle'
    );

    if (!box || !image || !heading) return;

    heading.textContent = title;
    image.src = imagePath;
    image.alt = title + ' colour scale';

    box.style.display = 'block';
}


// Hide the legend when the resistivity layer is off
function hideResistivityLegend() {
  const box = document.querySelector('.map-resistivity-legend');
  if (box) box.style.display = 'none';
}


/* ----------------------------------------------------------
   Baringo toggle
   ---------------------------------------------------------- */

const baringoToggle =
    document.getElementById('toggleBaringo');

function updateBaringoLayer() {
    if (baringoToggle && baringoToggle.checked) {
        map.addLayer(baringoResistivityOverlay);

        showResistivityLegend(
            'Baringo Resistivity',
            'images/baringo-resistivity-legend.png'
        );
    } else {
        map.removeLayer(baringoResistivityOverlay);
        hideResistivityLegend();
    }
}

if (baringoToggle) {
    baringoToggle.addEventListener(
        'change',
        updateBaringoLayer
    );

    updateBaringoLayer();
}


const jumpToBaringoBtn = document.getElementById('jumpToBaringo');
if (jumpToBaringoBtn) {
  jumpToBaringoBtn.addEventListener('click', () => {
    map.flyTo(baringoBounds.getCenter(), 12, { duration: 1 });
  });
}


/* ==========================================================
   RESISTIVITY BY YEAR (PNG overlays)
   ==========================================================

   TO ADD A YEAR: copy one line in RESISTIVITY_YEARS, then
   set its year, image path, legend path and bounds.

   bounds = [[south, west], [north, east]]  (lat, lng, WGS84)
   ========================================================== */

const RESISTIVITY_YEARS = [
  {
    year: 2015,
    image: 'images/resistivity-2015.png',
    legend: 'images/baringo-resistivity-legend.png',
    bounds: [[0.513865, 35.926064], [0.751210, 36.179994]]    // REPLACE with real extent
  },
  {
    year: 2019,
    image: 'images/resistivity2019.png',
    legend: 'images/Color_Scales_0m.png',
    bounds: [[0.513865, 35.926064], [0.751210, 36.179994]]  // REPLACE with real extent
  },
  {
    year: 2023,
    image: 'images/resistivity-2023.png',
    legend: 'images/Color_Scales_500m.png',
    bounds: [[0.513865, 35.926064], [0.751210, 36.179994]]  // REPLACE with real extent
  }
];

const RESISTIVITY_OPACITY = 0.75;

/* Pane below vector layers so wells/boundary stay visible on top */
map.createPane('resistivityPane');
map.getPane('resistivityPane').style.zIndex = 350;

let activeResistivityYear = null;
let activeResistivityLayer = null;

const resistivityToggle = document.getElementById('toggleResistivity');
const yearPillsEl = document.getElementById('yearPills');
const resistivityStatsEl = document.getElementById('resistivityStats');

function renderResistivityStats(entry) {
  if (!resistivityStatsEl) return;
  if (!entry || !resistivityToggle || !resistivityToggle.checked) {
    resistivityStatsEl.textContent = '';
    return;
  }
  const [[s, w], [n, e]] = entry.bounds;
  resistivityStatsEl.innerHTML =
    `<span class="mono">${entry.year}</span> survey &middot; ` +
    `<span class="mono">${s.toFixed(3)}, ${w.toFixed(3)}</span> to ` +
    `<span class="mono">${n.toFixed(3)}, ${e.toFixed(3)}</span>`;
}

function updateResistivityPills() {
  if (!yearPillsEl) return;
  yearPillsEl.querySelectorAll('button').forEach(btn => {
    const isActive = Number(btn.dataset.year) === activeResistivityYear;
    btn.classList.toggle('active', isActive);
    btn.style.background = isActive ? '#E8B33D' : 'transparent';
    btn.style.color = isActive ? '#171412' : 'inherit';
  });
}

function applyResistivityYear() {
  // Remove any currently active year layer
  if (activeResistivityLayer) {
    map.removeLayer(activeResistivityLayer);
    activeResistivityLayer = null;
  }

  const entry = RESISTIVITY_YEARS.find(y => y.year === activeResistivityYear);
  const visible = resistivityToggle ? resistivityToggle.checked : false;

  // If no year selected or the main toggle is OFF → hide everything
  if (!entry || !visible) {
    hideResistivityLegend();
    renderResistivityStats(null);
    return;
  }

  // Show the selected year’s image
  activeResistivityLayer = L.imageOverlay(
    entry.image,
    L.latLngBounds(entry.bounds),
    { opacity: RESISTIVITY_OPACITY, pane: 'resistivityPane' }
  ).addTo(map);

  // Show the matching legend
  showResistivityLegend(`Resistivity ${entry.year}`, entry.legend);
  renderResistivityStats(entry);
}

function selectResistivityYear(year) {
  activeResistivityYear = year;
  updateResistivityPills();
  applyResistivityYear();
}

if (yearPillsEl) {
  yearPillsEl.innerHTML = '';
  yearPillsEl.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;';
  RESISTIVITY_YEARS.forEach(entry => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-small year-pill';
    btn.dataset.year = entry.year;
    btn.textContent = entry.year;
    btn.addEventListener('click', () => selectResistivityYear(entry.year));
    yearPillsEl.appendChild(btn);
  });
}

if (resistivityToggle) {
  resistivityToggle.addEventListener('change', applyResistivityYear);
}

/* Start with the newest year selected */
if (RESISTIVITY_YEARS.length) {
  selectResistivityYear(RESISTIVITY_YEARS[RESISTIVITY_YEARS.length - 1].year);
}


/* ==========================================================
   MAIN VECTOR LAYERS
   ========================================================== */

let boundaryLayer = null;
let plantsLayer = null;
let wellsLayer = null;
let roadsLayer = null;
let infrastructuresLayer = null;

let wellsData = [];


/* ----------------------------------------------------------
   Safe GeoJSON fetch
   ---------------------------------------------------------- */

function safeFetchGeoJSON(path) {

  return fetch(path)

    .then(response => {

      if (!response.ok) {

        throw new Error(
          `${path} returned HTTP ${response.status}`
        );

      }

      return response.json();

    })

    .catch(error => {

      console.warn(
        `Optional layer not loaded - ${path}:`,
        error
      );

      return null;

    });

}


/* ----------------------------------------------------------
   Load core layers
   ---------------------------------------------------------- */

Promise.all([

  fetch(
    'data/field_boundary.geojson'
  ).then(r => {

    if (!r.ok) {
      throw new Error(
        `field_boundary.geojson HTTP ${r.status}`
      );
    }

    return r.json();

  }),

  fetch(
    'data/power_stations.geojson'
  ).then(r => {

    if (!r.ok) {
      throw new Error(
        `power_stations.geojson HTTP ${r.status}`
      );
    }

    return r.json();

  }),

  fetch(
    'data/wells.geojson'
  ).then(r => {

    if (!r.ok) {
      throw new Error(
        `wells.geojson HTTP ${r.status}`
      );
    }

    return r.json();

  }),

  safeFetchGeoJSON(
    'data/AccessRoads.geojson'
  ),

  safeFetchGeoJSON(
    'data/Infrastructures.geojson'
  )

])

.then(
  ([
    boundary,
    plants,
    wells,
    roads,
    infrastructures
  ]) => {


    /* ------------------------------------------------------
       Boundary
       ------------------------------------------------------ */

    boundaryLayer =
      L.geoJSON(
        boundary,
        {
          style: {

            color: '#E8B33D',

            weight: 2,

            dashArray: '6 4',

            fillOpacity: 0.04,

            fillColor: '#E8B33D'

          }
        }
      ).addTo(map);


    /* ------------------------------------------------------
       Power stations
       ------------------------------------------------------ */

    plantsLayer =
      L.geoJSON(
        plants,
        {

          pointToLayer:
            (feature, latlng) => {

              return L.marker(
                latlng,
                {
                  icon:
                    plantIcon()
                }
              )

              .bindPopup(
                plantPopup(
                  feature.properties || {}
                )
              );

            }

        }
      ).addTo(map);


    /* ------------------------------------------------------
       Wells
       ------------------------------------------------------ */

    wellsData =
      wells?.features || [];

    wellsLayer =
      L.layerGroup().addTo(map);

    renderWells();

    renderWellList();

    renderStats(
      wellsData,
      plants?.features || []
    );


    /* ------------------------------------------------------
       Roads
       ------------------------------------------------------ */

    if (roads) {

      roadsLayer =
        L.geoJSON(
          roads,
          {

            style: {

              color: '#FFB6C1',

              weight: 0.8,

              fillOpacity: 0.04,

              fillColor: '#FFB6C1'

            }

          }
        ).addTo(map);

    }


    /* ------------------------------------------------------
       Infrastructure
       ------------------------------------------------------ */

    if (infrastructures) {

      infrastructuresLayer =
        L.geoJSON(
          infrastructures,
          {

            style: {

              color: '#50ef50',

              weight: 0.8,

              fillOpacity: 0.04,

              fillColor: '#50ef50'

            }

          }
        ).addTo(map);

    }

  }
)

.catch(error => {

  console.error(
    'Could not load core dashboard data:',
    error
  );

  const mapElement =
    document.getElementById('map');

  if (mapElement) {

    mapElement.innerHTML = `
      <p style="
        color:#ADA49A;
        padding:24px;
        font-family:Inter,sans-serif;
      ">
        Could not load core data files.
        <br><br>
        If you opened index.html directly from disk,
        browsers may block local fetch().
        <br><br>
        Run a local server:
        <br>
        <code>
          python -m http.server
        </code>
        <br><br>
        Then open:
        <br>
        <code>
          http://localhost:8000
        </code>
      </p>
    `;

  }

});


/* ==========================================================
   POWER STATION ICON
   ========================================================== */

function plantIcon() {

  return L.divIcon({

    className: '',

    html: `
      <div style="
        width:16px;
        height:16px;
        background:#E8B33D;
        border:2px solid #171412;
        border-radius:3px;
        transform:rotate(45deg);
        box-shadow:0 0 0 2px #E8B33D66;
      "></div>
    `,

    iconSize: [16, 16],

    iconAnchor: [8, 8]

  });

}


/* ==========================================================
   WELL ICON
   ========================================================== */

function wellIcon(status) {

  const color =
    STATUS_COLORS[status] ||
    '#999999';


  const pulse =
    status === 'Producing'

      ? `
        <div
          class="pulse-ring"
          style="
            position:absolute;
            top:-4px;
            left:-4px;
            width:16px;
            height:16px;
          "
        ></div>
      `

      : '';


  return L.divIcon({

    className: '',

    html: `
      <div style="
        position:relative;
        width:8px;
        height:8px;
      ">

        ${pulse}

        <div style="
          width:8px;
          height:8px;
          border-radius:50%;
          background:${color};
          border:1.5px solid #171412;
        "></div>

      </div>
    `,

    iconSize: [8, 8],

    iconAnchor: [4, 4]

  });

}


/* ==========================================================
   WELL POPUP
   ========================================================== */

function wellPopup(p) {

  const reportLink =
    p.report_url

      ? `
        <a
          class="popup-report-btn"
          href="${p.report_url}"
          target="_blank"
          rel="noopener"
        >
          Download daily report (PDF)
        </a>
      `

      : `
        <div class="popup-row popup-report-missing">
          No daily report on file for this well.
        </div>
      `;


  return `
    <div class="popup-title">
      ${p.well_id ?? 'Well'}
    </div>

    <div class="popup-row">
      <span class="popup-label">
        Status
      </span>
      ${p.status ?? 'N/A'}
    </div>

    <div class="popup-row">
      <span class="popup-label">
        Phase
      </span>
      ${p.phase ?? 'N/A'}
    </div>

    <div class="popup-row">
      <span class="popup-label">
        Depth
      </span>
      ${
        Number.isFinite(
          Number(p.depth_m)
        )
          ? Number(p.depth_m).toLocaleString()
          : 'N/A'
      }
      m
    </div>

    <div class="popup-row">
      <span class="popup-label">
        Reservoir temp
      </span>
      ${p.temp_c ?? 'N/A'}
      &deg;C
    </div>

    <div class="popup-row">
      <span class="popup-label">
        Pressure
      </span>
      ${p.pressure_bar ?? 'N/A'}
      bar
    </div>

    ${reportLink}
  `;

}


/* ==========================================================
   POWER STATION POPUP
   ========================================================== */

function plantPopup(p) {

  return `
    <div class="popup-title">
      ${p.name ?? 'Power station'}
    </div>

    <div class="popup-row">
      Capacity:
      ${p.capacity_mw ?? 'N/A'}
      MW
    </div>
  `;

}


/* ==========================================================
   INFRASTRUCTURE POPUP
   ========================================================== */

function infrastructuresPopup(p) {

  return `
    <div class="popup-title">
      ${p.Name ?? 'Infrastructure'}
    </div>

    <div class="popup-row">
      Name:
      ${p.Name ?? 'N/A'}
    </div>
  `;

}


/* ==========================================================
   ACTIVE WELL STATUS FILTERS
   ========================================================== */

function activeStatuses() {

  return Array.from(
    document.querySelectorAll(
      '.statusFilter'
    )
  )

  .filter(
    checkbox => checkbox.checked
  )

  .map(
    checkbox => checkbox.value
  );

}


/* ==========================================================
   RENDER WELLS
   ========================================================== */

function renderWells() {

  if (!wellsLayer) {
    return;
  }

  wellsLayer.clearLayers();

  const allowed =
    activeStatuses();


  wellsData

    .filter(feature =>
      allowed.includes(
        feature.properties?.status
      )
    )

    .forEach(feature => {

      if (
        !feature.geometry ||
        !feature.geometry.coordinates
      ) {
        return;
      }

      const [
        lng,
        lat
      ] =
        feature.geometry.coordinates;


      L.marker(
        [lat, lng],
        {
          icon:
            wellIcon(
              feature.properties?.status
            )
        }
      )

      .bindPopup(
        wellPopup(
          feature.properties || {}
        )
      )

      .addTo(wellsLayer);

    });

}


/* ==========================================================
   WELL LIST
   ========================================================== */

function renderWellList() {

  const container =
    document.getElementById(
      'wellList'
    );

  if (!container) {
    return;
  }

  container.innerHTML = '';

  const allowed =
    activeStatuses();


  wellsData

    .filter(feature =>
      allowed.includes(
        feature.properties?.status
      )
    )

    .forEach(feature => {

      const p =
        feature.properties || {};


      const row =
        document.createElement(
          'div'
        );

      row.className =
        'well-row';


      row.innerHTML = `
        <span>
          ${p.well_id ?? 'Unknown'}
        </span>

        <span class="temp">
          ${p.temp_c ?? 'N/A'}&deg;C
        </span>
      `;


      row.addEventListener(
        'click',
        () => {

          const [
            lng,
            lat
          ] =
            feature.geometry.coordinates;


          map.flyTo(
            [lat, lng],
            15,
            {
              duration: 0.6
            }
          );

        }
      );


      container.appendChild(row);

    });

}


/* ==========================================================
   DASHBOARD STATISTICS
   ========================================================== */

function renderStats(
  wellFeatures,
  plantFeatures
) {

  const total =
    wellFeatures.length;


  const producing =
    wellFeatures.filter(
      feature =>
        feature.properties?.status ===
        'Producing'
    ).length;


  const capacity =
    plantFeatures.reduce(
      (sum, feature) =>
        sum +
        Number(
          feature.properties?.capacity_mw
        || 0
        ),
      0
    );


  const temperatures =
    wellFeatures
      .map(feature =>
        Number(
          feature.properties?.temp_c
        )
      )
      .filter(Number.isFinite);


  const avgTemp =
    temperatures.length
      ? Math.round(
          temperatures.reduce(
            (sum, value) =>
              sum + value,
            0
          ) /
          temperatures.length
        )
      : 0;


  const statStrip =
    document.getElementById(
      'statStrip'
    );


  if (!statStrip) {
    return;
  }


  statStrip.innerHTML = `

    <div class="stat">
      <span class="value mono">
        ${total}
      </span>

      <span class="label">
        Wells mapped
      </span>
    </div>


    <div class="stat">
      <span class="value mono">
        ${producing}
      </span>

      <span class="label">
        Producing
      </span>
    </div>


    <div class="stat">
      <span class="value mono">
        ${capacity} MW
      </span>

      <span class="label">
        Installed capacity
      </span>
    </div>


    <div class="stat">
      <span class="value mono">
        ${avgTemp}&deg;C
      </span>

      <span class="label">
        Avg. reservoir temp
      </span>
    </div>

  `;

}


/* ==========================================================
   LAYER TOGGLE HELPER
   ========================================================== */

function setupLayerToggle(
  elementId,
  getLayer
) {

  const checkbox =
    document.getElementById(
      elementId
    );

  if (!checkbox) {
    return;
  }


  checkbox.addEventListener(
    'change',
    event => {

      const layer =
        getLayer();


      if (!layer) {
        return;
      }


      if (event.target.checked) {

        map.addLayer(layer);

      } else {

        map.removeLayer(layer);

      }

    }
  );

}


/* ==========================================================
   LAYER CONTROLS
   ========================================================== */

setupLayerToggle(
  'toggleBoundary',
  () => boundaryLayer
);

setupLayerToggle(
  'togglePlants',
  () => plantsLayer
);

setupLayerToggle(
  'toggleWells',
  () => wellsLayer
);

setupLayerToggle(
  'toggleRoads',
  () => roadsLayer
);

setupLayerToggle(
  'toggleInfrastructures',
  () =>
    infrastructuresLayer
);


/* ==========================================================
   WELL STATUS FILTERS
   ========================================================== */

document
  .querySelectorAll(
    '.statusFilter'
  )
  .forEach(
    checkbox => {

      checkbox.addEventListener(
        'change',
        () => {

          renderWells();

          renderWellList();

        }
      );

    }
  );


/* ==========================================================
   GDC SIGNAGE
   ========================================================== */

let gdcLayer = null;


/* ----------------------------------------------------------
   GDC icon
   ---------------------------------------------------------- */

function gdcIcon() {

  return L.divIcon({

    className:
      'gdc-marker',

    html: `
      <div class="gdc-float">

        <img
          class="gdc-gif"
          src="images/i-love-gdc.gif"
          alt="I love GDC"
          draggable="false"
        >

      </div>

      <div class="gdc-stem"></div>

      <div class="gdc-ring"></div>
    `,

    iconSize: [
      150,
      95
    ],

    iconAnchor: [
      75,
      95
    ],

    popupAnchor: [
      0,
      -90
    ]

  });

}


/* ----------------------------------------------------------
   Load GDC signage
   ---------------------------------------------------------- */

fetch(
  'data/gdc.geojson'
)

.then(response => {

  if (!response.ok) {

    throw new Error(
      `gdc.geojson returned HTTP ${response.status}`
    );

  }

  return response.json();

})

.then(geojson => {

  gdcLayer =
    L.geoJSON(
      geojson,
      {

        pointToLayer:
          (feature, latlng) => {

            return L.marker(
              latlng,
              {
                icon:
                  gdcIcon(),

                zIndexOffset:
                  1000
              }
            );

          },


        onEachFeature:
          (feature, layer) => {

            const p =
              feature.properties || {};


            layer.bindPopup(`

              <div class="popup-title">
                ${p.name || 'I ♥ GDC'}
              </div>

              <div class="popup-row">
                ${p.message || ''}
              </div>

            `);

          }

      }
    ).addTo(map);

})

.catch(error => {

  console.warn(
    'GDC signage layer not loaded:',
    error
  );

});


/* ----------------------------------------------------------
   GDC toggle
   ---------------------------------------------------------- */

const gdcToggle =
  document.getElementById(
    'toggleGDC'
  );


if (gdcToggle) {

  gdcToggle.addEventListener(
    'change',
    event => {

      if (!gdcLayer) {
        return;
      }


      if (event.target.checked) {

        map.addLayer(
          gdcLayer
        );

      } else {

        map.removeLayer(
          gdcLayer
        );

      }

    }
  );

}


/* ==========================================================
   HIGH-RESOLUTION BOUNDING BOX EXPORT
   ==========================================================

   IMPORTANT:

   This version:
   - Uses html2canvas
   - Uses scale 3
   - Crops using scaled coordinates
   - Uses PNG instead of JPEG
   - Uses high image smoothing
   - Removes the bounding box before capture
   - Restores the bounding box afterwards
   - Avoids clipping errors
   - Handles large canvas sizes more safely

   ========================================================== */


/* ----------------------------------------------------------
   Export state
   ---------------------------------------------------------- */

let drawing = false;

let startLatLng = null;

let bboxLayer = null;

let drawnBounds = null;


/* ----------------------------------------------------------
   Export controls
   ---------------------------------------------------------- */

const startDrawBtn =
  document.getElementById(
    'startDrawBtn'
  );

const bboxStatusEl =
  document.getElementById(
    'bboxStatus'
  );

const downloadExportBtn =
  document.getElementById(
    'downloadExportBtn'
  );

const exportStatusEl =
  document.getElementById(
    'exportStatus'
  );


/* ----------------------------------------------------------
   Check export controls
   ---------------------------------------------------------- */

if (
  !startDrawBtn ||
  !bboxStatusEl ||
  !downloadExportBtn ||
  !exportStatusEl
) {

  console.warn(
    'Export controls are missing from index.html.'
  );

}


/* ==========================================================
   START DRAWING
   ========================================================== */

if (startDrawBtn) {

  startDrawBtn.addEventListener(
    'click',
    () => {

      drawing = true;

      startLatLng = null;

      drawnBounds = null;


      map.dragging.disable();


      map.getContainer()
        .style.cursor =
        'crosshair';


      if (bboxLayer) {

        map.removeLayer(
          bboxLayer
        );

        bboxLayer = null;

      }


      if (downloadExportBtn) {

        downloadExportBtn.disabled =
          true;

      }


      if (bboxStatusEl) {

        bboxStatusEl.textContent =
          'Click and drag on the map to draw a box.';

      }


      if (exportStatusEl) {

        exportStatusEl.textContent =
          '';

      }

    }
  );

}


/* ==========================================================
   MOUSE DOWN
   ========================================================== */

map.on(
  'mousedown',
  event => {

    if (!drawing) {
      return;
    }


    startLatLng =
      event.latlng;


    if (bboxLayer) {

      map.removeLayer(
        bboxLayer
      );

    }


    bboxLayer =
      L.rectangle(
        [
          startLatLng,
          startLatLng
        ],
        {

          color: '#4FA8E0',

          weight: 2,

          fillOpacity: 0.08

        }
      ).addTo(map);


    map.on(
      'mousemove',
      onDrawMove
    );

  }
);


/* ==========================================================
   MOUSE MOVE
   ========================================================== */

function onDrawMove(event) {

  if (
    !drawing ||
    !startLatLng ||
    !bboxLayer
  ) {

    return;

  }


  bboxLayer.setBounds(
    L.latLngBounds(
      startLatLng,
      event.latlng
    )
  );

}


/* ==========================================================
   MOUSE UP
   ========================================================== */

map.on(
  'mouseup',
  event => {

    if (
      !drawing ||
      !startLatLng
    ) {

      return;

    }


    const bounds =
      L.latLngBounds(
        startLatLng,
        event.latlng
      );


    map.off(
      'mousemove',
      onDrawMove
    );


    drawing = false;


    map.dragging.enable();


    map.getContainer()
      .style.cursor =
      '';


    /* ------------------------------------------------------
       Reject simple click
       ------------------------------------------------------ */

    if (
      bounds.getNorthEast()
        .equals(
          bounds.getSouthWest()
        )
    ) {

      if (bboxStatusEl) {

        bboxStatusEl.textContent =
          'That was just a click, not a drag. Try again.';

      }


      if (bboxLayer) {

        map.removeLayer(
          bboxLayer
        );

        bboxLayer = null;

      }


      startLatLng = null;

      return;

    }


    /* ------------------------------------------------------
       Save bounds
       ------------------------------------------------------ */

    drawnBounds =
      bounds;


    if (bboxLayer) {

      bboxLayer.setBounds(
        drawnBounds
      );

    }


    startLatLng = null;


    const ne =
      drawnBounds.getNorthEast();

    const sw =
      drawnBounds.getSouthWest();


    if (bboxStatusEl) {

      bboxStatusEl.innerHTML = `

        Box set:

        <span class="mono">
          ${sw.lat.toFixed(4)},
          ${sw.lng.toFixed(4)}
        </span>

        to

        <span class="mono">
          ${ne.lat.toFixed(4)},
          ${ne.lng.toFixed(4)}
        </span>

      `;

    }


    if (downloadExportBtn) {

      downloadExportBtn.disabled =
        false;

    }

  }
);


/* ==========================================================
   WAIT FOR MAP IMAGES
   ========================================================== */

function waitForMapImages(
  maxWaitMs = 10000
) {

  return new Promise(
    resolve => {

      const start =
        Date.now();


      function check() {

        const images =
          map
            .getContainer()
            .querySelectorAll(
              'img'
            );


        const allLoaded =
          Array.from(
            images
          ).every(
            img =>
              img.complete &&
              img.naturalWidth > 0
          );


        if (
          allLoaded ||
          Date.now() - start >
            maxWaitMs
        ) {

          resolve();

          return;

        }


        setTimeout(
          check,
          150
        );

      }


      check();

    }
  );

}


/* ==========================================================
   HIGH-RESOLUTION MAP CAPTURE
   ========================================================== */

function captureMapImage(
  bounds
) {

  return new Promise(
    (resolve, reject) => {

      /*
       * 3x resolution.
       *
       * Example:
       * map = 1200 x 800 px
       * export = approximately
       * 3600 x 2400 px
       */

      const EXPORT_SCALE = 3;


      const overallTimeout =
        setTimeout(
          () => {

            reject(
              new Error(
                'High-resolution image capture timed out.'
              )
            );

          },
          40000
        );


      waitForMapImages(
        10000
      )

      .then(
        () => {

          if (
            typeof html2canvas !==
            'function'
          ) {

            throw new Error(
              'html2canvas is not loaded. Add html2canvas to index.html before script.js.'
            );

          }


          return html2canvas(
            map.getContainer(),
            {

              /*
               * Main quality improvement
               */

              scale:
                EXPORT_SCALE,


              /*
               * CORS allows compatible
               * remote map tiles to render.
               */

              useCORS:
                true,


              allowTaint:
                false,


              /*
               * White background prevents
               * transparent/black areas.
               */

              backgroundColor:
                '#ffffff',


              logging:
                false,


              imageTimeout:
                20000,


              /*
               * High quality browser
               * interpolation.
               */

              onclone:
                clonedDocument => {

                  const clonedMap =
                    clonedDocument
                      .querySelector(
                        '#map'
                      );

                  if (
                    clonedMap
                  ) {

                    clonedMap.style
                      .imageRendering =
                      'auto';

                  }

                },


              /*
               * Do not capture UI controls.
               */

              ignoreElements:
                element => {

                  return (
                    element.classList &&
                    element.classList.contains(
                      'leaflet-control-container'
                    )
                  );

                }

            }
          );

        }
      )

      .then(
        fullCanvas => {

          clearTimeout(
            overallTimeout
          );


          try {

            /*
             * Convert geographic bounds
             * into Leaflet screen coordinates.
             */

            const topLeft =
              map.latLngToContainerPoint(
                bounds.getNorthWest()
              );


            const bottomRight =
              map.latLngToContainerPoint(
                bounds.getSouthEast()
              );


            /*
             * IMPORTANT:
             *
             * html2canvas is scaled 3x,
             * therefore crop coordinates
             * must also be multiplied by 3.
             */

            const sx =
              Math.max(
                0,
                Math.round(
                  topLeft.x *
                  EXPORT_SCALE
                )
              );


            const sy =
              Math.max(
                0,
                Math.round(
                  topLeft.y *
                  EXPORT_SCALE
                )
              );


            const requestedWidth =
              Math.round(
                (
                  bottomRight.x -
                  topLeft.x
                ) *
                EXPORT_SCALE
              );


            const requestedHeight =
              Math.round(
                (
                  bottomRight.y -
                  topLeft.y
                ) *
                EXPORT_SCALE
              );


            /*
             * Prevent crop from extending
             * outside the captured canvas.
             */

            const sw =
              Math.min(
                requestedWidth,
                fullCanvas.width -
                  sx
              );


            const sh =
              Math.min(
                requestedHeight,
                fullCanvas.height -
                  sy
              );


            if (
              sw <= 0 ||
              sh <= 0
            ) {

              throw new Error(
                'Invalid export area. Draw a larger bounding box inside the map.'
              );

            }


            /*
             * Create high-resolution
             * cropped canvas.
             */

            const cropCanvas =
              document.createElement(
                'canvas'
              );


            cropCanvas.width =
              sw;

            cropCanvas.height =
              sh;


            const ctx =
              cropCanvas.getContext(
                '2d'
              );


            if (!ctx) {

              throw new Error(
                'Could not create canvas rendering context.'
              );

            }


            /*
             * High-quality image
             * interpolation.
             */

            ctx.imageSmoothingEnabled =
              true;

            ctx.imageSmoothingQuality =
              'high';


            /*
             * Crop without resizing.
             *
             * This preserves the 3x
             * rendered resolution.
             */

            ctx.drawImage(
              fullCanvas,

              sx,
              sy,
              sw,
              sh,

              0,
              0,
              sw,
              sh
            );


            /*
             * PNG avoids JPEG compression
             * artifacts around roads,
             * labels and raster boundaries.
             */

            cropCanvas.toBlob(
              blob => {

                if (!blob) {

                  reject(
                    new Error(
                      'Canvas produced no image data.'
                    )
                  );

                  return;

                }


                resolve(
                  blob
                );

              },

              'image/png'
            );

          }

          catch (error) {

            reject(
              error
            );

          }

        }
      )

      .catch(
        error => {

          clearTimeout(
            overallTimeout
          );

          reject(
            error
          );

        }
      );

    }
  );

}


/* ==========================================================
   EXPORT BUTTON
   ========================================================== */

if (downloadExportBtn) {

  downloadExportBtn.addEventListener(
    'click',
    runExport
  );

}


/* ==========================================================
   RUN EXPORT
   ========================================================== */

async function runExport() {

  if (!drawnBounds) {

    if (exportStatusEl) {

      exportStatusEl.textContent =
        'Draw an export box first.';

    }

    return;

  }


  if (
    typeof html2canvas !==
    'function'
  ) {

    if (exportStatusEl) {

      exportStatusEl.textContent =
        'Export error: html2canvas is not loaded.';

    }

    return;

  }


  if (downloadExportBtn) {

    downloadExportBtn.disabled =
      true;

  }


  if (exportStatusEl) {

    exportStatusEl.textContent =
      'Preparing high-resolution image...';

  }


  /*
   * Remember whether the bounding box
   * was visible before export.
   */

  const bboxWasOnMap =
    bboxLayer &&
    map.hasLayer(
      bboxLayer
    );


  /*
   * Hide export rectangle.
   */

  if (bboxWasOnMap) {

    map.removeLayer(
      bboxLayer
    );

  }


  /*
   * Force Leaflet to finish rendering
   * before screenshot.
   */

  map.invalidateSize(
    false
  );


  try {

    if (exportStatusEl) {

      exportStatusEl.textContent =
        'Rendering high-resolution image...';

    }


    /*
     * Capture selected area.
     */

    const blob =
      await captureMapImage(
        drawnBounds
      );


    /*
     * Create download URL.
     */

    const url =
      URL.createObjectURL(
        blob
      );


    /*
     * Create download link.
     */

    const link =
      document.createElement(
        'a'
      );


    link.href =
      url;


    link.download =
      `menengai-export-${Date.now()}.png`;


    document.body.appendChild(
      link
    );


    link.click();


    link.remove();


    /*
     * Give browser time to start
     * the download before releasing URL.
     */

    setTimeout(
      () => {

        URL.revokeObjectURL(
          url
        );

      },
      1000
    );


    if (exportStatusEl) {

      exportStatusEl.textContent =
        'High-resolution PNG downloaded successfully.';

    }

  }

  catch (error) {

    console.error(
      'Image capture failed:',
      error
    );


    if (exportStatusEl) {

      exportStatusEl.textContent =
        `Image capture failed: ${
          error.message ||
          error
        }`;

    }

  }

  finally {

    /*
     * Restore bounding box.
     */

    if (
      bboxWasOnMap &&
      bboxLayer
    ) {

      map.addLayer(
        bboxLayer
      );

    }


    if (downloadExportBtn) {

      downloadExportBtn.disabled =
        false;

    }

  }

}


/* ==========================================================
   END OF SCRIPT
   ========================================================== */
