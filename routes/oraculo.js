const fs = require('fs');
const path = require('path');
const { extractText, interpretarTextoComGPT } = require('../utils/extractText');
const { interpretarImagemComGptVision } = require('../utils/gptVision');
const { extrairAitsDosArquivos } = require('../utils/extrairAitsDosArquivos');
const { addToQueue } = require('../robots/fila');

async function handleOraculo(req, res) {
  const { email, telefone } = req.body;
  const arquivos = {};
  const autuacoes = [];
  let tarefa = {};

  console.log('📥 req.body:', JSON.stringify(req.body, null, 2));
  console.log('📎 req.files:', req.files?.map(f => f.originalname));

  // Organiza os arquivos
  for (const file of req.files) {
    const field = file.fieldname;
    if (field.startsWith('autuacoes[')) {
      const idx = +field.match(/autuacoes\[(\d+)\]/)[1];
      autuacoes[idx] = autuacoes[idx] || {};
      autuacoes[idx].arquivo = file.path;
    } else {
      arquivos[field] = arquivos[field] || [];
      arquivos[field].push(file);
    }
  }

  // Lê os tipos de autuação
  Object.keys(req.body).forEach(key => {
    const m = key.match(/autuacoes\[(\d+)\]\[tipo\]/);
    if (m) {
      const idx = +m[1];
      autuacoes[idx] = autuacoes[idx] || {};
      autuacoes[idx].tipo = req.body[key];
    }
  });

  const procurar = arquivos.procuracao?.[0]?.path;
  const crlv = arquivos.crlv?.[0]?.path;
  let dados = {}, aits = [];

  try {
    // 🧠 Procuração
    if (procurar) {
      const ext = path.extname(procurar).toLowerCase();
      if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') {
        dados = await interpretarImagemComGptVision(procurar, 'procuracao');
      } else {
        const texto = await extractText(procurar);
        dados = JSON.parse(await interpretarTextoComGPT(texto, 'procuracao'));
      }
    }

    dados.Email = email;
    dados['Número de telefone'] = telefone;

    // 🚗 CRLV
    if (crlv) {
      const ext = path.extname(crlv).toLowerCase();
      if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') {
        const crlvDados = await interpretarImagemComGptVision(crlv, 'crlv');
        Object.assign(dados, crlvDados);
      } else {
        const textoCR = await extractText(crlv);
        const jsonCR = await interpretarTextoComGPT(textoCR, 'crlv');
        Object.assign(dados, JSON.parse(jsonCR));
      }
    }

    // ⚠️ Autuações
    const caminhosAut = autuacoes
      .filter(a => a.tipo && a.arquivo)
      .map(a => a.arquivo);

    if (caminhosAut.length > 0) {
      aits = await extrairAitsDosArquivos(caminhosAut);
    }

    tarefa = {
      email,
      telefone,
      arquivos,
      autuacoes: autuacoes.filter(a => a.tipo && a.arquivo),
      dados,
      timestamp: Date.now()
    };

    if (!dados['Nome Completo'] || !dados['Placa']) {
      throw new Error('Dados incompletos: Nome Completo ou Placa ausentes.');
    }

    addToQueue(tarefa);

    res.send({
      status: 'ok',
      mensagem: 'Oráculo processado com sucesso',
      dadosExtraidos: { ...dados, aits }
    });

    fs.writeFileSync('./logs/ultimo-oraculo.json', JSON.stringify({ dadosExtraidos: { ...dados, aits } }, null, 2));

  } catch (err) {
    console.error('❌ Oráculo erro:', err.message);
    res.status(500).send({ status: 'erro', mensagem: err.message });

    try {
      fs.writeFileSync(`./logs/oraculo_${Date.now()}.json`, JSON.stringify(tarefa, null, 2));
    } catch (logErr) {
      console.error('⚠️ Falha ao salvar log do oráculo:', logErr.message);
    }
  }
}

module.exports = { handleOraculo };
