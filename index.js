// index.js - Orquestrador geral

const express = require('express');
const { iniciarLogin, getPage } = require('./robo_login');
const cadastrarClientes = require('./robo_clientes');

const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
  res.send(`
    <h2>🚀 Robôs Pipefy</h2>
    <ul>
     <p><a href="/executar/clientes">Clique aqui para rodar o robô de clientes</a></p>
  `);
});

app.get('/executar/clientes', async (req, res) => {
  res.send('<h3>⏳ Iniciando robô de clientes... Acompanhe os logs no Railway.</h3>');
  try {
    await iniciarLogin();              // Login único
    const page = getPage();            // Mantém a sessão aberta
    await cadastrarClientes(page);     // Executa o cadastro
  } catch (erro) {
    console.error('❌ Erro na execução:', erro);
  }
});

app.listen(PORT, () => {
  console.log(`🖥️ Servidor rodando em http://localhost:${PORT}`);
});
