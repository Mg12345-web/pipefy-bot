const express = require('express');
const path = require('path');
const fs = require('fs');
const { runClientRobot } = require('./robots/client');
const { runCrlvRobot } = require('./robots/crlv');
const { runRgpRobot } = require('./robots/rgp');
const { runSemRgpRobot } = require('./robots/semrgp'); // Importa o robô de SEM RGP

const app = express();
const PORT = process.env.PORT || 8080;

// Rota Raiz
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
  `);
});

// 📋 ROTA CLIENTES
app.get('/start-clientes', runClientRobot);

// 🚗 ROTA CRLV
app.get('/start-crlv', runCrlvRobot);

// ➕ ROTA PARA CADASTRO RGP
app.get('/start-rgp', runRgpRobot);

// ➖ ROTA PARA CADASTRO SEM RGP
app.get('/start-semrgp', runSemRgpRobot); // Conecta a rota com a função do robô SEM RGP


// 🔎 VISUALIZAR PRINTS
app.get('/view-client-print', (req, res) => {
  const screenshotPath = path.resolve(__dirname, 'prints/print_final_clientes.png');
  if (fs.existsSync(screenshotPath)) {
    const base64 = fs.readFileSync(screenshotPath).toString('base64');
    res.send(`
      <h3>📷 Último print da tela de Clientes:</h3>
      <img src="data:image/png;base64,${base64}" style="max-width:100%; border:1px solid #ccc;">
      <p><a href="/">⬅️ Voltar</a></p>
    `);
  } else {
    res.send('<p>❌ Nenhum print de cliente encontrado ainda.</p><p><a href="/">⬅️ Voltar</a></p>');
  }
});

app.get('/view-crlv-print', (req, res) => {
  const screenshotPath = path.resolve(__dirname, 'prints/registro_crlv.png');
  if (fs.existsSync(screenshotPath)) {
    const base64 = fs.readFileSync(screenshotPath).toString('base64');
    res.send(`
      <h3>📷 Último print da tela do CRLV:</h3>
      <img src="data:image/png;base64,${base64}" style="max-width:100%; border:1px solid #ccc;">
      <p><a href="/">⬅️ Voltar</a></p>
    `);
  } else {
    res.send('<p>❌ Nenhum print de CRLV encontrado ainda.</p><p><a href="/">⬅️ Voltar</a></p>');
  }
});

app.get('/view-rgp-print', (req, res) => {
  const screenshotPath = path.resolve(__dirname, 'prints/print_final_rgp.png');
  if (fs.existsSync(screenshotPath)) {
    const base64 = fs.readFileSync(screenshotPath).toString('base64');
    res.send(`
      <h3>📷 Último print da tela de RGP:</h3>
      <img src="data:image/png;base64,${base64}" style="max-width:100%; border:1px solid #ccc;">
      <p><a href="/">⬅️ Voltar</a></p>
    `);
  } else {
    res.send('<p>❌ Nenhum print de RGP encontrado ainda.</p><p><a href="/">⬅️ Voltar</a></p>');
  }
});

// 🔎 VISUALIZAR PRINT DE SEM RGP (Nova rota para o print de SEM RGP)
app.get('/view-semrgp-print', (req, res) => {
  const screenshotPath = path.resolve(__dirname, 'prints/print_final_semrgp.png');
  if (fs.existsSync(screenshotPath)) {
    const base64 = fs.readFileSync(screenshotPath).toString('base64');
    res.send(`
      <h3>📷 Último print da tela de SEM RGP:</h3>
      <img src="data:image/png;base64,${base64}" style="max-width:100%; border:1px solid #ccc;">
      <p><a href="/">⬅️ Voltar</a></p>
    `);
  } else {
    res.send('<p>❌ Nenhum print de SEM RGP encontrado ainda.</p><p><a href="/">⬅️ Voltar</a></p>');
  }
});


app.listen(PORT, () => {
  console.log(`🖥️ Servidor escutando em http://localhost:${PORT}`);
});
