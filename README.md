# Menengai Geothermal Field Dashboard

An interactive, browser-based GIS dashboard for the Menengai geothermal field
(Nakuru County, Kenya). Built with QGIS for data prep and Leaflet for the
web map — no server, no build step.

**Important:** `data/wells.geojson` currently contains **placeholder well
locations and readings** for layout purposes only, not real GDC well data.
`data/power_stations.geojson` uses publicly documented coordinates for the
three Menengai power stations, and `data/field_boundary.geojson` is a rough
approximation of the caldera outline. Replace all three with your real QGIS
layers before using this for anything beyond a demo.

## Part 1 — Prepare your data in QGIS

1. **Load your source data.** Bring in your well locations (points), field
   boundary or lease area (polygon), faults/fractures (lines), and any
   raster layers (temperature grids, resistivity, geology) as separate
   layers in a QGIS project.

2. **Reproject to WGS84.** Web maps expect EPSG:4326. If your data is in a
   local UTM zone (Menengai sits in UTM Zone 36S / EPSG:32736), reproject:
   `Layer > Save As... > CRS: EPSG:4326 - WGS 84`.

3. **Clean up attributes.** Keep only the fields you want in the dashboard
   popups (well ID, status, phase, depth, temperature, etc.) — trim the
   rest with the field calculator or "Save As" field selection to keep file
   size down.

4. **Style for your own reference (optional).** Symbolize by status/phase
   in QGIS itself so you have a matching legend when cross-checking against
   the web dashboard.

5. **Export each layer as GeoJSON.**
   Right-click a layer → `Export` → `Save Features As...` →
   Format: `GeoJSON`, CRS: `EPSG:4326`.
   Save as:
   - `data/wells.geojson`
   - `data/field_boundary.geojson`
   - `data/power_stations.geojson` (or add new files — see Part 3)

   Match the property names already used in the sample files
   (`well_id`, `status`, `phase`, `depth_m`, `temp_c`) or update
   `script.js` to reference your own field names.

## Part 2 — Run the dashboard

Browsers block `fetch()` of local files opened directly (`file://`), so
serve the folder instead of double-clicking `index.html`:

```bash
cd menengai-geothermal-dashboard
python3 -m http.server 8000
```

Visit `http://localhost:8000`. To publish it, push the folder to GitHub and
enable GitHub Pages (Settings → Pages → Deploy from branch → root).

## Part 3 — Adding more layers

To add a new layer (e.g. resistivity zones, fault lines, lithology):

1. Export it from QGIS as GeoJSON into `data/`.
2. In `script.js`, add it to the `Promise.all([...])` fetch list.
3. Add an `L.geoJSON(...)` call with your own styling (see the existing
   `boundaryLayer` and `plantsLayer` for patterns — lines and polygons use
   `style:`, points use `pointToLayer:`).
4. Add a matching toggle checkbox in `index.html`'s "Layers" panel and wire
   it up the same way as `toggleBoundary` at the bottom of `script.js`.

## Files

```
index.html                    Page structure and panel layout
style.css                     Dark volcanic/geothermal design system
script.js                     Map init, GeoJSON loading, filters, stats
data/wells.geojson            Well points (SAMPLE — replace with real data)
data/field_boundary.geojson   Caldera outline (approximate)
data/power_stations.geojson   Power station points (real public coordinates)
```

## Alternative: QGIS's built-in web export

If you'd rather not maintain hand-written JS, the **qgis2web** plugin
(Plugins → Manage and Install Plugins → search "qgis2web") exports a styled
QGIS project directly to a Leaflet or OpenLayers web page, including your
symbology and popups, with no coding required. It's less customizable than
this dashboard but faster if you mainly need a straightforward map viewer.
For a heavier, database-backed dashboard with live data (not static
GeoJSON snapshots), look into **QGIS Server** + **Lizmap**, which serves
your QGIS project as WMS/WFS and gives a full web client with filtering,
printing, and time-series support.

## License

MIT — do whatever you like with it.
