const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

function safeName(text){
  return String(text || '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '_');
}

function fechaArchivo(){
  return new Date().toISOString().slice(0,10);
}

function styleHeader(row){
  row.eachCell(cell => {
    cell.font = { bold:true, color:{ argb:'FFFFFFFF' } };
    cell.fill = {
      type:'pattern',
      pattern:'solid',
      fgColor:{ argb:'FF1F4E78' }
    };
    cell.alignment = { vertical:'middle', horizontal:'center' };
    cell.border = {
      top:{ style:'thin' },
      left:{ style:'thin' },
      bottom:{ style:'thin' },
      right:{ style:'thin' }
    };
  });
}

function styleRows(ws){
  ws.eachRow((row, rowNumber) => {
    if(rowNumber === 1) return;

    row.eachCell(cell => {
      cell.border = {
        top:{ style:'thin', color:{ argb:'FFD9E2F3' } },
        left:{ style:'thin', color:{ argb:'FFD9E2F3' } },
        bottom:{ style:'thin', color:{ argb:'FFD9E2F3' } },
        right:{ style:'thin', color:{ argb:'FFD9E2F3' } }
      };
      cell.alignment = { vertical:'middle', horizontal:'center', wrapText:true };
    });
  });
}

function autofit(ws){
  ws.columns.forEach(col => {
    let max = 12;
    col.eachCell({ includeEmpty:true }, cell => {
      const value = cell.value ? String(cell.value) : '';
      max = Math.max(max, value.length + 2);
    });
    col.width = Math.min(max, 28);
  });
}

function crearHojaInventario(wb, nombre, llantas){
  const ws = wb.addWorksheet(nombre);

  ws.columns = [
    { header:'TM', key:'tm' },
    { header:'Medida', key:'numero_llanta' },
    { header:'Marca', key:'marca' },
    { header:'Tipo', key:'tipo_llanta' },
    { header:'Estado', key:'estado' },
    { header:'Ubicación', key:'ubicacion_actual' },
    { header:'Unidad actual', key:'unidad_actual' },
    { header:'Posición', key:'posicion_actual' },
    { header:'Profundidad', key:'profundidad_actual_mm' },
    { header:'Fecha ingreso', key:'fecha_ingreso' },
    { header:'Último movimiento', key:'fecha_ultimo_movimiento' },
    { header:'Proveedor', key:'proveedor' },
    { header:'Costo', key:'costo' },
    { header:'Observación', key:'observacion' }
  ];

  llantas.forEach(l => ws.addRow(l));

  styleHeader(ws.getRow(1));
  styleRows(ws);
  autofit(ws);

  ws.views = [{ state:'frozen', ySplit:1 }];
  ws.autoFilter = {
    from:'A1',
    to:`N${Math.max(1, ws.rowCount)}`
  };

  return ws;
}

function crearHojaMovimientos(wb, movimientos){
  const ws = wb.addWorksheet('MOVIMIENTOS');

  ws.columns = [
    { header:'Fecha', key:'fecha' },
    { header:'TM', key:'tm' },
    { header:'Medida', key:'numero_llanta' },
    { header:'Movimiento', key:'tipo_movimiento' },
    { header:'Equipo', key:'tipo_equipo' },
    { header:'Unidad', key:'unidad' },
    { header:'Posición', key:'posicion' },
    { header:'Profundidad', key:'profundidad' },
    { header:'PSI', key:'psi_actual' },
    { header:'Origen', key:'origen' },
    { header:'Destino', key:'destino' },
    { header:'Responsable', key:'responsable' },
    { header:'Observación', key:'observacion' }
  ];

  movimientos.forEach(m => ws.addRow(m));

  styleHeader(ws.getRow(1));
  styleRows(ws);
  autofit(ws);

  ws.views = [{ state:'frozen', ySplit:1 }];
  ws.autoFilter = {
    from:'A1',
    to:`M${Math.max(1, ws.rowCount)}`
  };

  return ws;
}

function crearResumen(wb, llantas){
  const ws = wb.addWorksheet('RESUMEN');

  const total = llantas.length;
  const montadas = llantas.filter(l => l.estado === 'Montada').length;
  const bodega = llantas.filter(l => l.estado === 'En bodega').length;
  const reencauche = llantas.filter(l => String(l.estado).toLowerCase().includes('reencauche')).length;
  const basura = llantas.filter(l => l.estado === 'Basura').length;
  const criticas = llantas.filter(l => Number(l.profundidad_actual_mm || 0) > 0 && Number(l.profundidad_actual_mm || 0) <= 4).length;
  const alerta = llantas.filter(l => Number(l.profundidad_actual_mm || 0) > 4 && Number(l.profundidad_actual_mm || 0) <= 9).length;

  ws.addRow(['REPORTE GENERAL DE LLANTAS']);
  ws.addRow([]);
  ws.addRow(['Indicador', 'Cantidad']);
  ws.addRow(['Total llantas', total]);
  ws.addRow(['Montadas', montadas]);
  ws.addRow(['En bodega', bodega]);
  ws.addRow(['Reencauche', reencauche]);
  ws.addRow(['Basura', basura]);
  ws.addRow(['Profundidad crítica', criticas]);
  ws.addRow(['Profundidad en alerta', alerta]);

  ws.mergeCells('A1:B1');
  ws.getCell('A1').font = { bold:true, size:16, color:{ argb:'FF1F4E78' } };
  ws.getCell('A1').alignment = { horizontal:'center' };

  styleHeader(ws.getRow(3));
  styleRows(ws);
  autofit(ws);

  return ws;
}

async function generarExcelGeneral({ llantas, movimientos }){
  const wb = new ExcelJS.Workbook();

  wb.creator = 'Sistema Llantería';
  wb.created = new Date();

  crearResumen(wb, llantas);

  crearHojaInventario(wb, 'INVENTARIO_GENERAL', llantas);

  crearHojaInventario(
    wb,
    'MONTADAS',
    llantas.filter(l => l.estado === 'Montada')
  );

  crearHojaInventario(
    wb,
    'BODEGA',
    llantas.filter(l => l.estado === 'En bodega')
  );

  crearHojaInventario(
    wb,
    'REENCAUCHE',
    llantas.filter(l => String(l.estado || '').toLowerCase().includes('reencauche'))
  );

  crearHojaInventario(
    wb,
    'BASURA',
    llantas.filter(l => l.estado === 'Basura')
  );

  crearHojaMovimientos(wb, movimientos);

  const exportFolder = path.join(__dirname, '..', 'exports');
  fs.mkdirSync(exportFolder, { recursive:true });

  const filename = `Reporte_General_Llantas_${fechaArchivo()}.xlsx`;
  const fullPath = path.join(exportFolder, filename);

  await wb.xlsx.writeFile(fullPath);

  return {
    fullPath,
    relativePath: `exports/${safeName(filename)}`
  };
}

module.exports = {
  generarExcelGeneral
};