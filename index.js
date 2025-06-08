const express = require('express');
const { iniciarLogin, getPage } = require('./robo_login');
const cadastrarClientes = require('./robo_clientes');

const app = express();
const PORT = process.env.PORT || 8080;

app.get('/executar/clientes', async (req, res) => {
  res.send('<h3>✅ Robô de clientes iniciado</h3>');
  await iniciarLogin();              // Login 1x
  const page = getPage();            // Reutiliza a aba
  await cadastrarClientes(page);     // Executa o cadastro
});

app.listen(PORT, () => {
  console.log(`🖥️ Servidor rodando em http://localhost:${PORT}`);
});
