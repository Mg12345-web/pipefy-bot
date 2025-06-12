// routes/formulario.js
const fs = require('fs');
const { extractText } = require('../utils/extractText');
const { extrairAitsDosArquivos } = require('../utils/extrairAitsDosArquivos');
const { addToQueue } = require('../robots/fila');

async function handleFormulario(req, res) {
  const { email, telefone } = req.body;
  const arquivos = {};
  const autuacoes = [];

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

  addToQueue(tarefa);

  const caminhosAutuacoes = req.files
    .filter(file => file.fieldname.startsWith('autuacoes['))
    .map(file => file.path)
    .filter(fs.existsSync);

  const procuracaoPath = arquivos?.procuracao?.[0]?.path;
  let nome = '', cpf = '', aits = [];

  try {
    if (caminhosAutuacoes.length > 0) {
      console.log('📂 Arquivos para leitura de AIT:', caminhosAutuacoes);
      aits = await extrairAitsDosArquivos(caminhosAutuacoes);
    }

    if (procuracaoPath && fs.existsSync(procuracaoPath)) {
      const texto = await extractText(procuracaoPath);
      nome = texto.match(/(?:Nome|NOME):?\s*([A-Z\s]{5,})/)?.[1]?.trim() || '';
      cpf = texto.match(/CPF[:\s]*([\d\.\-]{11,})/)?.[1]?.trim() || '';
    }

    res.send(`
      <p style="color:green">✅ Formulário recebido. O robô vai processar em breve.</p>
      <div style="margin-top:20px; padding:15px; border:1px solid #ccc; background:#f9f9f9; border-radius:8px">
        <strong>Nome do cliente:</strong> ${nome || '<em>(não encontrado)</em>'}<br>
        <strong>CPF:</strong> ${cpf || '<em>(não encontrado)</em>'}<br>
        <strong>AIT(s) encontrado(s):</strong> ${aits.length > 0 ? aits.join(', ') : '<em>(nenhum localizado)</em>'}
      </div>
      <p style="margin-top:20px"><a href="/">⬅️ Voltar</a></p>
    `);
  } catch (err) {
    console.error('❌ Erro ao processar formulário:', err.message);
    res.send(`
      <p style="color:green">✅ Formulário recebido. O robô vai processar em breve.</p>
      <p><strong>⚠️ Erro ao extrair dados:</strong> ${err.message}</p>
      <p><a href="/">⬅️ Voltar</a></p>
    `);
  }
}

module.exports = { handleFormulario };
