const express = require('express');
const path = require('path');
const fs = require('fs');
const upload = require('./utils/upload');
const { runClientRobot } = require('./robots/client');
const { runCrlvRobot } = require('./robots/crlv');
const { runRgpRobot } = require('./robots/rgp');
const { runSemRgpRobot } = require('./robots/semrgp');
const { addToQueue, startQueue } = require('./robots/fila');
const { handleOraculo } = require('./routes/oraculo');
const { handleFormulario } = require('./routes/formulario');

const app = express();
const PORT = process.env.PORT || 8080;

// Página inicial
app.get('/', (req, res) => {
  res.send(`
    <h2>🚀 <b>Robô Pipefy</b></h2>
    <p><a href="/start-clientes">Iniciar cadastro de cliente</a></p>
    <p><a href="/start-crlv">Iniciar cadastro de CRLV</a></p>
    <p><a href="/start-rgp">Iniciar cadastro de serviço RGP</a></p>
    <p><a href="/start-semrgp">Iniciar cadastro de serviço sem RGP</a></p>
    <p><a href="/view-client-print">Ver último print de cliente</a></p>
    <p><a href="/view-crlv-print">Ver último print de CRLV</a></p>
    <p><a href="/view-rgp-print">Ver último print de RGP</a></p>
    <p><a href="/view-semrgp-print">Ver último print de SEM RGP</a></p>
    <p><b>Nova rota:</b> POST /formulario para envio via site</p>
  `);
});

// ROTAS DE AÇÃO
app.get('/start-clientes', runClientRobot);
app.get('/start-crlv', runCrlvRobot);
app.get('/start-rgp', runRgpRobot);
app.get('/start-semrgp', runSemRgpRobot);

// FORMULÁRIOS E INTEGRAÇÃO
app.post('/formulario', upload.any(), handleFormulario);
app.post('/oraculo', upload.any(), handleOraculo);

// STATUS DA FILA
app.get('/status', (req, res) => {
  res.json({ status: 'ok', filaAtiva: true, timestamp: Date.now() });
});

// VISUALIZAÇÃO DE PRINTS
const prints = [
  { route: 'client', file: 'print_final_clientes.png' },
  { route: 'crlv', file: 'registro_crlv.png' },
  { route: 'rgp', file: 'print_final_rgp.png' },
  { route: 'semrgp', file: 'print_final_semrgp.png' },
];

app.get('/ultimo-oraculo.json', (req, res) => {
  const filePath = path.resolve(__dirname, 'logs/ultimo-oraculo.json');
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ erro: 'Nenhum dado disponível ainda.' });
  }
});

prints.forEach(({ route, file }) => {
  app.get(`/view-${route}-print`, (req, res) => {
    const screenshotPath = path.resolve(__dirname, `prints/${file}`);
    if (fs.existsSync(screenshotPath)) {
      const base64 = fs.readFileSync(screenshotPath).toString('base64');
      res.send(`
        <h3>📷 Último print da tela de ${route.toUpperCase()}:</h3>
        <img src="data:image/png;base64,${base64}" style="max-width:100%; border:1px solid #ccc;">
        <p><a href="/">⬅️ Voltar</a></p>
      `);
    } else {
      res.send(`<p>❌ Nenhum print de ${route.toUpperCase()} encontrado ainda.</p><p><a href="/">⬅️ Voltar</a></p>`);
    }
  });
});

// Garante que a pasta de logs existe
const logsPath = path.resolve(__dirname, 'logs');
if (!fs.existsSync(logsPath)) {
  fs.mkdirSync(logsPath, { recursive: true });
}

startQueue();
app.listen(PORT, () => {
  console.log(`🖥️ Servidor escutando em http://localhost:${PORT}`);
});
