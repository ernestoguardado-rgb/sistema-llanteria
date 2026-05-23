const express = require('express');
const { run, get, all } = require('../db/database');
const { generarId } = require('../services/id.service');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const rows = await all(`SELECT * FROM llantas ORDER BY tm`);
    res.json({ ok: true, llantas: rows });
  } catch (e) {
    res.json({ ok: false, message: e.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { numero_llanta, tm, marca, tipo_llanta, observacion } = req.body;

    if (!numero_llanta || !tm || !marca || !tipo_llanta) {
      return res.json({ ok: false, message: 'Número de llanta, TM, marca y tipo son obligatorios.' });
    }

    const exists = await get('SELECT id FROM llantas WHERE LOWER(tm)=LOWER(?)', [tm]);
    if (exists) return res.json({ ok: false, message: 'Ya existe una llanta registrada con ese TM.' });

    const fecha = new Date().toISOString();
    const idLlanta = generarId('LL');
    const idMov = generarId('MOV');

    await run('BEGIN TRANSACTION');

    try {
      await run(`
        INSERT INTO llantas 
        (id_llanta, numero_llanta, tm, marca, tipo_llanta, estado, ubicacion_actual, fecha_ingreso, fecha_ultimo_movimiento, observacion, id_ultimo_movimiento)
        VALUES (?, ?, ?, ?, ?, 'En bodega', 'Bodega', ?, ?, ?, ?)
      `, [idLlanta, numero_llanta, tm, marca, tipo_llanta, fecha, fecha, observacion || '', idMov]);

      await run(`
        INSERT INTO movimientos 
        (id_movimiento, fecha, id_llanta, numero_llanta, tm, tipo_movimiento, origen, destino, observacion)
        VALUES (?, ?, ?, ?, ?, 'Ingreso inicial', 'Proveedor', 'Bodega', ?)
      `, [idMov, fecha, idLlanta, numero_llanta, tm, observacion || '']);

      await run('COMMIT');

    } catch (err) {
      await run('ROLLBACK');
      throw err;
    }

    res.json({ ok: true, message: 'Llanta registrada correctamente.', id_llanta: idLlanta });

  } catch (e) {
    res.json({ ok: false, message: e.message });
  }
});

router.get('/buscar', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    if (!q) return res.json({ ok: false, message: 'Ingresa un TM o medida.' });

    const byTM = await get('SELECT * FROM llantas WHERE LOWER(tm)=?', [q]);

    if (byTM) {
      const movimientos = await all(
        'SELECT * FROM movimientos WHERE LOWER(tm)=? ORDER BY fecha DESC LIMIT 10',
        [q]
      );

      return res.json({ ok: true, modo: 'individual', llanta: byTM, movimientos });
    }

    const byMedida = await all(
      'SELECT * FROM llantas WHERE LOWER(numero_llanta)=? ORDER BY tm',
      [q]
    );

    if (byMedida.length) {
      return res.json({ ok: true, modo: 'multiple', llantas: byMedida });
    }

    res.json({ ok: false, message: 'No se encontraron llantas con ese TM o medida.' });

  } catch (e) {
    res.json({ ok: false, message: e.message });
  }
});

router.get('/historial/:tm', async (req, res) => {
  try {
    const tm = String(req.params.tm || '').trim().toLowerCase();

    if (!tm) {
      return res.json({ ok:false, message:'TM no válido.' });
    }

    const llanta = await get(
      `SELECT * FROM llantas WHERE LOWER(tm)=LOWER(?)`,
      [tm]
    );

    if (!llanta) {
      return res.json({ ok:false, message:'No se encontró la llanta.' });
    }

    const movimientos = await all(
      `SELECT * FROM movimientos WHERE LOWER(tm)=LOWER(?) ORDER BY fecha DESC LIMIT 20`,
      [tm]
    );

    res.json({
      ok:true,
      llanta,
      movimientos
    });

  } catch (e) {
    res.json({ ok:false, message:e.message });
  }
});

router.get('/unidad/:unidad', async (req, res) => {
  try {
    const unidad = String(req.params.unidad || '').trim().toLowerCase();

    const llantas = await all(`
      SELECT * FROM llantas
      WHERE LOWER(unidad_actual)=LOWER(?) 
      AND LOWER(estado) LIKE '%montada%'
      ORDER BY CAST(posicion_actual AS INTEGER)
    `, [unidad]);

    if (!llantas.length) {
      return res.json({ ok: false, message: 'No se encontraron llantas montadas en esa unidad.' });
    }

    const posiciones = llantas.map(l => Number(l.posicion_actual));
    const tipo_equipo = posiciones.some(p => p >= 1 && p <= 10) ? 'Cabezal' : 'Tanque';

    res.json({ ok: true, unidad: llantas[0].unidad_actual, tipo_equipo, llantas });

  } catch (e) {
    res.json({ ok: false, message: e.message });
  }
});


module.exports = router;