// index.js - Orquestrador geral com logs visíveis no Railway

const express = require('express');
const { iniciarLogin, getPage } = require('./robo_login');
const cadastrarClientes = require('./robo_clientes');

const app = express();
const PORT = process.env.PORT || 8080;

// Página inicial simples
app.get('/', (req, res) => {
  res.send(`
    <h2>🚀 Robôs Pipefy</h2>
    <ul>
      <li><a href="/executar/clientes">Clique aqui para rodar o robô de clientes</a></li>
    </ul>
  `);
});

// Rota de execução do robô de clientes
app.get('/executar/clientes', async (req, res) => {
  res.send('<h3>⏳ Robô de clientes em execução. Veja os logs no Railway.</h3>');

  console.log('🚦 Iniciando fluxo do robô de clientes...');
  try {
    await iniciarLogin(); // Login no Pipefy
    const page = getPage();
    await cadastrarClientes(page); // Executa o cadastro
    console.log('✅ Robô de clientes finalizado com sucesso.');
  } catch (erro) {
    console.error('❌ Erro durante execução do robô de clientes:', erro);
  }
});

// Inicializa o servidor
app.get('/ping', (req, res) => {
  res.send('🔄 API ativa!');
});
app.listen(PORT, () => {
  console.log(`🖥️ Servidor rodando em http://localhost:${PORT}`);
});
