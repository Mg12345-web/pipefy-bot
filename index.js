const express = require('express');
const { iniciarLogin, getPage } = require('./robo_login');
const cadastrarClientes = require('./robo_clientes');

const app = express();
const PORT = process.env.PORT || 8080;

app.get('/executar/clientes', async (req, res) => {
  console.log('🚀 Rota /executar/clientes acessada');
  res.send('<h3>✅ Cadastro de clientes iniciado</h3>');

  await iniciarLogin();
  const page = getPage();

  await cadastrarClientes(page);
});

app.listen(PORT, () => {
  console.log(`🖥️ Servidor rodando em http://localhost:${PORT}`);
});
