const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const MESES = [
  '01-Enero','02-Febrero','03-Marzo','04-Abril',
  '05-Mayo','06-Junio','07-Julio','08-Agosto',
  '09-Septiembre','10-Octubre','11-Noviembre','12-Diciembre'
];

function safeName(text){
  return String(text || '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '_');
}

function carpetaReporte(registro){
  const fecha = new Date(registro.fecha);
  const year = String(fecha.getFullYear());
  const mes = MESES[fecha.getMonth()] || '00-SinMes';
  const tipoRegistro = safeName(registro.tipo_registro || 'Registro');
  const tipoEquipo = safeName(registro.tipo_equipo || 'Equipo');

  return path.join(__dirname, '..', 'reports', tipoRegistro, year, mes, tipoEquipo);
}

function dibujarCroquisPDF(doc, registro, detalles, startY){
  const mapa = {};
  detalles.forEach(d => {
    mapa[String(d.posicion)] = d;
  });

  doc.font('Helvetica-Bold')
    .fontSize(13)
    .fillColor('#111827')
    .text(`Croquis ${registro.tipo_equipo}`, 40, startY, {
      width: 520,
      align: 'center'
    });

  let y = startY + 28;
  const size = 62;
  const gap = 12;

  const totalWidth4 = (size * 4) + (gap * 3);
  const startX4 = 40 + ((520 - totalWidth4) / 2);

  const totalWidth2 = (size * 2) + gap;
  const startX2 = 40 + ((520 - totalWidth2) / 2);

  const drawWheel = (pos, x, y) => {
    const d = mapa[pos];
    const tm = d ? (d.tm || d.tm_montado || '-') : 'Libre';

    doc.roundedRect(x, y, size, 48, 6)
      .lineWidth(1)
      .fillAndStroke(d ? '#ffffff' : '#eeeeee', '#111111');

    doc.fillColor('#111111')
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(`POS ${pos}`, x + 4, y + 7, {
        width: size - 8,
        align: 'center'
      });

    doc.font('Helvetica')
      .fontSize(7)
      .text(d ? `TM ${tm}` : 'Libre', x + 4, y + 23, {
        width: size - 8,
        align: 'center'
      });

    if(d && d.profundidad){
      doc.fontSize(7)
        .text(`Prof ${d.profundidad}`, x + 4, y + 34, {
          width: size - 8,
          align: 'center'
        });
    }
  };

  if(registro.tipo_equipo === 'Cabezal'){
    drawWheel('1', startX2, y);
    drawWheel('2', startX2 + size + gap, y);

    y += 62;
    ['3','4','5','6'].forEach((p,i) => {
      drawWheel(p, startX4 + i * (size + gap), y);
    });

    y += 62;
    ['7','8','9','10'].forEach((p,i) => {
      drawWheel(p, startX4 + i * (size + gap), y);
    });
  } else {
    ['11','12','13','14'].forEach((p,i) => {
      drawWheel(p, startX4 + i * (size + gap), y);
    });

    y += 62;
    ['15','16','17','18'].forEach((p,i) => {
      drawWheel(p, startX4 + i * (size + gap), y);
    });

    y += 62;
    ['19','20','21','22'].forEach((p,i) => {
      drawWheel(p, startX4 + i * (size + gap), y);
    });
  }

  return y + 65;
}

function generarPDFRegistro(registro, detalles = []){
  return new Promise((resolve, reject) => {
    try {
      const folder = carpetaReporte(registro);
      fs.mkdirSync(folder, { recursive:true });

      const filename = `${safeName(registro.id_registro)}_${safeName(registro.unidad)}_${safeName(registro.fecha)}.pdf`;
      const fullPath = path.join(folder, filename);

      const doc = new PDFDocument({ margin:40, size:'LETTER' });
      const stream = fs.createWriteStream(fullPath);

      doc.pipe(stream);

      doc.rect(0, 0, doc.page.width, 90).fill('#0f172a');

      doc.fillColor('white').fontSize(22).font('Helvetica-Bold')
        .text('TRANSPORTES MARTÍNEZ', 40, 25, { align:'center' });

      doc.fontSize(12).font('Helvetica')
        .text('Reporte de Llantería', 40, 52, { align:'center' });

      doc.fontSize(10)
        .text(`Registro: ${registro.id_registro}`, 40, 70, { align:'center' });

      const startY = 120;

      doc.roundedRect(40, startY, 520, 90, 8).fill('#f1f5f9');
      doc.fillColor('black');

      doc.fontSize(12).font('Helvetica-Bold')
        .text('Datos Generales', 55, startY + 10);

      doc.font('Helvetica').fontSize(10);
      doc.text(`Tipo de registro: ${registro.tipo_registro}`, 55, startY + 35);
      doc.text(`Tipo de equipo: ${registro.tipo_equipo}`, 300, startY + 35);
      doc.text(`Unidad / Placa: ${registro.unidad || registro.placa}`, 55, startY + 55);
      doc.text(`Fecha: ${registro.fecha}`, 300, startY + 55);
      doc.text(`Llantero: ${registro.nombre_llantero}`, 55, startY + 75);

      let currentY = dibujarCroquisPDF(doc, registro, detalles, startY + 120);
      currentY += 15;

      doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f172a')
        .text('Detalle de llantas', 40, currentY);

      currentY += 25;

      const headers = registro.tipo_registro === 'Calibracion'
        ? ['Pos', 'Sección', 'TM', 'Medida', 'PSI', 'Prof']
        : ['Pos', 'Sección', 'TM Des.', 'TM Mont.', 'Motivo', 'Destino'];

      const colX = [40, 90, 170, 280, 390, 480];

      doc.rect(40, currentY, 520, 25)
        .lineWidth(1)
        .fillAndStroke('#d9d9d9', '#111111');

      doc.fillColor('#111111')

      headers.forEach((h, i) => {
        doc.text(h, colX[i], currentY + 8);
      });

      currentY += 25;

      detalles.forEach((d, index) => {
        const bg = index % 2 === 0 ? '#f8fafc' : '#e2e8f0';

        doc.rect(40, currentY, 520, 28).fill(bg);
        doc.fillColor('black').font('Helvetica').fontSize(8);

        const values = registro.tipo_registro === 'Calibracion'
          ? [
              d.posicion || '-',
              d.seccion || '-',
              d.tm || '-',
              d.numero_llanta || '-',
              d.psi_actual || '-',
              d.profundidad || '-'
            ]
          : [
              d.posicion || '-',
              d.seccion || '-',
              d.tm_desmontado || '-',
              d.tm_montado || '-',
              d.motivo || '-',
              d.destino || '-'
            ];

        values.forEach((v, i) => {
          doc.text(String(v), colX[i], currentY + 9, {
            width:75,
            ellipsis:true
          });
        });

        currentY += 28;

        if(currentY > 700){
          doc.addPage();
          currentY = 60;
        }
      });

      currentY += 25;

      doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a')
        .text('Observaciones', 40, currentY);

      currentY += 20;

      doc.roundedRect(40, currentY, 520, 70, 6).stroke('#94a3b8');

      currentY += 120;

      doc.moveTo(180, currentY).lineTo(380, currentY).stroke();

      doc.fontSize(10).fillColor('black')
        .text('Firma responsable', 220, currentY + 8);

      doc.fontSize(8).fillColor('#64748b')
        .text('Sistema de gestión de llantas', 40, 760, { align:'center' });

      doc.end();

      stream.on('finish', () => {
        resolve({
          fullPath,
          relativePath: path.relative(path.join(__dirname, '..'), fullPath).replace(/\\/g, '/')
        });
      });

      stream.on('error', reject);

    } catch (e) {
      reject(e);
    }
  });
}

module.exports = {
  generarPDFRegistro
};