/* ==========================================================
   MENENGAI GEOTHERMAL DASHBOARD
   ==========================================================

   Features:
   - Esri satellite basemap
   - Dark / Streets / Terrain basemaps
   - Resistivity survey points
   - Resistivity GeoTIFF rasters
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

const darkBasemap = L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
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
    'Dark': darkBasemap,
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
   RESISTIVITY SURVEY
   ========================================================== */

let resistivityData = [];
let resistivityYears = [];
let selectedYear = null;

let resistivityLayer = L.layerGroup().addTo(map);


/* ----------------------------------------------------------
   Resistivity color scale
   ---------------------------------------------------------- */

function resistivityColor(ohmM) {

  const value = Number(ohmM);

  if (!Number.isFinite(value)) {
    return '#999999';
  }

  if (value < 5) {
    return '#B91C1C';
  }

  if (value < 15) {
    return '#F97316';
  }

  if (value < 40) {
    return '#FACC15';
  }

  if (value < 100) {
    return '#22C55E';
  }

  return '#2563EB';
}


/* ----------------------------------------------------------
   Load resistivity GeoJSON
   ---------------------------------------------------------- */

fetch('data/resistivity.geojson')

  .then(response => {

    if (!response.ok) {
      throw new Error(
        `resistivity.geojson returned HTTP ${response.status}`
      );
    }

    return response.json();
  })

  .then(geojson => {

    resistivityData = geojson.features || [];

    resistivityYears = [
      ...new Set(
        resistivityData
          .map(feature => feature.properties?.year)
          .filter(year => year !== undefined && year !== null)
      )
    ].sort((a, b) => Number(a) - Number(b));

    if (resistivityYears.length > 0) {

      selectedYear =
        resistivityYears[resistivityYears.length - 1];

      renderYearPills();
      renderResistivityLayer();

    }

  })

  .catch(error => {

    console.warn(
      'Could not load resistivity data:',
      error
    );

  });


/* ----------------------------------------------------------
   Year pills
   ---------------------------------------------------------- */

function renderYearPills() {

  const container =
    document.getElementById('yearPills');

  if (!container) {
    return;
  }

  container.innerHTML = '';

  resistivityYears.forEach(year => {

    const pill =
      document.createElement('button');

    pill.className =
      'year-pill' +
      (year === selectedYear ? ' active' : '');

    pill.textContent = year;

    pill.addEventListener('click', () => {

      selectedYear = year;

      renderYearPills();

      renderResistivityLayer();

      loadResistivityRaster(selectedYear);

    });

    container.appendChild(pill);

  });

}


/* ----------------------------------------------------------
   Render resistivity points
   ---------------------------------------------------------- */

function renderResistivityLayer() {

  resistivityLayer.clearLayers();

  const stations =
    resistivityData.filter(
      feature =>
        String(feature.properties?.year) ===
        String(selectedYear)
    );

  stations.forEach(feature => {

    if (
      !feature.geometry ||
      !feature.geometry.coordinates
    ) {
      return;
    }

    const [
      lng,
      lat
    ] = feature.geometry.coordinates;

    const p =
      feature.properties || {};

    const color =
      resistivityColor(
        p.resistivity_ohm_m
      );

    L.circleMarker(
      [lat, lng],
      {
        radius: 9,
        fillColor: color,
        fillOpacity: 0.85,
        color: '#171412',
        weight: 1.5
      }
    )

      .bindPopup(`
        <div class="popup-title">
          ${p.station_id ?? 'Station'}
          &middot;
          ${p.year ?? ''}
        </div>

        <div class="popup-row">
          <span class="popup-label">
            Resistivity
          </span>
          ${p.resistivity_ohm_m ?? 'N/A'}
          &Omega;&middot;m
        </div>

        <div class="popup-row">
          <span class="popup-label">
            Depth
          </span>
          ${p.depth_m ?? 'N/A'} m
        </div>
      `)

      .addTo(resistivityLayer);

  });


  /* Statistics */

  const values =
    stations
      .map(f =>
        Number(
          f.properties?.resistivity_ohm_m
        )
      )
      .filter(Number.isFinite);


  const avg =
    values.length
      ? Math.round(
          values.reduce(
            (sum, value) =>
              sum + value,
            0
          ) / values.length
        )
      : 0;


  const stats =
    document.getElementById(
      'resistivityStats'
    );

  if (stats) {

    stats.innerHTML = `
      <div class="stat-inline">
        <span class="value mono">
          ${stations.length}
        </span>
        <span class="label">
          stations in ${selectedYear ?? ''}
        </span>
      </div>

      <div class="stat-inline">
        <span class="value mono">
          ${avg} &Omega;&middot;m
        </span>
        <span class="label">
          average reading
        </span>
      </div>
    `;

  }

}


/* ==========================================================
   RESISTIVITY GEOTIFF RASTERS
   ========================================================== */

const resistivityRasters = {

  2015:
    'data/resistivity-rasters/resistivity_2015.tif',

  2019:
    'data/resistivity-rasters/resistivity_2019.tif',

  2023:
    'data/resistivity-rasters/resistivity_2023.tif'

};


let resistivityRasterLayer = null;

const georasterCache = {};


/* ----------------------------------------------------------
   Load resistivity raster
   ---------------------------------------------------------- */

function loadResistivityRaster(year) {

  /* Remove previous raster */

  if (resistivityRasterLayer) {

    map.removeLayer(
      resistivityRasterLayer
    );

    resistivityRasterLayer = null;

  }


  const url =
    resistivityRasters[year];

  if (!url) {
    return;
  }


  const toggle =
    document.getElementById(
      'toggleResistivityRaster'
    );

  const showRaster =
    toggle
      ? toggle.checked
      : true;

  if (!showRaster) {
    return;
  }


  /* --------------------------------------------------------
     Build raster layer
     -------------------------------------------------------- */

  const buildLayer =
    georaster => {

      resistivityRasterLayer =
        new GeoRasterLayer({

          georaster: georaster,

          opacity: 0.65,

          resolution: 128,

          pixelValuesToColorFn:
            values => {

              const value =
                values?.[0];

              if (
                value === undefined ||
                value === null ||
                !Number.isFinite(
                  Number(value)
                ) ||
                Number(value) <= -9999
              ) {

                return null;

              }

              return resistivityColor(
                Number(value)
              );

            }

        });


      resistivityRasterLayer.addTo(
        map
      );

    };


  /* --------------------------------------------------------
     Use cached raster
     -------------------------------------------------------- */

  if (georasterCache[year]) {

    buildLayer(
      georasterCache[year]
    );

    return;

  }


  /* --------------------------------------------------------
     Download and parse GeoTIFF
     -------------------------------------------------------- */

  fetch(url)

    .then(response => {

      if (!response.ok) {

        throw new Error(
          `${url} returned HTTP ${response.status}`
        );

      }

      return response.arrayBuffer();

    })

    .then(arrayBuffer =>
      parseGeoraster(
        arrayBuffer
      )
    )

    .then(georaster => {

      georasterCache[year] =
        georaster;

      buildLayer(
        georaster
      );

    })

    .catch(error => {

      console.warn(
        `Resistivity raster not loaded for ${year}:`,
        error
      );

    });

}


/* ----------------------------------------------------------
   Raster toggle
   ---------------------------------------------------------- */

const rasterToggle =
  document.getElementById(
    'toggleResistivityRaster'
  );


if (rasterToggle) {

  rasterToggle.addEventListener(
    'change',
    () => {

      loadResistivityRaster(
        selectedYear
      );

    }
  );

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
