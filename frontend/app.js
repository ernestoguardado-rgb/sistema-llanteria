const API = '';
let usuarioActual = null;
let chartEstados, chartMarcas;

async function api(path, options={}) {
  const res = await fetch(API + path, { headers: { 'Content-Type':'application/json' }, ...options });
  return res.json();
}
function $(id){ return document.getElementById(id); }
function escapeHtml(t){ return String(t ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
function badgeEstado(e){ const s=String(e||'').toLowerCase(); let c='badge-default'; if(s.includes('montada'))c='badge-montada'; else if(s.includes('bodega'))c='badge-bodega'; else if(s.includes('reencauche'))c='badge-reencauche'; else if(s.includes('basura'))c='badge-basura'; return `<span class="badge ${c}">${escapeHtml(e||'-')}</span>`; }
function claseProfundidad(v){ const n=Number(v||0); if(!n)return ''; if(n<=4)return 'prof-critica'; if(n<=9)return 'prof-alerta'; return 'prof-normal'; }

async function login(){
  const usuario=$('usuario').value.trim(), clave=$('clave').value.trim(), msg=$('loginMsg');
  if(!usuario||!clave){msg.className='msg error';msg.textContent='Ingresa usuario y clave.';return;}
  msg.className='msg warn';msg.textContent='Validando acceso...';
  const resp=await api('/api/auth/login',{method:'POST',body:JSON.stringify({usuario,clave})});
  if(resp.ok){usuarioActual=resp;$('loginScreen').classList.add('hidden');$('appScreen').classList.remove('hidden');$('userInfo').textContent=`${resp.nombre} · ${resp.rol}`;abrirModulo('inicio');}
  else{msg.className='msg error';msg.textContent=resp.message||'No se pudo iniciar sesión.';}
}
function logout(){usuarioActual=null;$('appScreen').classList.add('hidden');$('loginScreen').classList.remove('hidden');}

function abrirModulo(m){
  const titulo=$('tituloModulo'), sub=$('subtituloModulo'), view=$('moduleView');

  if(!puedeAbrirModulo(m)){
  titulo.textContent = 'Acceso restringido';
  sub.textContent = 'No tienes permiso para acceder a este módulo';
  view.innerHTML = `
    <div class="content-card">
      <h3>Acceso denegado</h3>
      <p>Tu rol actual no tiene permiso para abrir esta sección.</p>
    </div>
  `;
  return;
}

  if(m==='inicio'){
    titulo.textContent='RASTREO LLANTERIA';
    sub.textContent='Indicadores principales del sistema';
    view.innerHTML=renderDashboardInicio();
    cargarDashboard();
    return;
  }

  if(m==='usuarios'){
    titulo.textContent='Usuarios';
    sub.textContent='Administración de accesos y permisos';
    view.innerHTML=renderUsuarios();
    cargarUsuarios();
    return;
  }

  if(m==='ingreso'){
    titulo.textContent='Ingreso de llantas';
    sub.textContent='Registro de llantas nuevas y reencauchadas';
    view.innerHTML=renderIngreso();
    return;
  }

  if(m==='calibracion'){
    titulo.textContent='Calibración / Cambios';
    sub.textContent='Registro operativo de calibraciones';
    view.innerHTML=renderCalibracion();
    return;
  }

  if(m==='inventario'){
    titulo.textContent='Inventario';
    sub.textContent='Consulta visual de llantas por TM o medida';
    view.innerHTML=renderInventario();
    return;
  }

  if(m==='bodega'){
    titulo.textContent='Consulta de unidad';
    sub.textContent='Visualiza llantas montadas por unidad';
    view.innerHTML=renderUnidad();
    return;
  }

  if(m==='reportes'){
    titulo.textContent='Reportes PDF';
    sub.textContent='Explora y descarga reportes generados';
    cargarReportes('');
    return;
  }
}

function renderDashboardInicio(){return `<div class="content-card"><h3>Dashboard general</h3><p>Resumen del estado actual.</p><div id="dashboardBox"><div class="msg warn" style="display:block">Cargando...</div></div></div>`;}
async function cargarDashboard(){const data=await api('/api/dashboard');$('dashboardBox').innerHTML=renderDashboard(data);setTimeout(()=>charts(data),50);}
function renderDashboard(d){
  const e = d.estados || {};

  return `
    <div class="dashboard-top" style="margin-bottom:14px;display:flex;justify-content:flex-end">
      <button class="btn-primary" onclick="exportarExcel()">
        📊 Exportar Excel
      </button>
    </div>

    <div class="dashboard-grid">
      ${kpi('🛞','Total',d.total || 0,'total')}
      ${kpi('🚛','Montadas',e.Montada||0,'montadas')}
      ${kpi('📦','Bodega',e['En bodega']||0,'bodega')}
      ${kpi('♻️','Reencauche',e['Enviada a reencauche']||e.Reencauche||0,'reencauche')}
      ${kpi('❌','Basura',e.Basura||0,'basura')}
      ${kpi('⚠️','Críticas',d.criticas || 0,'criticas')}
    </div>

    <div class="dashboard-charts">
      <div class="content-card">
        <h3>Estado</h3>
        <div class="chart-box">
          <canvas id="chartEstados"></canvas>
        </div>
      </div>

      <div class="content-card">
        <h3>Marcas</h3>
        <div class="chart-box">
          <canvas id="chartMarcas"></canvas>
        </div>
      </div>
    </div>

    <div class="content-card" style="margin-top:12px">
      <h3>Movimientos recientes</h3>
      ${tablaMovs(d.movimientos||[])}
    </div>
  `;
}
function kpi(icon,t,v,f){return `<div class="kpi-card" onclick="detalleKPI('${f}')"><div class="kpi-icon">${icon}</div><div><p>${t}</p><h2>${v}</h2></div></div>`;}
function charts(d){ if(!d.estados || !d.marcas){
  return;
}if(chartEstados)chartEstados.destroy();if(chartMarcas)chartMarcas.destroy();chartEstados=new Chart($('chartEstados'),{type:'doughnut',data:{labels:Object.keys(d.estados),datasets:[{data:Object.values(d.estados)}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}}}});const top=Object.entries(d.marcas).sort((a,b)=>b[1]-a[1]).slice(0,8);chartMarcas=new Chart($('chartMarcas'),{type:'bar',data:{labels:top.map(x=>x[0]),datasets:[{data:top.map(x=>x[1])}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}});}
function tablaMovs(ms){return `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>TM</th><th>Movimiento</th><th>Unidad</th></tr></thead><tbody>${ms.map(m=>`<tr><td>${escapeHtml(m.fecha)}</td><td>${escapeHtml(m.tm)}</td><td>${escapeHtml(m.tipo_movimiento)}</td><td>${escapeHtml(m.unidad)}</td></tr>`).join('')}</tbody></table></div>`;}
async function detalleKPI(f){
  let modal = $('modalDetalleKPI');

  if(!modal){
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div id="modalDetalleKPI"></div>`
    );
    modal = $('modalDetalleKPI');
  }

  modal.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-sheet">
        <div class="modal-head">
          <h3>Detalle de indicador</h3>
          <button class="modal-close" onclick="cerrarDetalleKPI()">✕</button>
        </div>
        <div class="msg warn" style="display:block;">Cargando datos...</div>
      </div>
    </div>
  `;

  const r = await api('/api/dashboard/detalle/' + f);

  if(!r.ok){
    modal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-sheet">
          <div class="modal-head">
            <h3>Detalle de indicador</h3>
            <button class="modal-close" onclick="cerrarDetalleKPI()">✕</button>
          </div>
          <div class="msg error" style="display:block;">
            ${escapeHtml(r.message || 'No se pudo cargar el detalle.')}
          </div>
        </div>
      </div>
    `;
    return;
  }

  modal.innerHTML = renderModalDetalleKPI(f, r.llantas || []);
}

function cerrarDetalleKPI(){
  const modal = $('modalDetalleKPI');
  if(modal) modal.innerHTML = '';
}

function tituloDetalleKPI(f){
  const titulos = {
    total:'Total de llantas',
    montadas:'Llantas montadas',
    bodega:'Llantas en bodega',
    reencauche:'Llantas en reencauche',
    basura:'Llantas en basura',
    criticas:'Llantas críticas',
    alerta:'Llantas en alerta',
    sinProfundidad:'Llantas sin profundidad'
  };

  return titulos[f] || 'Detalle de indicador';
}

function renderModalDetalleKPI(f, llantas){
  return `
    <div class="modal-overlay">
      <div class="modal-sheet">
        <div class="modal-head">
          <h3>${tituloDetalleKPI(f)} (${llantas.length})</h3>
          <button class="modal-close" onclick="cerrarDetalleKPI()">✕</button>
        </div>

        <div class="table-wrap">
          <table>
            <tr>
              <th>TM</th>
              <th>Medida</th>
              <th>Marca</th>
              <th>Estado</th>
              <th>Unidad</th>
              <th>Pos</th>
              <th>Prof</th>
            </tr>

            ${llantas.map(l => `
              <tr>
                <td>${escapeHtml(l.tm)}</td>
                <td>${escapeHtml(l.numero_llanta)}</td>
                <td>${escapeHtml(l.marca)}</td>
                <td>${badgeEstado(l.estado)}</td>
                <td>${escapeHtml(l.unidad_actual || '-')}</td>
                <td>${escapeHtml(l.posicion_actual || '-')}</td>
                <td>
                  <span class="${claseProfundidad(l.profundidad_actual_mm)}">
                    ${escapeHtml(l.profundidad_actual_mm || '-')}
                  </span>
                </td>
              </tr>
            `).join('')}
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderIngreso(){return `<div class="content-card"><h3>Ingreso de llanta</h3><div class="form-grid"><div><label>Medida</label><input id="numLlanta" placeholder="11R22.5"></div><div><label>TM</label><input id="tmLlanta"></div><div><label>Marca</label><input id="marcaLlanta"></div><div><label>Tipo</label><select id="tipoLlanta"><option>Nueva</option><option>Reencauche</option></select></div><div class="full"><label>Observación</label><textarea id="obsLlanta"></textarea></div></div><div class="form-actions"><button class="btn-primary" onclick="guardarLlanta()">Guardar llanta</button></div><div id="msgIngreso" class="msg"></div></div>`;}
async function guardarLlanta(){const body={numero_llanta:$('numLlanta').value.trim(),tm:$('tmLlanta').value.trim(),marca:$('marcaLlanta').value.trim(),tipo_llanta:$('tipoLlanta').value.trim(),observacion:$('obsLlanta').value.trim()};const msg=$('msgIngreso');msg.className='msg warn';msg.textContent='Guardando...';const r=await api('/api/tires',{method:'POST',body:JSON.stringify(body)});msg.className=r.ok?'msg ok':'msg error';msg.textContent=r.message;}
function renderInventario(){return `<div class="content-card"><h3>Inventario visual</h3><label>Buscar TM o medida</label><input id="buscarInv"><button class="btn-primary" onclick="buscarInv()">Buscar</button><div id="msgInv" class="msg"></div><div id="resInv"></div></div>`;}
async function buscarInv(){const q=$('buscarInv').value.trim();const r=await api('/api/tires/buscar?q='+encodeURIComponent(q));const msg=$('msgInv'), box=$('resInv');if(!r.ok){msg.className='msg error';msg.textContent=r.message;box.innerHTML='';return;}msg.className='msg ok';msg.textContent='Encontrado'; if(r.modo==='individual') box.innerHTML=cardLlanta(r.llanta,r.movimientos); else box.innerHTML=`<div class="table-wrap"><table><tr><th>TM</th><th>Medida</th><th>Marca</th><th>Estado</th></tr>${r.llantas.map(l=>`<tr><td>${l.tm}</td><td>${l.numero_llanta}</td><td>${l.marca}</td><td>${badgeEstado(l.estado)}</td></tr>`).join('')}</table></div>`;}
function cardLlanta(l,m){return `<div class="llanta-card"><h3>🛞 TM ${escapeHtml(l.tm)}</h3><p><b>Medida:</b> ${escapeHtml(l.numero_llanta)}</p><p><b>Estado:</b> ${badgeEstado(l.estado)}</p><p><b>Unidad:</b> ${escapeHtml(l.unidad_actual||'-')} · <b>Pos:</b> ${escapeHtml(l.posicion_actual||'-')}</p><p><b>Profundidad:</b> <span class="${claseProfundidad(l.profundidad_actual_mm)}">${escapeHtml(l.profundidad_actual_mm||'-')}</span></p>${tablaMovs(m||[])}</div>`;}

function renderUnidad(){
  return `
    <div class="content-card">
      <h3>Consulta de unidad</h3>
      <p>Busca una unidad o placa para ver el croquis real de llantas montadas.</p>

      <label>Unidad / placa</label>
      <input id="buscarUnidad" placeholder="Ej: C-101, T-205">

      <button class="btn-primary" onclick="buscarUnidad()">Buscar unidad</button>

      <div id="msgUnidad" class="msg"></div>
      <div id="resUnidad"></div>
    </div>
  `;
}

async function buscarUnidad(){
  const q = $('buscarUnidad').value.trim();
  const msg = $('msgUnidad');
  const box = $('resUnidad');

  if(!q){
    msg.className = 'msg error';
    msg.textContent = 'Ingresa una unidad o placa.';
    return;
  }

  msg.className = 'msg warn';
  msg.textContent = 'Buscando unidad...';
  box.innerHTML = '';

  const r = await api('/api/tires/unidad/' + encodeURIComponent(q));

  if(!r.ok){
    msg.className = 'msg error';
    msg.textContent = r.message;
    return;
  }

  msg.className = 'msg ok';
  msg.textContent = 'Unidad encontrada.';

  box.innerHTML = `
    <div class="content-card" style="margin-top:12px">
      <h3>${escapeHtml(r.tipo_equipo)} · ${escapeHtml(r.unidad)}</h3>
      <p>Llantas actualmente montadas en esta unidad.</p>

      ${renderCroquisUnidad(r.tipo_equipo, r.llantas)}
      ${tablaUnidad(r.llantas)}
    </div>
  `;
}

function renderCroquisUnidad(tipo, llantas){
  const mapa = {};
  llantas.forEach(l => {
    mapa[String(l.posicion_actual)] = l;
  });

  if(tipo === 'Cabezal'){
    return `
      <div class="map-box">
        <div class="map-title">Croquis del cabezal</div>

        <div class="map-grid">
          <div class="row2">
            ${posUnidad('1', mapa)}
            ${posUnidad('2', mapa)}
          </div>

          <div class="row4">
            ${posUnidad('3', mapa)}
            ${posUnidad('4', mapa)}
            ${posUnidad('5', mapa)}
            ${posUnidad('6', mapa)}
          </div>

          <div class="row4">
            ${posUnidad('7', mapa)}
            ${posUnidad('8', mapa)}
            ${posUnidad('9', mapa)}
            ${posUnidad('10', mapa)}
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="map-box">
      <div class="map-title">Croquis del tanque</div>

      <div class="map-grid">
        <div class="row4">
          ${posUnidad('11', mapa)}
          ${posUnidad('12', mapa)}
          ${posUnidad('13', mapa)}
          ${posUnidad('14', mapa)}
        </div>

        <div class="row4">
          ${posUnidad('15', mapa)}
          ${posUnidad('16', mapa)}
          ${posUnidad('17', mapa)}
          ${posUnidad('18', mapa)}
        </div>

        <div class="row4">
          ${posUnidad('19', mapa)}
          ${posUnidad('20', mapa)}
          ${posUnidad('21', mapa)}
          ${posUnidad('22', mapa)}
        </div>
      </div>
    </div>
  `;
}

function colorProfundidadClase(v){

  const n = Number(v || 0);

  if(!n) return 'wheel-normal';

  if(n <= 4) return 'wheel-critica';

  if(n <= 9) return 'wheel-alerta';

  return 'wheel-normal';
}

function posUnidad(pos, mapa){

  const l = mapa[pos];

  if(!l){
    return `
      <div class="unit-wheel unit-empty">
        <strong>POS ${pos}</strong>
        <span>${seccionPorPosicion(pos)}</span>
        <small>Libre</small>
      </div>
    `;
  }

  const colorClase = colorProfundidadClase(l.profundidad_actual_mm);

  return `
    <button
      type="button"
      class="unit-wheel used ${colorClase}"
      onclick="abrirHistorialLlanta('${escapeHtml(l.tm || '')}')"
    >
      <strong>POS ${pos}</strong>
      <span>TM ${escapeHtml(l.tm || '-')}</span>
      <small>${escapeHtml(l.numero_llanta || '-')}</small>
      <small>Prof: ${escapeHtml(l.profundidad_actual_mm || '-')}</small>
    </button>
  `;
}

function tablaUnidad(ls){
  return `
    <div class="table-wrap">
      <table>
        <tr>
          <th>Pos</th>
          <th>TM</th>
          <th>Medida</th>
          <th>Marca</th>
          <th>Prof</th>
          <th>Estado</th>
        </tr>

        ${ls.map(l=>`
          <tr>
            <td>${escapeHtml(l.posicion_actual)}</td>
            <td>${escapeHtml(l.tm)}</td>
            <td>${escapeHtml(l.numero_llanta)}</td>
            <td>${escapeHtml(l.marca)}</td>
            <td>
              <span class="${claseProfundidad(l.profundidad_actual_mm)}">
                ${escapeHtml(l.profundidad_actual_mm || '-')}
              </span>
            </td>
            <td>${badgeEstado(l.estado)}</td>
          </tr>
        `).join('')}
      </table>
    </div>
  `;
}

let llantasCalibracion = [];

function renderCalibracion(){

  llantasCalibracion = [];

  setTimeout(()=>renderCroquisCal(),50);

  setTimeout(async ()=>{
    const box = $('tmDatalistBox');
    if(box) box.innerHTML = await cargarListaTM();
  },80);

  return `
    <div class="content-card">

      <h3>Registro operativo de llantería</h3>

      <div class="form-grid">

        <div>
          <label>Tipo de registro</label>
          <select id="tipoRegistroCal">
            <option value="Calibracion">Calibración</option>
            <option value="Cambio">Cambio de llanta</option>
          </select>
        </div>

        <div>
          <label>Tipo de equipo</label>
          <select id="equipoCal"
            onchange="
              llantasCalibracion=[];
              renderCroquisCal();
            ">
            <option value="Cabezal">Cabezal</option>
            <option value="Tanque">Tanque</option>
          </select>
        </div>

        <div>
          <label>Fecha</label>
          <input type="date" id="fechaCal">
        </div>

        <div>
          <label>Unidad / Placa</label>
          <input id="placaCal" onblur="cargarUnidadOperacion()" placeholder="Ej: 124578">
        </div>

        <div class="full">
          <label>Llantero</label>
          <input id="llanteroCal">
        </div>

      </div>

      <div id="croquisCalibracion"></div>

      <div class="form-actions">
        <button class="btn-primary" onclick="guardarCalibracion()">
          Guardar registro
        </button>
      </div>

      <div id="tmDatalistBox"></div>
      <div id="msgCal" class="msg"></div>

      <div id="modalLlantaCal"></div>

    </div>
  `;
}

async function cargarListaTM(){
  const r = await api('/api/tires');

  if(!r.ok) return '';

  return `
    <datalist id="tmList">
      ${r.llantas.map(l => `
        <option value="${escapeHtml(l.tm)}">
          ${escapeHtml(l.numero_llanta)} · ${escapeHtml(l.marca)} · ${escapeHtml(l.estado)}
        </option>
      `).join('')}
    </datalist>
  `;
}

function posicionesEquipoCal(){
  const equipo = $('equipoCal')?.value || 'Cabezal';
  return equipo === 'Cabezal'
    ? ['1','2','3','4','5','6','7','8','9','10']
    : ['11','12','13','14','15','16','17','18','19','20','21','22'];
}

function posicionUsadaCal(pos, actual = -1){
  return llantasCalibracion.some((l,i) => i !== actual && String(l.posicion) === String(pos));
}

function renderCroquisCal(){
  const tipo = $('equipoCal')?.value || 'Cabezal';
  const box = $('croquisCalibracion');
  if(!box) return;

  if(tipo === 'Cabezal'){
    box.innerHTML = `
      <div class="map-box">
        <div class="map-title">Croquis del cabezal</div>

        <div class="map-grid">
          <div class="row2">
            ${croquisPos('1')}
            ${croquisPos('2')}
          </div>

          <div class="row4">
            ${croquisPos('3')}
            ${croquisPos('4')}
            ${croquisPos('5')}
            ${croquisPos('6')}
          </div>

          <div class="row4">
            ${croquisPos('7')}
            ${croquisPos('8')}
            ${croquisPos('9')}
            ${croquisPos('10')}
          </div>
        </div>
      </div>
    `;
  } else {
    box.innerHTML = `
      <div class="map-box">
        <div class="map-title">Croquis del tanque</div>

        <div class="map-grid">
          <div class="row4">
            ${croquisPos('11')}
            ${croquisPos('12')}
            ${croquisPos('13')}
            ${croquisPos('14')}
          </div>

          <div class="row4">
            ${croquisPos('15')}
            ${croquisPos('16')}
            ${croquisPos('17')}
            ${croquisPos('18')}
          </div>

          <div class="row4">
            ${croquisPos('19')}
            ${croquisPos('20')}
            ${croquisPos('21')}
            ${croquisPos('22')}
          </div>
        </div>
      </div>
    `;
  }
}

function croquisPos(pos){

  const item = llantasCalibracion.find(
    x => String(x.posicion) === String(pos)
  );

  const usada = !!item;

  const seccion = seccionPorPosicion(pos);

  const colorClase = usada
  ? colorProfundidadClase(item.profundidad)
  : '';

  const clase = usada
    ? `unit-wheel used ${colorClase}`
    : 'unit-wheel';

  return `
    <button
      type="button"
      class="${clase}"
      onclick="abrirModalLlantaCal('${pos}')"
    >

      <strong>POS ${pos}</strong>

      <span>${seccion}</span>

      ${
        usada
        ? `<small>TM ${escapeHtml(item.tm || '-')}</small>`
        : `<small>Libre</small>`
      }

    </button>
  `;
}

function abrirModalLlantaCal(pos){

  const tipoRegistro = $('tipoRegistroCal').value;

  let llanta = llantasCalibracion.find(
    x => String(x.posicion) === String(pos)
  );

  if(!llanta){
    llanta = {
      posicion: pos,
      seccion: seccionPorPosicion(pos),
      tm:'',
      medida:'',
      marca:'',
      psi:'',
      profundidad:'',
      tmDesmontado:'',
      desmontada:'',
      tmMontado:'',
      montada:'',
      motivo:'Reencauche',
      destino:'Bodega',
      observacion:''
    };

    llantasCalibracion.push(llanta);
  }

  if(tipoRegistro === 'Cambio' && llanta.tm && !llanta.tmDesmontado){
    llanta.tmDesmontado = llanta.tm;
    llanta.desmontada = llanta.medida || '';
  }

  const modal = $('modalLlantaCal');

  modal.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-sheet">
        <div class="modal-head">
          <h3>Posición ${pos}</h3>
          <button class="modal-close" onclick="cerrarModalLlantaCal()">✕</button>
        </div>

        <div class="form-grid">
          <div>
            <label>Sección</label>
            <input value="${escapeHtml(seccionPorPosicion(pos))}" disabled>
          </div>

          ${tipoRegistro === 'Calibracion' ? `
            <div>
              <label>TM</label>
              <input id="modalTM" list="tmList" value="${escapeHtml(llanta.tm || '')}" oninput="buscarTMModalCal('${pos}', this.value)">
            </div>

            <div>
              <label>Medida</label>
              <input id="modalMedida" value="${escapeHtml(llanta.medida || '')}" disabled>
            </div>

            <div>
              <label>Marca</label>
              <input id="modalMarca" value="${escapeHtml(llanta.marca || '')}" disabled>
            </div>

            <div>
              <label>PSI</label>
              <input id="modalPSI" type="number" value="${escapeHtml(llanta.psi || '')}">
            </div>

            <div>
              <label>Profundidad</label>
              <input id="modalProf" type="number" value="${escapeHtml(llanta.profundidad || '')}">
            </div>
          ` : `
            <div>
              <label>TM desmontado</label>
              <input id="modalTMDesmontado" list="tmList" value="${escapeHtml(llanta.tmDesmontado || '')}" oninput="buscarTMDesmontadoModal('${pos}', this.value)">
            </div>

            <div>
              <label>Llanta desmontada</label>
              <input id="modalDesmontada" value="${escapeHtml(llanta.desmontada || '')}" disabled>
            </div>

            <div>
              <label>TM montado</label>
              <input id="modalTMMontado" list="tmList" value="${escapeHtml(llanta.tmMontado || '')}" oninput="buscarTMMontadoModal('${pos}', this.value)">
            </div>

            <div>
              <label>Llanta montada</label>
              <input id="modalMontada" value="${escapeHtml(llanta.montada || '')}" disabled>
            </div>

            <div>
              <label>Motivo</label>
              <select id="modalMotivo">
                <option ${llanta.motivo==='Reencauche'?'selected':''}>Reencauche</option>
                <option ${llanta.motivo==='Daño'?'selected':''}>Daño</option>
                <option ${llanta.motivo==='Basura'?'selected':''}>Basura</option>
                <option ${llanta.motivo==='Cambio de posición'?'selected':''}>Cambio de posición</option>
                <option ${llanta.motivo==='Bodega'?'selected':''}>Bodega</option>
                <option ${llanta.motivo==='Rotación'?'selected':''}>Rotación</option>
              </select>
            </div>

            <div>
              <label>Destino desmontada</label>
              <select id="modalDestino">
                <option ${llanta.destino==='Bodega'?'selected':''}>Bodega</option>
                <option ${llanta.destino==='Reencauche'?'selected':''}>Reencauche</option>
                <option ${llanta.destino==='Basura'?'selected':''}>Basura</option>
                <option ${llanta.destino==='Dañada'?'selected':''}>Dañada</option>
              </select>
            </div>
          `}

          <div class="full">
            <label>Observación</label>
            <textarea id="modalObs">${escapeHtml(llanta.observacion || '')}</textarea>
          </div>
        </div>

        <div class="form-actions">
          <button class="btn-secondary" onclick="eliminarLlantaPosicion('${pos}')">Eliminar</button>
          <button class="btn-primary" onclick="guardarLlantaModalCal('${pos}')">Guardar posición</button>
        </div>
      </div>
    </div>
  `;
}

function cerrarModalLlantaCal(){
  $('modalLlantaCal').innerHTML = '';
}

function eliminarLlantaPosicion(pos){

  llantasCalibracion =
    llantasCalibracion.filter(
      x => String(x.posicion) !== String(pos)
    );

  cerrarModalLlantaCal();
  renderCroquisCal();
}

function guardarLlantaModalCal(pos){

  const llanta =
    llantasCalibracion.find(
      x => String(x.posicion) === String(pos)
    );

  if(!llanta) return;

  const tipoRegistro = $('tipoRegistroCal').value;

  llanta.seccion = seccionPorPosicion(pos);

  if(tipoRegistro === 'Calibracion'){

    llanta.tm = $('modalTM').value.trim();
    llanta.medida = $('modalMedida').value.trim();
    llanta.marca = $('modalMarca').value.trim();
    llanta.psi = $('modalPSI').value.trim();
    llanta.profundidad = $('modalProf').value.trim();

  } else {

    llanta.tmDesmontado =
      $('modalTMDesmontado').value.trim();

    llanta.desmontada =
      $('modalDesmontada').value.trim();

    llanta.tmMontado =
      $('modalTMMontado').value.trim();

    llanta.montada =
      $('modalMontada').value.trim();

    llanta.motivo =
      $('modalMotivo').value;

    llanta.destino =
      $('modalDestino').value;
  }

  llanta.observacion =
    $('modalObs').value.trim();

  cerrarModalLlantaCal();
  renderCroquisCal();
}

async function buscarTMModalCal(pos, tm){

  const llanta =
    llantasCalibracion.find(
      x => String(x.posicion) === String(pos)
    );

  if(!llanta) return;

  llanta.tm = tm;

  if(!tm || tm.length < 2) return;

  const r =
    await api(
      '/api/tires/buscar?q=' +
      encodeURIComponent(tm)
    );

  if(r.ok && r.modo === 'individual'){

    llanta.medida = r.llanta.numero_llanta;
    llanta.marca = r.llanta.marca;

    $('modalMedida').value = llanta.medida;
    $('modalMarca').value = llanta.marca;
  }
}

function validarRegistroLlanteria(tipoRegistro, llantas){
  if(!llantas.length){
    return 'Agrega al menos una posición del croquis.';
  }

  for(const l of llantas){
    const pos = l.posicion || 'sin posición';

    if(tipoRegistro === 'Calibracion'){
      if(!l.tm){
        return `Falta TM en la posición ${pos}.`;
      }

      if(!l.psi){
        return `Falta PSI en la posición ${pos}.`;
      }

      if(!l.profundidad){
        return `Falta profundidad en la posición ${pos}.`;
      }
    }

    if(tipoRegistro === 'Cambio'){
      if(!l.tmDesmontado){
        return `Falta TM desmontado en la posición ${pos}.`;
      }

      if(!l.tmMontado){
        return `Falta TM montado en la posición ${pos}.`;
      }

      if(l.tmDesmontado === l.tmMontado){
        return `En la posición ${pos}, el TM desmontado y montado no pueden ser el mismo.`;
      }

      if(!l.destino){
        return `Falta destino de la llanta desmontada en la posición ${pos}.`;
      }

      if(!l.motivo){
        return `Falta motivo del cambio en la posición ${pos}.`;
      }
    }
  }

  return null;
}

async function guardarCalibracion(){
  const msg = $('msgCal');
  const tipoRegistro = $('tipoRegistroCal').value;

  const body = {
    fecha: $('fechaCal').value,
    tipo_equipo: $('equipoCal').value,
    placa: $('placaCal').value.trim(),
    nombre_llantero: $('llanteroCal').value.trim(),
    llantas: llantasCalibracion
  };

  if(!body.fecha || !body.placa || !body.nombre_llantero || !body.llantas.length){
    msg.className='msg error';
    msg.textContent='Completa fecha, unidad, llantero y agrega al menos una llanta.';
    return;
  }

  const errorValidacion = validarRegistroLlanteria(tipoRegistro, body.llantas);

if(errorValidacion){
  msg.className = 'msg error';
  msg.textContent = errorValidacion;
  return;
}

  msg.className='msg warn';
  msg.textContent='Guardando registro...';

  const endpoint = tipoRegistro === 'Cambio'
  ? '/api/operations/cambio'
  : '/api/operations/calibracion';

  const r = await api(endpoint,{
    method:'POST',
    body:JSON.stringify(body)
  });

  msg.className = r.ok ? 'msg ok' : 'msg error';
  msg.textContent = r.message || 'Proceso finalizado.';

  if(r.ok){
    llantasCalibracion = [];
    renderCroquisCal();
    cargarDashboard();
  }
}

function seccionPorPosicion(pos){
  const p = Number(pos);

  if (p === 1 || p === 2) return 'Unica';

  if (p % 2 !== 0) return 'Interna';

  return 'Externa';
}

async function buscarTMDesmontadoModal(pos, tm){

  const llanta =
    llantasCalibracion.find(
      x => String(x.posicion) === String(pos)
    );

  if(!llanta) return;

  llanta.tmDesmontado = tm;

  if(!tm || tm.length < 2) return;

  const r =
    await api(
      '/api/tires/buscar?q=' +
      encodeURIComponent(tm)
    );

  if(r.ok && r.modo === 'individual'){

    llanta.desmontada =
      r.llanta.numero_llanta;

    $('modalDesmontada').value =
      llanta.desmontada;
  }
}

async function buscarTMMontadoModal(pos, tm){

  const llanta =
    llantasCalibracion.find(
      x => String(x.posicion) === String(pos)
    );

  if(!llanta) return;

  llanta.tmMontado = tm;

  if(!tm || tm.length < 2) return;

  const r =
    await api(
      '/api/tires/buscar?q=' +
      encodeURIComponent(tm)
    );

  if(r.ok && r.modo === 'individual'){

    llanta.montada =
      r.llanta.numero_llanta;

    $('modalMontada').value =
      llanta.montada;
  }
}

async function abrirHistorialLlanta(tm){
  if(!tm) return;

  let modal = $('modalHistorialLlanta');

  if(!modal){
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div id="modalHistorialLlanta"></div>`
    );

    modal = $('modalHistorialLlanta');
  }

  modal.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-sheet">
        <div class="modal-head">
          <h3>Historial de llanta</h3>
          <button class="modal-close" onclick="cerrarHistorialLlanta()">✕</button>
        </div>

        <div class="msg warn" style="display:block;">
          Cargando historial...
        </div>
      </div>
    </div>
  `;

  const r = await api('/api/tires/historial/' + encodeURIComponent(tm));

  if(!r.ok){
    modal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-sheet">
          <div class="modal-head">
            <h3>Historial de llanta</h3>
            <button class="modal-close" onclick="cerrarHistorialLlanta()">✕</button>
          </div>

          <div class="msg error" style="display:block;">
            ${escapeHtml(r.message || 'No se pudo cargar el historial.')}
          </div>
        </div>
      </div>
    `;
    return;
  }

  modal.innerHTML = renderModalHistorialLlanta(r.llanta, r.movimientos || []);
}

function cerrarHistorialLlanta(){
  const modal = $('modalHistorialLlanta');
  if(modal) modal.innerHTML = '';
}

function renderModalHistorialLlanta(llanta, movimientos){
  return `
    <div class="modal-overlay">
      <div class="modal-sheet">
        <div class="modal-head">
          <h3>🛞 TM ${escapeHtml(llanta.tm || '')}</h3>
          <button class="modal-close" onclick="cerrarHistorialLlanta()">✕</button>
        </div>

        <div class="llanta-card">
          <p><b>Medida:</b> ${escapeHtml(llanta.numero_llanta || '-')}</p>
          <p><b>Marca:</b> ${escapeHtml(llanta.marca || '-')}</p>
          <p><b>Estado:</b> ${badgeEstado(llanta.estado)}</p>
          <p><b>Unidad:</b> ${escapeHtml(llanta.unidad_actual || '-')}</p>
          <p><b>Posición:</b> ${escapeHtml(llanta.posicion_actual || '-')}</p>
          <p>
            <b>Profundidad:</b>
            <span class="${claseProfundidad(llanta.profundidad_actual_mm)}">
              ${escapeHtml(llanta.profundidad_actual_mm || '-')}
            </span>
          </p>
        </div>

        <div class="content-card" style="margin-top:12px;">
          <h3>Movimientos recientes</h3>
          ${tablaMovs(movimientos)}
        </div>
      </div>
    </div>
  `;
}

async function cargarUnidadOperacion(){
  const unidad = $('placaCal')?.value.trim();
  const msg = $('msgCal');

  if(!unidad) return;

  msg.className = 'msg warn';
  msg.textContent = 'Cargando llantas montadas de la unidad...';

  const r = await api('/api/tires/unidad/' + encodeURIComponent(unidad));

  if(!r.ok){
    msg.className = 'msg error';
    msg.textContent = r.message || 'No se encontraron llantas montadas en esta unidad.';
    llantasCalibracion = [];
    renderCroquisCal();
    return;
  }

  $('equipoCal').value = r.tipo_equipo || 'Cabezal';

  llantasCalibracion = (r.llantas || []).map(l => ({
    posicion: String(l.posicion_actual || ''),
    seccion: seccionPorPosicion(l.posicion_actual),
    tm: l.tm || '',
    medida: l.numero_llanta || '',
    marca: l.marca || '',
    psi: '',
    profundidad: l.profundidad_actual_mm || '',
    observacion: ''
  }));

  msg.className = 'msg ok';
  msg.textContent = `Unidad cargada: ${r.unidad}. ${llantasCalibracion.length} llanta(s) montada(s).`;

  renderCroquisCal();
}

async function exportarExcel(){

  const r = await api('/api/dashboard/export/excel');

  if(!r.ok){
    alert(r.message || 'No se pudo generar el Excel.');
    return;
  }

  if(r.archivo){
    window.open('/' + r.archivo, '_blank');
  }
}

async function cargarReportes(pathActual=''){

  const view = $('moduleView');

  const r = await api(
    '/api/reports?path=' +
    encodeURIComponent(pathActual)
  );

  if(!r.ok){
    view.innerHTML = `
      <div class="msg error" style="display:block">
        ${escapeHtml(r.message || 'No se pudieron cargar los reportes.')}
      </div>
    `;
    return;
  }

  view.innerHTML = renderReportes(r);
}

function renderReportes(data){

  const current = data.path || '';

  const parent =
    current.includes('/')
    ? current.split('/').slice(0,-1).join('/')
    : '';

  return `
    <div class="content-card">

      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:10px;
        margin-bottom:14px;
        flex-wrap:wrap;
      ">
        <div>
          <h2 style="margin:0">📁 Reportes PDF</h2>
          <small style="color:#64748b">
            ${escapeHtml(current || 'Raíz')}
          </small>
        </div>

        ${
          current
          ? `
            <button
              class="btn-secondary"
              style="width:auto"
              onclick="cargarReportes('${parent}')"
            >
              ⬅ Volver
            </button>
          `
          : ''
        }
      </div>

      ${
        !data.folders.length && !data.files.length
        ? `
          <div class="msg warn" style="display:block">
            No hay reportes en esta carpeta.
          </div>
        `
        : ''
      }

      <div class="table-wrap">
        <table>

          <tr>
            <th>Tipo</th>
            <th>Nombre</th>
            <th>Acción</th>
          </tr>

          ${data.folders.map(f => `
            <tr>
              <td>📁</td>
              <td>${escapeHtml(f.name)}</td>
              <td>
                <button
                  class="btn-primary"
                  onclick="cargarReportes('${f.path}')"
                >
                  Abrir
                </button>
              </td>
            </tr>
          `).join('')}

          ${data.files.map(f => `
            <tr>
              <td>📄</td>
              <td>${escapeHtml(f.name)}</td>
              <td style="display:flex;gap:6px;flex-wrap:wrap">
                <button
                  class="btn-primary"
                  onclick="window.open('${f.url}','_blank')"
                >
                  Ver
                </button>

                <a
                  href="${f.url}"
                  download
                  style="text-decoration:none;flex:1"
                >
                  <button class="btn-secondary">
                    Descargar
                  </button>
                </a>
              </td>
            </tr>
          `).join('')}

        </table>
      </div>

    </div>
  `;
}

function renderUsuarios(){
  return `
    <div class="content-card">

      <h3>Crear usuario</h3>

      <div class="form-grid">

        <div>
          <label>Usuario</label>
          <input id="nuevoUsuario">
        </div>

        <div>
          <label>Clave</label>
          <input id="nuevoClave">
        </div>

        <div>
          <label>Nombre</label>
          <input id="nuevoNombre">
        </div>

        <div>
          <label>Rol</label>

          <select id="nuevoRol">
            <option>Administrador</option>
            <option>Llantería</option>
            <option>Bodega</option>
            <option>Consulta</option>
          </select>
        </div>

      </div>

      <div class="form-actions">
        <button class="btn-primary" onclick="guardarUsuario()">
          Guardar usuario
        </button>
      </div>

      <div id="msgUsuarios" class="msg"></div>

    </div>

    <div class="content-card" style="margin-top:12px">

      <h3>Usuarios registrados</h3>

      <div id="tablaUsuarios">
        <div class="msg warn" style="display:block">
          Cargando usuarios...
        </div>
      </div>

    </div>
  `;
}

async function cargarUsuarios(){

  const box = $('tablaUsuarios');

  const r = await api('/api/auth/usuarios');

  if(!r.ok){
    box.innerHTML = `
      <div class="msg error" style="display:block">
        ${escapeHtml(r.message || 'No se pudieron cargar los usuarios.')}
      </div>
    `;
    return;
  }

  box.innerHTML = `
    <div class="table-wrap">
      <table>

        <tr>
          <th>Usuario</th>
          <th>Clave</th>
          <th>Nombre</th>
          <th>Rol</th>
          <th>Estado</th>
        </tr>

        ${r.usuarios.map(u => `
          <tr>
            <td>${escapeHtml(u.usuario)}</td>
            <td><b>${escapeHtml(u.clave || '-')}</b></td>
            <td>${escapeHtml(u.nombre)}</td>
            <td>${escapeHtml(u.rol)}</td>
            <td>${badgeEstadoUsuario(u.estado)}</td>
          </tr>
        `).join('')}

      </table>
    </div>
  `;
}

function badgeEstadoUsuario(e){

  const activo =
    String(e || '').toLowerCase() === 'activo';

  return `
    <span class="badge ${
      activo ? 'badge-montada' : 'badge-basura'
    }">
      ${escapeHtml(e)}
    </span>
  `;
}

async function guardarUsuario(){

  const body = {
    usuario: $('nuevoUsuario').value.trim(),
    clave: $('nuevoClave').value.trim(),
    nombre: $('nuevoNombre').value.trim(),
    rol: $('nuevoRol').value
  };

  const msg = $('msgUsuarios');

  if(!body.usuario || !body.clave || !body.nombre){
    msg.className='msg error';
    msg.textContent='Completa todos los campos.';
    return;
  }

  msg.className='msg warn';
  msg.textContent='Guardando usuario...';

  const r = await api('/api/auth/usuarios',{
    method:'POST',
    body:JSON.stringify(body)
  });

  msg.className = r.ok ? 'msg ok' : 'msg error';
  msg.textContent = r.message;

  if(r.ok){

    $('nuevoUsuario').value='';
    $('nuevoClave').value='';
    $('nuevoNombre').value='';

    cargarUsuarios();
  }
}

function permisosRol(){
  const rol = usuarioActual?.rol || '';

  const permisos = {
    Administrador: ['inicio','ingreso','calibracion','inventario','bodega','reportes','usuarios'],
    Llantería: ['inicio','calibracion','bodega','reportes'],
    Bodega: ['inicio','ingreso','inventario','bodega'],
    Consulta: ['inicio','inventario','bodega','reportes']
  };

  return permisos[rol] || ['inicio'];
}

function puedeAbrirModulo(modulo){
  return permisosRol().includes(modulo);
}