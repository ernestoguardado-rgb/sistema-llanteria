const express = require('express');
const { run, get, all } = require('../db/database');
const { generarId } = require('../services/id.service');
const { generarPDFRegistro } = require('../services/pdf.service');

const router = express.Router();

async function generarReporteSeguro(idRegistro){
  try {

    const registro = await get(
      `SELECT * FROM registros WHERE id_registro=?`,
      [idRegistro]
    );

    const detalles = await all(
      `SELECT * FROM detalle_registro WHERE id_registro=?`,
      [idRegistro]
    );

    const pdf = await generarPDFRegistro(registro, detalles);

    await run(
      `UPDATE registros
       SET link_reporte=?, estado_reporte='Generado'
       WHERE id_registro=?`,
      [pdf.relativePath, idRegistro]
    );

    return pdf.relativePath || '';

  } catch (e) {
    console.error('Error generando PDF:', e.message);
    return '';
  }
}

router.post('/calibracion', async (req, res) => {

  try {

    const {
      fecha,
      tipo_equipo,
      placa,
      nombre_llantero,
      llantas
    } = req.body;

    if (!fecha || !tipo_equipo || !placa || !nombre_llantero) {
      return res.json({
        ok:false,
        message:'Faltan datos obligatorios.'
      });
    }

    if (!Array.isArray(llantas) || !llantas.length) {
      return res.json({
        ok:false,
        message:'Debes agregar al menos una llanta.'
      });
    }

    const idRegistro = generarId('REG');
    const fechaCreacion = new Date().toISOString();

    await run('BEGIN TRANSACTION');

    try {

      await run(`
        INSERT INTO registros
        (
          id_registro,
          fecha,
          tipo_registro,
          tipo_equipo,
          placa,
          unidad,
          nombre_llantero,
          cantidad_llantas,
          estado_reporte,
          link_reporte,
          fecha_creacion
        )
        VALUES (?, ?, 'Calibracion', ?, ?, ?, ?, ?, 'Pendiente', '', ?)
      `, [
        idRegistro,
        fecha,
        tipo_equipo,
        placa,
        placa,
        nombre_llantero,
        llantas.length,
        fechaCreacion
      ]);

      for (const l of llantas) {

        const tm = String(l.tm || '').trim();

        if (!tm) {
          throw new Error('Una llanta no tiene TM.');
        }

        const llanta = await get(
          `SELECT * FROM llantas WHERE LOWER(tm)=LOWER(?)`,
          [tm]
        );

        if (!llanta) {
          throw new Error(`El TM ${tm} no existe en inventario.`);
        }

        const idDetalle = generarId('DET');
        const idMov = generarId('MOV');

        await run(`
          INSERT INTO detalle_registro
          (
            id_detalle,
            id_registro,
            posicion,
            seccion,
            numero_llanta,
            psi_actual,
            profundidad,
            tm,
            observacion_detalle
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          idDetalle,
          idRegistro,
          l.posicion || '',
          l.seccion || '',
          llanta.numero_llanta || '',
          l.psi || '',
          l.profundidad || '',
          tm,
          l.observacion || ''
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
            tipo_equipo,
            unidad,
            posicion,
            profundidad,
            psi_actual,
            origen,
            destino,
            responsable,
            id_registro,
            observacion
          )
          VALUES (?, ?, ?, ?, ?, 'Calibracion', ?, ?, ?, ?, ?, 'Unidad', 'Unidad', ?, ?, ?)
        `, [
          idMov,
          fecha,
          llanta.id_llanta || '',
          llanta.numero_llanta || '',
          tm,
          tipo_equipo,
          placa,
          l.posicion || '',
          l.profundidad || '',
          l.psi || '',
          nombre_llantero,
          idRegistro,
          l.observacion || ''
        ]);

        await run(`
          UPDATE llantas
          SET
            estado='Montada',
            ubicacion_actual='Unidad',
            unidad_actual=?,
            posicion_actual=?,
            profundidad_actual_mm=?,
            fecha_ultimo_movimiento=?,
            id_ultimo_movimiento=?
          WHERE LOWER(tm)=LOWER(?)
        `, [
          placa,
          l.posicion || '',
          l.profundidad || '',
          new Date().toISOString(),
          idMov,
          tm
        ]);
      }

      await run('COMMIT');

      const reporte = await generarReporteSeguro(idRegistro);

      res.json({
        ok:true,
        message:'Registro guardado correctamente.',
        id_registro:idRegistro,
        reporte
      });

    } catch (err) {

      await run('ROLLBACK');
      throw err;
    }

  } catch (e) {

    res.json({
      ok:false,
      message:e.message
    });
  }
});

function estadoPorDestino(destino){

  const d = String(destino || '').toLowerCase();

  if(d.includes('reencauche')) return 'Enviada a reencauche';
  if(d.includes('basura')) return 'Basura';
  if(d.includes('dañada') || d.includes('danada')) return 'Dañada';
  if(d.includes('bodega')) return 'En bodega';

  return destino || 'En bodega';
}

router.post('/cambio', async (req, res) => {

  try {

    const {
      fecha,
      tipo_equipo,
      placa,
      nombre_llantero,
      llantas
    } = req.body;

    if (!fecha || !tipo_equipo || !placa || !nombre_llantero) {
      return res.json({
        ok:false,
        message:'Faltan datos obligatorios.'
      });
    }

    if (!Array.isArray(llantas) || !llantas.length) {
      return res.json({
        ok:false,
        message:'Debes agregar al menos una llanta.'
      });
    }

    const idRegistro = generarId('REG');
    const fechaCreacion = new Date().toISOString();

    await run('BEGIN TRANSACTION');

    try {

      await run(`
        INSERT INTO registros
        (
          id_registro,
          fecha,
          tipo_registro,
          tipo_equipo,
          placa,
          unidad,
          nombre_llantero,
          cantidad_llantas,
          estado_reporte,
          link_reporte,
          fecha_creacion
        )
        VALUES (?, ?, 'Cambio de llanta', ?, ?, ?, ?, ?, 'Pendiente', '', ?)
      `, [
        idRegistro,
        fecha,
        tipo_equipo,
        placa,
        placa,
        nombre_llantero,
        llantas.length,
        fechaCreacion
      ]);

      for (const l of llantas) {

        const tmDesmontado =
          String(l.tmDesmontado || '').trim();

        const tmMontado =
          String(l.tmMontado || '').trim();

        if (!tmDesmontado || !tmMontado) {
          throw new Error(
            'Cada cambio debe tener TM desmontado y TM montado.'
          );
        }

        const desmontada = await get(
          `SELECT * FROM llantas WHERE LOWER(tm)=LOWER(?)`,
          [tmDesmontado]
        );

        const montada = await get(
          `SELECT * FROM llantas WHERE LOWER(tm)=LOWER(?)`,
          [tmMontado]
        );

        if (!desmontada) {
          throw new Error(
            `El TM desmontado ${tmDesmontado} no existe.`
          );
        }

        if (!montada) {
          throw new Error(
            `El TM montado ${tmMontado} no existe.`
          );
        }

        const idDetalle = generarId('DET');
        const idMovDes = generarId('MOV');
        const idMovMon = generarId('MOV');

        await run(`
          INSERT INTO detalle_registro
          (
            id_detalle,
            id_registro,
            posicion,
            seccion,
            numero_llanta_desmontada,
            numero_llanta_montada,
            tm_desmontado,
            tm_montado,
            motivo,
            destino,
            observacion_detalle
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          idDetalle,
          idRegistro,
          l.posicion || '',
          l.seccion || '',
          desmontada.numero_llanta || '',
          montada.numero_llanta || '',
          tmDesmontado,
          tmMontado,
          l.motivo || '',
          l.destino || '',
          l.observacion || ''
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
            tipo_equipo,
            unidad,
            posicion,
            origen,
            destino,
            responsable,
            id_registro,
            observacion
          )
          VALUES (?, ?, ?, ?, ?, 'Desmontaje', ?, ?, ?, 'Unidad', ?, ?, ?, ?)
        `, [
          idMovDes,
          fecha,
          desmontada.id_llanta || '',
          desmontada.numero_llanta || '',
          tmDesmontado,
          tipo_equipo,
          placa,
          l.posicion || '',
          l.destino || '',
          nombre_llantero,
          idRegistro,
          l.observacion || ''
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
            tipo_equipo,
            unidad,
            posicion,
            origen,
            destino,
            responsable,
            id_registro,
            observacion
          )
          VALUES (?, ?, ?, ?, ?, 'Montaje', ?, ?, ?, 'Bodega', 'Unidad', ?, ?, ?)
        `, [
          idMovMon,
          fecha,
          montada.id_llanta || '',
          montada.numero_llanta || '',
          tmMontado,
          tipo_equipo,
          placa,
          l.posicion || '',
          nombre_llantero,
          idRegistro,
          l.observacion || ''
        ]);

        await run(`
          UPDATE llantas
          SET
            estado=?,
            ubicacion_actual=?,
            unidad_actual='',
            posicion_actual='',
            fecha_ultimo_movimiento=?,
            id_ultimo_movimiento=?
          WHERE LOWER(tm)=LOWER(?)
        `, [
          estadoPorDestino(l.destino),
          l.destino || 'Bodega',
          new Date().toISOString(),
          idMovDes,
          tmDesmontado
        ]);

        await run(`
          UPDATE llantas
          SET
            estado='Montada',
            ubicacion_actual='Unidad',
            unidad_actual=?,
            posicion_actual=?,
            fecha_ultimo_movimiento=?,
            id_ultimo_movimiento=?
          WHERE LOWER(tm)=LOWER(?)
        `, [
          placa,
          l.posicion || '',
          new Date().toISOString(),
          idMovMon,
          tmMontado
        ]);
      }

      await run('COMMIT');

      const reporte = await generarReporteSeguro(idRegistro);

      res.json({
        ok:true,
        message:'Registro guardado correctamente.',
        id_registro:idRegistro,
        reporte
      });

    } catch (err) {

      await run('ROLLBACK');
      throw err;
    }

  } catch (e) {

    res.json({
      ok:false,
      message:e.message
    });
  }
});

module.exports = router;