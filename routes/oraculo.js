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

  // 📂 Organização dos arquivos recebidos
  for (const file of req.files || []) {
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

  // 🏷️ Tipos de autuações
  Object.keys(req.body).forEach(key => {
    const m = key.match(/autuacoes\[(\d+)\]\[tipo\]/);
    if (m) {
      const idx = +m[1];
      autuacoes[idx] = autuacoes[idx] || {};
      autuacoes[idx].tipo = req.body[key];
    }
  });

  const procuracao = arquivos.procuracao?.[0]?.path;
  const crlv = arquivos.crlv?.[0]?.path;
  let dados = {}, aits = [];

  try {
    // 📄 Leitura da procuração
    if (procuracao) {
      const ext = path.extname(procuracao).toLowerCase();
      if (['.jpg', '.jpeg', '.png'].includes(ext)) {
        dados = await interpretarImagemComGptVision(procuracao, 'procuracao');
      } else {
        const texto = await extractText(procuracao);
        dados = JSON.parse(await interpretarTextoComGPT(texto, 'procuracao'));
      }
    }

    // 🧠 Dados manuais do formulário
    dados.Email = email;
    dados['Número de telefone'] = telefone;

    // 🚗 Leitura do CRLV
if (crlv) {
  const ext = path.extname(crlv).toLowerCase();
  let crlvDados = {};

  if (['.jpg', '.jpeg', '.png'].includes(ext)) {
    crlvDados = await interpretarImagemComGptVision(crlv, 'crlv');
  } else {
    const textoCR = await extractText(crlv);
    crlvDados = JSON.parse(await interpretarTextoComGPT(textoCR, 'crlv'));
  }

  console.log('🔍 Dados extraídos do CRLV:', crlvDados);

  // 🔧 Normaliza os campos com capitalização esperada pelos robôs
  dados['Placa'] = (crlvDados.placa || crlvDados['Placa'] || '').toUpperCase();
  dados['Chassi'] = (crlvDados.chassi || crlvDados['Chassi'] || '').toUpperCase();
  dados['Renavam'] = crlvDados.renavam || crlvDados['Renavam'] || '';
  dados['Estado de Emplacamento'] = (crlvDados.estadoEmplacamento || crlvDados['Estado de Emplacamento'] || '').toUpperCase();
}

// ⚠️ Autuações
const caminhosAut = autuacoes
  .filter(a => a.tipo && a.arquivo)
  .map(a => a.arquivo);

if (caminhosAut.length > 0) {
  aits = await extrairAitsDosArquivos(caminhosAut);
}

// 🔧 Compatibiliza com robô de CLIENTES
dados['Nome Completo'] = dados.nome || dados['Nome Completo'] || '';
dados['CPF OU CNPJ'] = dados.cpf || '';
dados['Estado Civil'] = dados.estado_civil || '';
dados['Profissão'] = dados.profissao || '';

// 🧾 Monta o endereço completo
if (dados.logradouro && dados.numero && dados.bairro && dados.cidade) {
  dados['Endereço'] = `${dados.logradouro}, ${dados.numero} - ${dados.bairro} - ${dados.cidade}/${dados.estado || ''}`;
}

// ✅ Verificação obrigatória dos dados
const nomeCompleto = dados['Nome Completo'];
const placa = dados['Placa'];

if (!nomeCompleto || !placa) {
  throw new Error('Dados incompletos: Nome Completo ou Placa ausentes.');
}

// ✔️ Tudo certo, adiciona na fila
tarefa = {
  email,
  telefone,
  arquivos,
  autuacoes: autuacoes.filter(a => a.tipo && a.arquivo),
  dados,
  timestamp: Date.now()
};

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
