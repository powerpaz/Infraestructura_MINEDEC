// Simple CSV viewer with optional map (no DB)
// Params: ?csv=data/Tabla1.csv
let rows = [];
let headers = [];
let page = 1;
const pageSize = 25;
let filtered = [];

const csvSelect = document.getElementById('csvSelect');
const csvFile = document.getElementById('csvFile');
const searchInput = document.getElementById('search');
const statusEl = document.getElementById('status');
const thead = document.querySelector('#dataTable thead');
const tbody = document.querySelector('#dataTable tbody');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const pageInfo = document.getElementById('pageInfo');

// Map init
const map = L.map('map').setView([-1.5,-78], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'© OpenStreetMap' }).addTo(map);
let markers = L.layerGroup().addTo(map);

function getParamCSV(){
  const u = new URLSearchParams(window.location.search);
  return u.get('csv');
}

function loadCSV(pathOrFile){
  statusEl.textContent = 'Cargando…';
  return new Promise((resolve,reject)=>{
    Papa.parse(pathOrFile, {
      header:true,
      dynamicTyping:false,
      skipEmptyLines:true,
      complete: res => resolve(res.data),
      error: err => reject(err)
    });
  });
}

function detectHeaders(arr){
  if (!arr.length) return [];
  return Object.keys(arr[0]);
}

function renderTable(){
  const start = (page-1)*pageSize;
  const shown = filtered.slice(start, start+pageSize);

  thead.innerHTML = '<tr>' + headers.map(h=>`<th>${h}</th>`).join('') + '</tr>';
  tbody.innerHTML = shown.map(r=>'<tr>'+headers.map(h=>`<td>${r[h]??''}</td>`).join('')+'</tr>').join('');

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  pageInfo.textContent = `Página ${page} / ${totalPages} — Filas: ${filtered.length}`;
  prevBtn.disabled = page<=1;
  nextBtn.disabled = page>=totalPages;
}

function applySearch(){
  const q = (searchInput.value || '').toLowerCase();
  if (!q){ filtered = rows.slice(); page=1; renderTable(); updateMap(); return; }
  filtered = rows.filter(r => headers.some(h => String(r[h]??'').toLowerCase().includes(q)));
  page = 1;
  renderTable();
  updateMap();
}

function toNum(x){
  const s = String(x??'').trim().replace(',','.');
  const n = parseFloat(s);
  return isNaN(n)?null:n;
}

function updateMap(){
  // Try to find lat/lon header names
  const latKey = headers.find(h => /^lat(itud)?$/i.test(h));
  const lonKey = headers.find(h => /^lon(gitud)?$/i.test(h));
  markers.clearLayers();
  if (!latKey || !lonKey){ statusEl.textContent = 'Sin columnas de Lat/Long → no se dibuja mapa.'; return; }

  const pts = [];
  filtered.forEach(r => {
    const lat = toNum(r[latKey]);
    const lon = toNum(r[lonKey]);
    if (lat!=null && lon!=null){
      const m = L.circleMarker([lat,lon], { radius:7, fillColor:'#e11d48', color:'#fff', weight:2, fillOpacity:.95 })
        .bindPopup(`<pre style="margin:0;font-size:12px">${JSON.stringify(r, null, 2)}</pre>`);
      m.on('mouseover',()=>m.setStyle({radius:9}));
      m.on('mouseout',()=>m.setStyle({radius:7}));
      markers.addLayer(m);
      pts.push([lat,lon]);
    }
  });
  if (pts.length){
    const bounds = L.latLngBounds(pts);
    map.fitBounds(bounds.pad(0.2));
    statusEl.textContent = `Registros en mapa: ${pts.length}`;
  } else {
    statusEl.textContent = 'No hay registros con coordenadas.';
  }
}

// Events
prevBtn.onclick = ()=>{ if(page>1){page--; renderTable();} };
nextBtn.onclick = ()=>{ const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize)); if(page<totalPages){page++; renderTable();} };
searchInput.oninput = ()=>applySearch();
csvSelect.onchange = async ()=>{
  rows = await loadCSV(csvSelect.value);
  headers = detectHeaders(rows);
  filtered = rows.slice();
  page = 1;
  renderTable();
  updateMap();
};
csvFile.onchange = async (e)=>{
  if (!e.target.files?.length) return;
  rows = await loadCSV(e.target.files[0]);
  headers = detectHeaders(rows);
  filtered = rows.slice();
  page = 1;
  renderTable();
  updateMap();
};

// Init
(async function init(){
  const qs = getParamCSV();
  if (qs){
    // If param present, insert as first option
    const opt = document.createElement('option');
    opt.value = qs; opt.textContent = qs;
    csvSelect.prepend(opt);
    csvSelect.value = qs;
  }
  rows = await loadCSV(csvSelect.value);
  headers = detectHeaders(rows);
  filtered = rows.slice();
  renderTable();
  updateMap();
})();