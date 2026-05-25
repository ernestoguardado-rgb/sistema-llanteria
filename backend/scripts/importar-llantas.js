const XLSX = require('xlsx');
const path = require('path');
const { run, get } = require('../db/database');
const { generarId } = require('../services/id.service');

const excelPath = path.join(__dirname, '../../llantas_depuradas_TM_medida_marca_tipo.xlsx');

async function importar(){
  const wb = XLSX.readFile(excelPath);
  const sheet = wb.Sheets['LLANTAS_DEPURADAS'];
  const rows = XLSX.utils.sheet_to_json(sheet);

  let insertadas = 0;
  let duplicadas = 0;
  let errores = 0;

  for(const row of rows){
    try{
      const tm = String(row.TM || '').trim();
      const medida = String(row.Medida || '').trim();
      const marca = String(row.Marca || '').trim();
      const tipo = String(row.Tipo_Llanta || 'Nueva').trim();

      if(!tm || !medida || !marca){
        errores++;
        continue;
      }

      const existe = await get(
        'SELECT id FROM llantas WHERE LOWER(tm)=LOWER(?)',
        [tm]
      );

      if(existe){
        duplicadas++;
        continue;
      }

      const fecha = new Date().toISOString();
      const idLlanta = generarId('LL');
      const idMov = generarId('MOV');

      await run(`
        INSERT INTO llantas
        (
          id_llanta,
          numero_llanta,
          tm,
          marca,
          tipo_llanta,
          estado,
          ubicacion_actual,
          fecha_ingreso,
          fecha_ultimo_movimiento,
          observacion,
          id_ultimo_movimiento
        )
        VALUES (?, ?, ?, ?, ?, 'En bodega', 'Bodega', ?, ?, ?, ?)
      `, [
        idLlanta,
        medida,
        tm,
        marca,
        tipo,
        fecha,
        fecha,
        'Importado desde Excel',
        idMov
      ]);

      await run(`
        INSERT INTO movimientos
        (
          id_movimiento,
          fecha,
          id_llanta,
          numero_llanta,
          tm,
          tipo_movimiento,
          origen,
          destino,
          observacion
        )
        VALUES (?, ?, ?, ?, ?, 'Importación inicial', 'Excel', 'Bodega', ?)
      `, [
        idMov,
        fecha,
        idLlanta,
        medida,
        tm,
        'Carga masiva desde Excel'
      ]);

      insertadas++;

    }catch(e){
      errores++;
      console.log('Error fila:', row, e.message);
    }
  }

  console.log('IMPORTACIÓN FINALIZADA');
  console.log('Insertadas:', insertadas);
  console.log('Duplicadas:', duplicadas);
  console.log('Errores:', errores);
}

importar();