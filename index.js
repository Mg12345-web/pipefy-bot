const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const app = express();
const PORT = process.env.PORT || 8080;

// 🔒 Caminho do arquivo de lock
global.LOCK_PATH = path.join(os.tmpdir(), 'pipefy_robo.lock');

// 🌐 Página inicial com links para acionar cada robô
app.get('/', (req, res) => {
  res.send(`
    <h2>🤖 <b>Central de Robôs - MG Multas</b></h2>
    <ul>
      <li><a href="/start-clientes" target="_blank">👤 Iniciar Cadastro de Cliente</a></li>
      <li><a href="/start-crlv" target="_blank">🚗 Iniciar Cadastro de CRLV</a></li>
      <li><a href="/start-rgp" target="_blank">📝 Iniciar Cadastro RGP</a></li>
      <li><a href="/start-semrgp" target="_blank">📋 Iniciar Cadastro SEM RGP</a></li>
    </ul>
  `);
});

// 🧩 Importando os robôs
require('./cadastro_clientes');
require('./cadastro_crlv');
require('./cadastro_rgp');
require('./cadastro_semrgp');

// 🚀 Iniciar servidor
app.listen(PORT, () => {
  console.log(`🖥️ Servidor rodando em http://localhost:${PORT}`);
});
