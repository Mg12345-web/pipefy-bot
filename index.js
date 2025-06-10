// index.js - Robô Pipefy com rotas separadas
const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright');
const app = express();
const PORT = process.env.PORT || 8080;

// Caminho do arquivo de bloqueio
const LOCK_PATH = path.join(os.tmpdir(), 'pipefy_robo.lock');

// Página inicial com links
app.get('/', (req, res) => {
  res.send(`
    <h2>🤖 <b>Robôs Pipefy</b></h2>
    <p><a href="/start-clientes">▶️ Iniciar cadastro CLIENTES</a></p>
    <p><a href="/start-crlv">▶️ Iniciar cadastro CRLV</a></p>
    <p><a href="/start-rgp">▶️ Iniciar cadastro RGP</a></p>
    <p><a href="/start-semrgp">▶️ Iniciar cadastro SEM RGP</a></p>
  `);
});

// 🔁 Importando os robôs separados
const cadastroClientes = require('./cadastro_clientes');
const cadastroCRLV = require('./cadastro_crlv');
const cadastroRGP = require('./cadastro_rgp');
const cadastroSemRGP = require('./cadastro_semrgp');

// 🧠 Inicializando cada rota com app e configs
cadastroClientes(app, LOCK_PATH);
cadastroCRLV(app, LOCK_PATH);
cadastroRGP(app, LOCK_PATH);
cadastroSemRGP(app, LOCK_PATH);

// Inicia servidor
app.listen(PORT, () => {
  console.log(`🖥️ Servidor escutando em http://localhost:${PORT}`);
});

// Segurança: limpa lock se der crash
process.on('exit', () => {
  try { fs.unlinkSync(LOCK_PATH); } catch {}
});
