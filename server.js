// server.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { addToQueue, startQueue } = require('./robots/fila');

const app = express();
const PORT = process.env.PORT || 3000;

// Pasta temporária para arquivos
const uploadPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadPath),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Rota principal para envio do formulário
app.post('/formulario', upload.fields([
  { name: 'cnh', maxCount: 1 },
  { name: 'procuracao', maxCount: 1 },
  { name: 'contrato', maxCount: 1 },
  { name: 'crlv', maxCount: 1 },
  { name: 'autuacoes', maxCount: 10 }
]), async (req, res) => {
  const { email, telefone, autuacao_tipo = [] } = req.body;
  const arquivos = req.files;

  // Montar o item da fila
  const tarefa = {
    email,
    telefone,
    arquivos,
    autuacao_tipo: Array.isArray(autuacao_tipo) ? autuacao_tipo : [autuacao_tipo],
    timestamp: Date.now()
  };

  addToQueue(tarefa);
  res.send('✅ Formulário recebido com sucesso. O robô vai processar em breve.');
});

app.get('/', (req, res) => {
  res.send('<h2>Servidor online. Use POST /formulario para enviar os dados.</h2>');
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  startQueue();
});
