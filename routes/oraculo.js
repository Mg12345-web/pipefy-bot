const fs = require('fs');
const { extractText } = require('../utils/extractText');
const { extrairAitsDosArquivos } = require('../utils/extrairAitsDosArquivos');
const { addToQueue } = require('../robots/fila');

async function handleOraculo(req, res) {
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

  const procuracaoPath = arquivos?.procuracao?.[0]?.path;
  let nome = '', cpf = '', estadoCivil = '', profissao = '', endereco = '', aits = [];

  try {
    if (procuracaoPath && fs.existsSync(procuracaoPath)) {
      const texto = await extractText(procuracaoPath);
      nome = texto.match(/(?:Nome|NOME):?\s*([A-Z\s]{5,})/)?.[1]?.trim() || '';
      cpf = texto.match(/CPF[:\s]*([\d\.\-]{11,})/)?.[1]?.trim() || '';
      estadoCivil = texto.match(/Estado Civil:?\s*([A-Za-zçãéíõú\s]+)/i)?.[1]?.trim() || '';
      profissao = texto.match(/Profissão:?\s*([A-Za-zçãéíõú\s]+)/i)?.[1]?.trim() || '';
      endereco = texto.match(/residente e domiciliado à\s*(.*?CEP.*)/i)?.[1]?.trim() || '';
    }

    const caminhosAutuacoes = req.files
      .filter(file => file.fieldname.startsWith('autuacoes['))
      .map(file => file.path)
      .filter(fs.existsSync);

    if (caminhosAutuacoes.length > 0) {
      aits = await extrairAitsDosArquivos(caminhosAutuacoes);
    }

    const tarefa = {
      email,
      telefone,
      arquivos,
      autuacoes: autuacoes.filter(a => a.tipo && a.arquivo),
      dados: {
        'Nome Completo': nome,
        'CPF OU CNPJ': cpf,
        'Estado Civil Atual': estadoCivil,
        'Profissão': profissao,
        'Endereço Completo': endereco,
        'Email': email,
        'Número de telefone': telefone,
        'Placa': 'ABC1D23',
        'CHASSI': '123456789XYZ12345',
        'RENAVAM': '98765432109',
        'Estado de emplacamento': 'MG'
      },
      timestamp: Date.now()
    };

    addToQueue(tarefa);

    res.send({
      status: 'ok',
      mensagem: 'Formulário processado com sucesso',
      dadosExtraidos: { nome, cpf, estadoCivil, profissao, endereco, aits }
    });

  } catch (err) {
    console.error('❌ Erro no oráculo:', err.message);
    res.status(500).send({ status: 'erro', mensagem: err.message });
  }
}

module.exports = { handleOraculo };
