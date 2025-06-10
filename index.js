// index.js
const express = require('express');
const app = express();

const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
  res.send(`
    <h2>🚀 <b>Robôs Pipefy</b></h2>
    <ul>
      <li><a href="/start-clientes">Iniciar cadastro de <b>Cliente</b></a></li>
      <li><a href="/start-crlv">Iniciar cadastro de <b>CRLV</b></a></li>
      <li><a href="/start-rgp">Iniciar serviço <b>RGP</b></a></li>
      <li><a href="/start-semrgp">Iniciar serviço <b>sem RGP</b></a></li>
    </ul>
  `);
});

app.listen(PORT, () => {
  console.log(`🖥️ Servidor escutando em http://localhost:${PORT}`);
});
