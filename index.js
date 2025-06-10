const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

// importa cada robô
const executarCadastroCliente  = require('./cadastro_cliente');
const executarCadastroCRLV     = require('./cadastro_crlv');
const executarCadastroRGP      = require('./cadastro_rgp');
const executarCadastroSemRGP   = require('./cadastro_semrgp');

// Rota simples de menu
app.get('/', (_req, res) => {
  res.send(`
    <h2>🚀 Painel de Robôs Pipefy</h2>
    <p><a href="/start-clientes"  >Iniciar Cadastro CLIENTE</a></p>
    <p><a href="/start-crlv"      >Iniciar Cadastro CRLV</a></p>
    <p><a href="/start-rgp"       >Iniciar Serviço RGP</a></p>
    <p><a href="/start-semrgp"    >Iniciar Serviço SEM RGP</a></p>
  `);
});

// Cada rota chama o robô respectivo
app.get('/start-clientes', async (_req, res) => {
  await executarCadastroCliente();
  res.send('✅ Cliente concluído!');
});

app.get('/start-crlv', async (_req, res) => {
  await executarCadastroCRLV();
  res.send('✅ CRLV concluído!');
});

app.get('/start-rgp', async (_req, res) => {
  await executarCadastroRGP();
  res.send('✅ RGP concluído!');
});

app.get('/start-semrgp', async (_req, res) => {
  await executarCadastroSemRGP();
  res.send('✅ SEM RGP concluído!');
});

// Inicia servidor
app.listen(PORT, () => {
  console.log(`🖥️ Servidor escutando em http://localhost:${PORT}`);
});

