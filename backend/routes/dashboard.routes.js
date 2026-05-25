const express = require('express');
const { all } = require('../db/database');
const router = express.Router();
const { generarExcelGeneral } = require('../services/excel.service');

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

module.exports = router;