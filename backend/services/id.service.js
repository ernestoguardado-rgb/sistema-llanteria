function generarId(prefix) {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const fecha = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const rand = Math.floor(Math.random() * 900 + 100);
  return `${prefix}-${fecha}-${rand}`;
}

module.exports = { generarId };
