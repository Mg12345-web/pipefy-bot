const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

app.use(require('./cadastro_clientes'));
app.use(require('./cadastro_crlv'));
app.use(require('./cadastro_rgp'));
app.use(require('./cadastro_semrgp'));

app.get('/', (req, res) => {
  res.send(`
    <h2>🚀 <b>Robôs Pipefy</b></h2>
    <ul>
      <li><a href="/start-clientes">Iniciar cadastro CLIENTES</a></li>
      <li><a href="/start-crlv">Iniciar cadastro CRLV</a></li>
      <li><a href="/start-rgp">Iniciar cadastro RGP</a></li>
      <li><a href="/start-semrgp">Iniciar cadastro SEM RGP</a></li>
    </ul>
  `);
});

app.listen(PORT, () => {
  console.log(`🖥️ Servidor rodando na porta ${PORT}`);
});
