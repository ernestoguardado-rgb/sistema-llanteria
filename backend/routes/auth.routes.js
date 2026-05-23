const express = require('express');
const { get, all, run } = require('../db/database');
const router = express.Router();

const ROLES_VALIDOS = [
  'Administrador',
  'Llantería',
  'Bodega',
  'Consulta'
];

router.post('/login', async (req, res) => {
  try {
    const { usuario, clave } = req.body;

    const user = await get(`
      SELECT id, usuario, nombre, rol, estado
      FROM usuarios
      WHERE LOWER(usuario) = LOWER(?)
      AND clave = ?
      AND LOWER(estado) = 'activo'
    `, [usuario || '', clave || '']);

    if (!user) {
      return res.json({
        ok:false,
        message:'Usuario o clave incorrectos.'
      });
    }

    res.json({
      ok:true,
      ...user
    });

  } catch (e) {
    res.json({
      ok:false,
      message:e.message
    });
  }
});

router.get('/usuarios', async (req, res) => {
  try {
    const usuarios = await all(`
      SELECT id, usuario, clave, nombre, rol, estado
      FROM usuarios
      ORDER BY nombre
    `);

    res.json({
      ok:true,
      usuarios
    });

  } catch (e) {
    res.json({
      ok:false,
      message:e.message
    });
  }
});

router.post('/usuarios', async (req, res) => {
  try {
    const { usuario, clave, nombre, rol } = req.body;

    if(!usuario || !clave || !nombre || !rol){
      return res.json({
        ok:false,
        message:'Completa usuario, clave, nombre y rol.'
      });
    }

    if(!ROLES_VALIDOS.includes(rol)){
      return res.json({
        ok:false,
        message:'Rol no válido.'
      });
    }

    const existe = await get(
      `SELECT id FROM usuarios WHERE LOWER(usuario)=LOWER(?)`,
      [usuario]
    );

    if(existe){
      return res.json({
        ok:false,
        message:'Ya existe un usuario con ese nombre.'
      });
    }

    await run(`
      INSERT INTO usuarios
      (usuario, clave, nombre, rol, estado)
      VALUES (?, ?, ?, ?, 'Activo')
    `, [usuario, clave, nombre, rol]);

    res.json({
      ok:true,
      message:'Usuario creado correctamente.'
    });

  } catch (e) {
    res.json({
      ok:false,
      message:e.message
    });
  }
});

router.put('/usuarios/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { nombre, rol, estado, clave } = req.body;

    const user = await get(
      `SELECT * FROM usuarios WHERE id=?`,
      [id]
    );

    if(!user){
      return res.json({
        ok:false,
        message:'Usuario no encontrado.'
      });
    }

    const nuevoNombre = nombre || user.nombre;
    const nuevoRol = rol || user.rol;
    const nuevoEstado = estado || user.estado;
    const nuevaClave = clave || user.clave;

    if(!ROLES_VALIDOS.includes(nuevoRol)){
      return res.json({
        ok:false,
        message:'Rol no válido.'
      });
    }

    await run(`
      UPDATE usuarios
      SET nombre=?, rol=?, estado=?, clave=?
      WHERE id=?
    `, [nuevoNombre, nuevoRol, nuevoEstado, nuevaClave, id]);

    res.json({
      ok:true,
      message:'Usuario actualizado correctamente.'
    });

  } catch (e) {
    res.json({
      ok:false,
      message:e.message
    });
  }
});

router.patch('/usuarios/:id/estado', async (req, res) => {
  try {
    const id = req.params.id;
    const { estado } = req.body;

    if(!['Activo','Inactivo'].includes(estado)){
      return res.json({
        ok:false,
        message:'Estado no válido.'
      });
    }

    await run(
      `UPDATE usuarios SET estado=? WHERE id=?`,
      [estado, id]
    );

    res.json({
      ok:true,
      message:'Estado actualizado correctamente.'
    });

  } catch (e) {
    res.json({
      ok:false,
      message:e.message
    });
  }
});

module.exports = router;