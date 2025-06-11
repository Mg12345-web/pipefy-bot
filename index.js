// index.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const upload = require('./utils/upload');
const { runClientRobot } = require('./robots/client');
const { runCrlvRobot } = require('./robots/crlv');
const { runRgpRobot } = require('./robots/rgp');
const { runSemRgpRobot } = require('./robots/semrgp');
const { addToQueue, startQueue } = require('./robots/fila');

const app = express();
const PORT = process.env.PORT || 8080;

// Rota Raiz
app.get('/', (req, res) => {
  res.send(`
    <h2>🚀 <b>Robô Pipefy</b></h2>
    <p><a href="/start-clientes">Iniciar cadastro de cliente</a></p>
    <p><a href="/start-crlv">Iniciar cadastro de CRLV</a></p>
    <p><a href="/start-rgp">Iniciar cadastro de serviço RGP</a></p>
    <p><a href="/start-semrgp">Iniciar cadastro de serviço sem RGP</a></p>
    <p><a href="/view-client-print">Ver último print de cliente</a></p>
    <p><a href="/view-crlv-print">Ver último print de CRLV</a></p>
    <p><a href="/view-rgp-print">Ver último print de RGP</a></p>
    <p><a href="/view-semrgp-print">Ver último print de SEM RGP</a></p>
    <p><b>Nova rota:</b> POST /formulario para envio via site</p>
  `);
});

// ROTA CLIENTES
app.get('/start-clientes', runClientRobot);

// ROTA CRLV
app.get('/start-crlv', runCrlvRobot);

// ROTA RGP
app.get('/start-rgp', runRgpRobot);

// ROTA SEM RGP
app.get('/start-semrgp', runSemRgpRobot);

// ROTA NOVA: formulário de envio
app.post('/formulario', upload.any(), (req, res) => {
  const { email, telefone } = req.body;
  const arquivos = {};
  const autuacoes = [];

  // Organiza os arquivos por fieldname
  for (const file of req.files) {
    const field = file.fieldname;

    if (field.startsWith('autuacoes[')) {
      const match = field.match(/autuacoes\[(\d+)\]\[arquivo\]/);
      if (match) {
        const index = parseInt(match[1], 10);
        if (!autuacoes[index]) autuacoes[index] = {};
        autuacoes[index].arquivo = file.path;
      }
    } else {
      if (!arquivos[field]) arquivos[field] = [];
      arquivos[field].push(file);
    }
  }

  // Organiza os tipos
  Object.keys(req.body).forEach(key => {
    const match = key.match(/autuacoes\[(\d+)\]\[tipo\]/);
    if (match) {
      const index = parseInt(match[1], 10);
      if (!autuacoes[index]) autuacoes[index] = {};
      autuacoes[index].tipo = req.body[key];
    }
  });

  const tarefa = {
    email,
    telefone,
    arquivos,
    autuacoes: autuacoes.filter(a => a.tipo && a.arquivo),
    timestamp: Date.now()
  };

  const { extractText } = require('./utils/extractText');

addToQueue(tarefa);

// Tentativa de extração de dados da procuração
const procuracaoPath = arquivos?.procuracao?.[0]?.path;
let nome = '', cpf = '';

if (procuracaoPath && fs.existsSync(procuracaoPath)) {
  extractText(procuracaoPath).then(texto => {
    nome = texto.match(/(?:Nome|NOME):?\s*([A-Z\s]{5,})/)?.[1]?.trim() || '';
    cpf = texto.match(/CPF[:\s]*([\d\.\-]{11,})/)?.[1]?.trim() || '';

    res.send(`
      <p style="color:green">✅ Formulário recebido. O robô vai processar em breve.</p>
      <div style="margin-top:20px; padding:15px; border:1px solid #ccc; background:#f9f9f9; border-radius:8px">
        <strong>Nome do cliente:</strong> ${nome || '<em>(não encontrado)</em>'}<br>
        <strong>CPF:</strong> ${cpf || '<em>(não encontrado)</em>'}
      </div>
      <p style="margin-top:20px"><a href="/">⬅️ Voltar</a></p>
    `);
  }).catch(err => {
    res.send(`
      <p style="color:green">✅ Formulário recebido. O robô vai processar em breve.</p>
      <p><strong>⚠️ Erro ao extrair dados da procuração:</strong> ${err.message}</p>
      <p><a href="/">⬅️ Voltar</a></p>
    `);
  });
} else {
  res.send(`
    <p style="color:green">✅ Formulário recebido. O robô vai processar em breve.</p>
    <p><strong>⚠️ Arquivo de procuração não encontrado.</strong></p>
    <p><a href="/">⬅️ Voltar</a></p>
  `);
}

});

// ROTAS DE PRINTS
app.get('/view-client-print', (req, res) => {
  const screenshotPath = path.resolve(__dirname, 'prints/print_final_clientes.png');
  if (fs.existsSync(screenshotPath)) {
    const base64 = fs.readFileSync(screenshotPath).toString('base64');
    res.send(`
      <h3>📷 Último print da tela de Clientes:</h3>
      <img src="data:image/png;base64,${base64}" style="max-width:100%; border:1px solid #ccc;">
      <p><a href="/">⬅️ Voltar</a></p>
    `);
  } else {
    res.send('<p>❌ Nenhum print de cliente encontrado ainda.</p><p><a href="/">⬅️ Voltar</a></p>');
  }
});

app.get('/view-crlv-print', (req, res) => {
  const screenshotPath = path.resolve(__dirname, 'prints/registro_crlv.png');
  if (fs.existsSync(screenshotPath)) {
    const base64 = fs.readFileSync(screenshotPath).toString('base64');
    res.send(`
      <h3>📷 Último print da tela do CRLV:</h3>
      <img src="data:image/png;base64,${base64}" style="max-width:100%; border:1px solid #ccc;">
      <p><a href="/">⬅️ Voltar</a></p>
    `);
  } else {
    res.send('<p>❌ Nenhum print de CRLV encontrado ainda.</p><p><a href="/">⬅️ Voltar</a></p>');
  }
});

app.get('/view-rgp-print', (req, res) => {
  const screenshotPath = path.resolve(__dirname, 'prints/print_final_rgp.png');
  if (fs.existsSync(screenshotPath)) {
    const base64 = fs.readFileSync(screenshotPath).toString('base64');
    res.send(`
      <h3>📷 Último print da tela de RGP:</h3>
      <img src="data:image/png;base64,${base64}" style="max-width:100%; border:1px solid #ccc;">
      <p><a href="/">⬅️ Voltar</a></p>
    `);
  } else {
    res.send('<p>❌ Nenhum print de RGP encontrado ainda.</p><p><a href="/">⬅️ Voltar</a></p>');
  }
});

app.get('/view-semrgp-print', (req, res) => {
  const screenshotPath = path.resolve(__dirname, 'prints/print_final_semrgp.png');
  if (fs.existsSync(screenshotPath)) {
    const base64 = fs.readFileSync(screenshotPath).toString('base64');
    res.send(`
      <h3>📷 Último print da tela de SEM RGP:</h3>
      <img src="data:image/png;base64,${base64}" style="max-width:100%; border:1px solid #ccc;">
      <p><a href="/">⬅️ Voltar</a></p>
    `);
  } else {
    res.send('<p>❌ Nenhum print de SEM RGP encontrado ainda.</p><p><a href="/">⬅️ Voltar</a></p>');
  }
});

startQueue();

app.listen(PORT, () => {
  console.log(`🖥️ Servidor escutando em http://localhost:${PORT}`);
});
