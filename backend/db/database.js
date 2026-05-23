const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, 'llanteria.db');
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, function (err, row) {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, function (err, rows) {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function initDatabase() {
  await run(`PRAGMA foreign_keys = ON`);

  await run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT UNIQUE NOT NULL,
      clave TEXT NOT NULL,
      nombre TEXT NOT NULL,
      rol TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'Activo'
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS llantas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_llanta TEXT UNIQUE NOT NULL,
      numero_llanta TEXT NOT NULL,
      tm TEXT UNIQUE NOT NULL,
      marca TEXT NOT NULL,
      tipo_llanta TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'En bodega',
      ubicacion_actual TEXT DEFAULT 'Bodega',
      unidad_actual TEXT DEFAULT '',
      posicion_actual TEXT DEFAULT '',
      profundidad_actual_mm REAL DEFAULT NULL,
      fecha_ingreso TEXT NOT NULL,
      fecha_ultimo_movimiento TEXT NOT NULL,
      proveedor TEXT DEFAULT '',
      costo REAL DEFAULT NULL,
      observacion TEXT DEFAULT '',
      alerta_profundidad TEXT DEFAULT '',
      id_ultimo_movimiento TEXT DEFAULT ''
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS movimientos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_movimiento TEXT UNIQUE NOT NULL,
      fecha TEXT NOT NULL,
      id_llanta TEXT DEFAULT '',
      numero_llanta TEXT DEFAULT '',
      tm TEXT NOT NULL,
      tipo_movimiento TEXT NOT NULL,
      tipo_equipo TEXT DEFAULT '',
      unidad TEXT DEFAULT '',
      posicion TEXT DEFAULT '',
      profundidad REAL DEFAULT NULL,
      psi_actual REAL DEFAULT NULL,
      origen TEXT DEFAULT '',
      destino TEXT DEFAULT '',
      responsable TEXT DEFAULT '',
      id_registro TEXT DEFAULT '',
      observacion TEXT DEFAULT ''
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS registros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_registro TEXT UNIQUE NOT NULL,
      fecha TEXT NOT NULL,
      tipo_registro TEXT NOT NULL,
      tipo_equipo TEXT NOT NULL,
      placa TEXT NOT NULL,
      unidad TEXT NOT NULL,
      nombre_llantero TEXT NOT NULL,
      cantidad_llantas INTEGER NOT NULL,
      estado_reporte TEXT DEFAULT 'Pendiente',
      link_reporte TEXT DEFAULT '',
      fecha_creacion TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS detalle_registro (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_detalle TEXT UNIQUE NOT NULL,
      id_registro TEXT NOT NULL,
      posicion TEXT DEFAULT '',
      seccion TEXT DEFAULT '',
      numero_llanta TEXT DEFAULT '',
      psi_actual REAL DEFAULT NULL,
      profundidad REAL DEFAULT NULL,
      tm TEXT DEFAULT '',
      numero_llanta_desmontada TEXT DEFAULT '',
      numero_llanta_montada TEXT DEFAULT '',
      tm_desmontado TEXT DEFAULT '',
      tm_montado TEXT DEFAULT '',
      motivo TEXT DEFAULT '',
      origen TEXT DEFAULT '',
      destino TEXT DEFAULT '',
      observacion_detalle TEXT DEFAULT '',
      FOREIGN KEY(id_registro) REFERENCES registros(id_registro)
    )
  `);

  await run(`CREATE INDEX IF NOT EXISTS idx_llantas_tm ON llantas(tm)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_llantas_unidad ON llantas(unidad_actual)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_llantas_estado ON llantas(estado)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_movimientos_tm ON movimientos(tm)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos(fecha)`);

  const admin = await get('SELECT id FROM usuarios WHERE usuario = ?', ['admin']);

  if (!admin) {
    await run(
      `INSERT INTO usuarios (usuario, clave, nombre, rol, estado) VALUES (?, ?, ?, ?, ?)`,
      ['admin', '1234', 'Administrador', 'Administrador', 'Activo']
    );
  }
}

module.exports = {
  db,
  run,
  get,
  all,
  initDatabase
};