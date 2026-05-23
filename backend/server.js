const operationsRoutes = require('./routes/operations.routes');
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./db/database');
const authRoutes = require('./routes/auth.routes');
const tireRoutes = require('./routes/tires.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const reportsRoutes = require('./routes/reports.routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));
app.use(
  '/reports',
  express.static(path.join(__dirname, 'reports'))
);

app.use(
  '/exports',
  express.static(path.join(__dirname, 'exports'))
);
app.use(
  '/reports',
  express.static(path.join(__dirname, 'reports'))
);

app.use('/api/auth', authRoutes);
app.use('/api/tires', tireRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/operations', operationsRoutes);
app.use('/api/reports', reportsRoutes);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

async function startServer() {
  try {
    await initDatabase();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Sistema Llantería activo en http://localhost:${PORT}`);
      console.log(`En red local usa: http://TU-IP:${PORT}`);
    });

  } catch (error) {
    console.error('Error iniciando el sistema:', error);
  }
}

startServer();