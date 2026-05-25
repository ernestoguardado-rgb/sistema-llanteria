const express = require('express');
const path = require('path');
const XLSX = require('xlsx');
const { all, run, get } = require('../db/database');
const { generarId } = require('../services/id.service');
const { generarExcelGeneral } = require('../services/excel.service');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const llantas = await all("SELECT * FROM llantas WHERE tm IS NOT NULL AND tm <> ''");

    const estados = {};
    const marcas = {};
    const medidas = {};

    let criticas = 0;
    let alerta = 0;
    let sinProfundidad = 0;

    const llantasCriticas = [];
    const llantasAlerta = [];
    const llantasSinProfundidad = [];

    for (const l of llantas) {
      estados[l.estado || 'Sin estado'] = (estados[l.estado || 'Sin estado'] || 0) + 1;
      marcas[l.marca || 'Sin marca'] = (marcas[l.marca || 'Sin marca'] || 0) + 1;
      medidas[l.numero_llanta || 'Sin medida'] = (medidas[l.numero_llanta || 'Sin medida'] || 0) + 1;

      const prof = Number(l.profundidad_actual_mm || 0);

      if (!prof) {
        sinProfundidad++;
        llantasSinProfundidad.push(l);
      } else if (prof <= 4) {
        criticas++;
        llantasCriticas.push(l);
      } else if (prof <= 9) {
        alerta++;
        llantasAlerta.push(l);
      }
    }

    const movimientos = await all('SELECT * FROM movimientos ORDER BY fecha DESC LIMIT 8');

    res.json({
      ok: true,
      total: llantas.length,
      estados,
      marcas,
      medidas,
      criticas,
      alerta,
      sinProfundidad,
      llantasCriticas,
      llantasAlerta,
      llantasSinProfundidad,
      movimientos
    });

  } catch (e) {
    res.json({ ok: false, message: e.message });
  }
});

router.get('/detalle/:filtro', async (req, res) => {
  try {
    const filtro = req.params.filtro;

    let sql = "SELECT * FROM llantas WHERE tm IS NOT NULL AND tm <> ''";

    if (filtro === 'montadas') sql += " AND estado = 'Montada'";
    if (filtro === 'bodega') sql += " AND estado = 'En bodega'";
    if (filtro === 'reencauche') sql += " AND LOWER(estado) LIKE '%reencauche%'";
    if (filtro === 'basura') sql += " AND estado = 'Basura'";
    if (filtro === 'criticas') sql += " AND profundidad_actual_mm > 0 AND profundidad_actual_mm <= 4";
    if (filtro === 'alerta') sql += " AND profundidad_actual_mm > 4 AND profundidad_actual_mm <= 9";
    if (filtro === 'sinProfundidad') sql += " AND (profundidad_actual_mm IS NULL OR profundidad_actual_mm = '' OR profundidad_actual_mm = 0)";

    const llantas = await all(sql);

    res.json({
      ok: true,
      filtro,
      total: llantas.length,
      llantas
    });

  } catch (e) {
    res.json({ ok: false, message: e.message });
  }
});

router.get('/export/excel', async (req, res) => {
  try {

    const llantas = await all(
      "SELECT * FROM llantas WHERE tm IS NOT NULL AND tm <> ''"
    );

    const movimientos = await all(
      'SELECT * FROM movimientos ORDER BY fecha DESC'
    );

    const excel = await generarExcelGeneral({
      llantas,
      movimientos
    });

    res.json({
      ok:true,
      message:'Excel generado correctamente.',
      archivo: excel.relativePath
    });

  } catch (e) {

    res.json({
      ok:false,
      message:e.message
    });
  }
});

router.get('/admin/importar-llantas', async (req, res) => {
  try {
    const token = req.query.token;

    if(token !== 'IMPORTAR2026'){
      return res.json({
        ok:false,
        message:'Token no autorizado.'
      });
    }

    const excelPath = path.join(
      __dirname,
      '../../llantas_depuradas_TM_medida_marca_tipo.xlsx'
    );

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
          'Importado desde Excel en Render',
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
          'Carga masiva desde Excel en Render'
        ]);

        insertadas++;

      }catch(errFila){
        errores++;
      }
    }

    res.json({
      ok:true,
      message:'Importación finalizada.',
      totalExcel: rows.length,
      insertadas,
      duplicadas,
      errores
    });

  } catch (e) {
    res.json({
      ok:false,
      message:e.message
    });
  }
});

module.exports = router;