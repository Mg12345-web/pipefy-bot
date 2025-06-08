const express = require('express');
const { iniciarLogin, getPage } = require('./robo_login');
const cadastrarClientes = require('./robo_clientes');

const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
  res.send(`
    <h2>🚀 Robôs Pipefy</h2>
    <ul>
      <li><a href="/ping">/ping</a></li>
      <li><a href="/executar/clientes">Cadastrar Cliente</a></li>
    </ul>
  `);
});

app.get('/ping', (req, res) => {
  console.log('🔁 Ping recebido!');
  res.send('✅ API ativa!');
});

app.get('/executar/clientes', async (req, res) => {
  console.log('🧠 Iniciando execução completa...');
  res.send('<h3>⏳ Executando robô de clientes. Verifique os logs no Railway.</h3>');
  try {
    await iniciarLogin();
    const page = getPage();
    await cadastrarClientes(page);
  } catch (erro) {
    console.error('❌ Erro na execução:', erro);
  }
});

app.listen(PORT, () => {
  console.log(`🖥️ Servidor rodando em http://localhost:${PORT}`);
});
