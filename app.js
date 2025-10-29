diff --git a/app.js b/app.js
index 2ce5195300443b56e2a33021273efba4bd5cbc72..d85b3c5f594c3b119862129e7337f23d2ef62c1a 100644
--- a/app.js
+++ b/app.js
@@ -1,141 +1,319 @@
-// Simple CSV viewer with optional map (no DB)
-// Params: ?csv=data/Tabla1.csv
+// Visor de CSV con filtros temáticos y mapa
+const PAGE_SIZE = 25;
+
 let rows = [];
 let headers = [];
-let page = 1;
-const pageSize = 25;
 let filtered = [];
+let page = 1;
+let filterState = {};
+
+const datasetConfig = {
+  'data/Tabla1.csv': {
+    title: 'Matriz de universidades y escuelas politécnicas',
+    description: 'Instituciones y Establecimientos Educativos a nivel nacional con detalle de financiamiento, ubicación territorial y base operativa.',
+    filters: [
+      { key: 'TIPO_FINAN', label: 'Tipo de financiamiento' },
+      { key: 'BASE', label: 'Base' },
+      { key: 'DPA_DESPRO', label: 'Provincia' }
+    ]
+  },
+  'data/Tabla4.csv': {
+    title: 'Matriz de institutos superiores técnicos y tecnológicos',
+    description: 'Listado de institutos técnicos y tecnológicos reportados por el Ministerio, con clasificación territorial y tipo de sede.',
+    filters: [
+      { key: 'TIPO', label: 'Tipo de institución' },
+      { key: 'BASE', label: 'Base' },
+      { key: 'DPA_DESPRO', label: 'Provincia' }
+    ]
+  },
+  'data/Tabla2.csv': {
+    title: 'Estructura de la EOD y Repositorios de Cultura',
+    description: 'Geovisor de Cultura y Patrimonio con repositorios culturales y museos identificados por el Ministerio de Cultura y Patrimonio.',
+    filters: [
+      { key: 'EOD', label: 'Entidad o dependencia (EOD)' },
+      { key: 'REPOSITORI', label: 'Repositorio cultural' },
+      { key: 'DPA_DESPRO', label: 'Provincia' }
+    ]
+  },
+  'data/Tabla3.csv': {
+    title: 'Matriz de infraestructura deportiva',
+    description: 'Matriz de infraestructura deportiva de la Subsecretaría de Servicios del Sistema Deportivo con estado, uso y entidad responsable.',
+    filters: [
+      { key: 'ENTIDAD_QU', label: 'Entidad' },
+      { key: 'ESTADO_DEL', label: 'Estado' },
+      { key: 'Uso', label: 'Uso' },
+      { key: 'DPA_DESPRO', label: 'Provincia' }
+    ]
+  }
+};
 
 const csvSelect = document.getElementById('csvSelect');
 const csvFile = document.getElementById('csvFile');
 const searchInput = document.getElementById('search');
 const statusEl = document.getElementById('status');
 const thead = document.querySelector('#dataTable thead');
 const tbody = document.querySelector('#dataTable tbody');
 const prevBtn = document.getElementById('prevBtn');
 const nextBtn = document.getElementById('nextBtn');
 const pageInfo = document.getElementById('pageInfo');
+const filtersWrap = document.getElementById('filters');
+const clearFiltersBtn = document.getElementById('clearFilters');
+const datasetTitleEl = document.getElementById('datasetTitle');
+const datasetDescEl = document.getElementById('datasetDesc');
 
-// Map init
-const map = L.map('map').setView([-1.5,-78], 6);
-L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'© OpenStreetMap' }).addTo(map);
-let markers = L.layerGroup().addTo(map);
+// Map initialization
+const map = L.map('map', { zoomControl: true, scrollWheelZoom: true }).setView([-1.8, -78.5], 6);
+L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
+  attribution: '© OpenStreetMap contributors'
+}).addTo(map);
+const markers = L.layerGroup().addTo(map);
 
-function getParamCSV(){
+function getParamCSV() {
   const u = new URLSearchParams(window.location.search);
   return u.get('csv');
 }
 
-function loadCSV(pathOrFile){
+function loadCSV(pathOrFile) {
   statusEl.textContent = 'Cargando…';
-  return new Promise((resolve,reject)=>{
+  return new Promise((resolve, reject) => {
     Papa.parse(pathOrFile, {
-      header:true,
-      dynamicTyping:false,
-      skipEmptyLines:true,
+      header: true,
+      dynamicTyping: false,
+      skipEmptyLines: true,
       complete: res => resolve(res.data),
       error: err => reject(err)
     });
   });
 }
 
-function detectHeaders(arr){
+function detectHeaders(arr) {
   if (!arr.length) return [];
   return Object.keys(arr[0]);
 }
 
-function renderTable(){
-  const start = (page-1)*pageSize;
-  const shown = filtered.slice(start, start+pageSize);
+function uniqueSortedValues(arr, key) {
+  const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
+  const values = new Set();
+  arr.forEach(row => {
+    const raw = row[key];
+    if (raw === undefined || raw === null) return;
+    const value = String(raw).trim();
+    if (value) values.add(value);
+  });
+  return Array.from(values).sort(collator.compare);
+}
 
-  thead.innerHTML = '<tr>' + headers.map(h=>`<th>${h}</th>`).join('') + '</tr>';
-  tbody.innerHTML = shown.map(r=>'<tr>'+headers.map(h=>`<td>${r[h]??''}</td>`).join('')+'</tr>').join('');
+function buildFilters(source) {
+  filtersWrap.innerHTML = '';
+  filterState = {};
+  const config = datasetConfig[source];
+  if (!config || !config.filters?.length) return;
 
-  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
-  pageInfo.textContent = `Página ${page} / ${totalPages} — Filas: ${filtered.length}`;
-  prevBtn.disabled = page<=1;
-  nextBtn.disabled = page>=totalPages;
+  config.filters.forEach(({ key, label }) => {
+    const field = document.createElement('label');
+    field.className = 'field';
+    const span = document.createElement('span');
+    span.textContent = label;
+
+    const select = document.createElement('select');
+    select.dataset.key = key;
+    select.innerHTML = '<option value="">Todos</option>';
+
+    uniqueSortedValues(rows, key).forEach(value => {
+      const option = document.createElement('option');
+      option.value = value;
+      option.textContent = value;
+      select.append(option);
+    });
+
+    select.onchange = () => {
+      if (select.value) {
+        filterState[key] = select.value;
+      } else {
+        delete filterState[key];
+      }
+      applyFilters();
+    };
+
+    field.append(span, select);
+    filtersWrap.append(field);
+  });
 }
 
-function applySearch(){
-  const q = (searchInput.value || '').toLowerCase();
-  if (!q){ filtered = rows.slice(); page=1; renderTable(); updateMap(); return; }
-  filtered = rows.filter(r => headers.some(h => String(r[h]??'').toLowerCase().includes(q)));
-  page = 1;
-  renderTable();
-  updateMap();
+function renderTable() {
+  const start = (page - 1) * PAGE_SIZE;
+  const shown = filtered.slice(start, start + PAGE_SIZE);
+
+  thead.innerHTML = '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>';
+  tbody.innerHTML = shown
+    .map(row => '<tr>' + headers.map(h => `<td>${row[h] ?? ''}</td>`).join('') + '</tr>')
+    .join('');
+
+  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
+  pageInfo.textContent = `Página ${Math.min(page, totalPages)} / ${totalPages} — ${filtered.length} registros`;
+  prevBtn.disabled = page <= 1;
+  nextBtn.disabled = page >= totalPages;
 }
 
-function toNum(x){
-  const s = String(x??'').trim().replace(',','.');
+function toNum(value) {
+  const s = String(value ?? '').trim().replace(',', '.');
   const n = parseFloat(s);
-  return isNaN(n)?null:n;
+  return Number.isFinite(n) ? n : null;
 }
 
-function updateMap(){
-  // Try to find lat/lon header names
-  const latKey = headers.find(h => /^lat(itud)?$/i.test(h));
-  const lonKey = headers.find(h => /^lon(gitud)?$/i.test(h));
+function updateMap() {
+  const latKey = headers.find(h => /lat(itud)?/i.test(h));
+  const lonKey = headers.find(h => /lon(gitud)?/i.test(h));
   markers.clearLayers();
-  if (!latKey || !lonKey){ statusEl.textContent = 'Sin columnas de Lat/Long → no se dibuja mapa.'; return; }
-
-  const pts = [];
-  filtered.forEach(r => {
-    const lat = toNum(r[latKey]);
-    const lon = toNum(r[lonKey]);
-    if (lat!=null && lon!=null){
-      const m = L.circleMarker([lat,lon], { radius:7, fillColor:'#e11d48', color:'#fff', weight:2, fillOpacity:.95 })
-        .bindPopup(`<pre style="margin:0;font-size:12px">${JSON.stringify(r, null, 2)}</pre>`);
-      m.on('mouseover',()=>m.setStyle({radius:9}));
-      m.on('mouseout',()=>m.setStyle({radius:7}));
-      markers.addLayer(m);
-      pts.push([lat,lon]);
+
+  if (!latKey || !lonKey) {
+    return { hasCoords: false, count: 0, message: 'Sin columnas de coordenadas.' };
+  }
+
+  const coordinates = [];
+  filtered.forEach(row => {
+    const lat = toNum(row[latKey]);
+    const lon = toNum(row[lonKey]);
+    if (lat !== null && lon !== null) {
+      const marker = L.circleMarker([lat, lon], {
+        radius: 8,
+        fillColor: '#19d3a2',
+        color: '#041d1f',
+        weight: 2,
+        fillOpacity: 0.95
+      });
+      marker.bindTooltip(row[headers[0]] ? String(row[headers[0]]) : 'Registro');
+      markers.addLayer(marker);
+      coordinates.push([lat, lon]);
     }
   });
-  if (pts.length){
-    const bounds = L.latLngBounds(pts);
+
+  if (coordinates.length) {
+    const bounds = L.latLngBounds(coordinates);
     map.fitBounds(bounds.pad(0.2));
-    statusEl.textContent = `Registros en mapa: ${pts.length}`;
+    return { hasCoords: true, count: coordinates.length, message: `Registros en mapa: ${coordinates.length}` };
+  }
+
+  return { hasCoords: false, count: 0, message: 'No hay registros con coordenadas válidas.' };
+}
+
+function applyFilters() {
+  const query = (searchInput.value || '').toLowerCase();
+  filtered = rows.filter(row => {
+    const matchesQuery = !query || headers.some(h => String(row[h] ?? '').toLowerCase().includes(query));
+    if (!matchesQuery) return false;
+
+    return Object.entries(filterState).every(([key, value]) => {
+      if (!value) return true;
+      return String(row[key] ?? '').trim() === value;
+    });
+  });
+
+  page = 1;
+  renderTable();
+  const mapInfo = updateMap();
+  const summary = [`${filtered.length} registros filtrados`];
+  if (mapInfo?.message) summary.push(mapInfo.message);
+  statusEl.textContent = summary.join('. ');
+}
+
+function setDatasetMetadata(source) {
+  const config = datasetConfig[source];
+  if (config) {
+    datasetTitleEl.textContent = config.title;
+    datasetDescEl.textContent = config.description;
   } else {
-    statusEl.textContent = 'No hay registros con coordenadas.';
+    datasetTitleEl.textContent = 'Conjunto de datos';
+    datasetDescEl.textContent = '';
   }
 }
 
-// Events
-prevBtn.onclick = ()=>{ if(page>1){page--; renderTable();} };
-nextBtn.onclick = ()=>{ const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize)); if(page<totalPages){page++; renderTable();} };
-searchInput.oninput = ()=>applySearch();
-csvSelect.onchange = async ()=>{
-  rows = await loadCSV(csvSelect.value);
+prevBtn.onclick = () => {
+  if (page > 1) {
+    page -= 1;
+    renderTable();
+  }
+};
+
+nextBtn.onclick = () => {
+  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
+  if (page < totalPages) {
+    page += 1;
+    renderTable();
+  }
+};
+
+searchInput.oninput = () => applyFilters();
+
+csvSelect.onchange = async () => {
+  await loadAndRender(csvSelect.value);
+};
+
+csvFile.onchange = async event => {
+  const file = event.target.files?.[0];
+  if (!file) return;
+
+  const data = await loadCSV(file);
+  rows = data;
   headers = detectHeaders(rows);
+  filterState = {};
   filtered = rows.slice();
   page = 1;
+  setDatasetMetadata('');
+  datasetTitleEl.textContent = `Archivo local: ${file.name}`;
+  datasetDescEl.textContent = 'Datos cargados desde su equipo.';
+  filtersWrap.innerHTML = '';
   renderTable();
-  updateMap();
+  const mapInfo = updateMap();
+  const summary = [`Archivo local cargado (${rows.length} registros)`];
+  if (mapInfo?.message) summary.push(mapInfo.message);
+  statusEl.textContent = summary.join('. ');
+};
+
+clearFiltersBtn.onclick = () => {
+  searchInput.value = '';
+  filterState = {};
+  Array.from(filtersWrap.querySelectorAll('select')).forEach(select => {
+    select.value = '';
+  });
+  applyFilters();
 };
-csvFile.onchange = async (e)=>{
-  if (!e.target.files?.length) return;
-  rows = await loadCSV(e.target.files[0]);
+
+async function loadAndRender(source) {
+  rows = await loadCSV(source);
   headers = detectHeaders(rows);
   filtered = rows.slice();
   page = 1;
+  filterState = {};
+  searchInput.value = '';
+  setDatasetMetadata(source);
+  buildFilters(source);
   renderTable();
-  updateMap();
-};
+  const mapInfo = updateMap();
+  const summary = [`${rows.length} registros cargados`];
+  if (mapInfo?.message) summary.push(mapInfo.message);
+  statusEl.textContent = summary.join('. ');
+}
+
+(async function init() {
+  Array.from(csvSelect.options).forEach(option => {
+    const conf = datasetConfig[option.value];
+    if (conf) option.textContent = conf.title;
+  });
 
-// Init
-(async function init(){
   const qs = getParamCSV();
-  if (qs){
-    // If param present, insert as first option
+  if (qs) {
     const opt = document.createElement('option');
-    opt.value = qs; opt.textContent = qs;
+    opt.value = qs;
+    opt.textContent = qs;
     csvSelect.prepend(opt);
     csvSelect.value = qs;
   }
-  rows = await loadCSV(csvSelect.value);
-  headers = detectHeaders(rows);
-  filtered = rows.slice();
-  renderTable();
-  updateMap();
-})();
\ No newline at end of file
+
+  try {
+    await loadAndRender(csvSelect.value);
+  } catch (error) {
+    console.error(error);
+    statusEl.textContent = 'Error al cargar el archivo.';
+  }
+})();
