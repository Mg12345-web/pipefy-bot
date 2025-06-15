// oraculo.js
const fs = require('fs');
const path = require('path');
const { extractText, interpretarTextoComGPT } = require('../utils/extractText');
const { interpretarImagemComGptVision } = require('../utils/gptVision');
const { extrairAitsDosArquivos } = require('../utils/extrairAitsDosArquivos');
const { addToQueue } = require('../robots/fila');

async function handleOraculo(req, res) {
  const { email, telefone, tipoServico } = req.body;
  const arquivos = {};
  const autuacoes = [];
  let tarefa = {};
  let dados = {}, aits = [];

  console.log('📥 req.body:', JSON.stringify(req.body, null, 2));
  console.log('📎 req.files:', req.files?.map(f => f.originalname));

  // Organiza arquivos por campo
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

  // Lê tipos de autuações
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

  try {
    // 🧾 Processar procuração
    if (procuracao) {
  try {
    const ext = path.extname(procuracao).toLowerCase();
    if ([".jpg", ".jpeg", ".png"].includes(ext)) {
      console.log('🧠 Interpretando imagem da procuração com GPT Vision...');
      dados = await interpretarImagemComGptVision(procuracao, 'procuracao');
    } else {
      console.log('📄 Interpretando texto da procuração (PDF ou similar)...');
      const texto = await extractText(procuracao);
      console.log('📝 Texto extraído:', texto);
      const gptResponse = await interpretarTextoComGPT(texto, 'procuracao');
      console.log('🔍 Resposta do GPT:', gptResponse);
      dados = JSON.parse(gptResponse);
    }
  } catch (err) {
    console.warn('⚠️ Falha ao extrair dados da procuração:', err.message);
  }
}
    // Dados vindos do frontend
    dados.Email = email;
    dados['Número de telefone'] = telefone;

    // 🚗 Processar CRLV
    if (crlv) {
      const ext = path.extname(crlv).toLowerCase();
      let crlvDados = {};

      if ([".jpg", ".jpeg", ".png"].includes(ext)) {
        crlvDados = await interpretarImagemComGptVision(crlv, 'crlv');
      } else {
        const textoCR = await extractText(crlv);
        console.log('📝 Texto extraído do CRLV:', textoCR);
        crlvDados = JSON.parse(await interpretarTextoComGPT(textoCR, 'crlv'));
      }

      if (Object.keys(crlvDados).length === 0) {
        console.warn('⚠️ CRLV retornou vazio. Verifique a imagem ou prompt.');
      }

      console.log('🔍 Dados extraídos do CRLV:', crlvDados);

      dados['Placa'] = (crlvDados.placa || crlvDados['Placa'] || '').toUpperCase();
      dados['Chassi'] = (crlvDados.chassi || crlvDados['Chassi'] || '').toUpperCase();
      dados['Renavam'] = crlvDados.renavam || crlvDados['Renavam'] || '';
      dados['Estado de Emplacamento'] = (
        crlvDados.estadoEmplacamento ||
        crlvDados['Estado de Emplacamento'] ||
        crlvDados.estado || ''
      ).toUpperCase();
    }

    // 📄 Processar autuações
    const caminhosAut = autuacoes.filter(a => a.tipo && a.arquivo).map(a => a.arquivo);
    if (caminhosAut.length > 0) {
      aits = await extrairAitsDosArquivos(caminhosAut);
    }

    // 🧠 Normalizar e completar dados
    dados['Nome Completo'] = dados['Nome Completo'] || dados.nome || '';
    dados['CPF OU CNPJ'] = dados['CPF OU CNPJ'] || dados.cpf || '';
    dados['Estado Civil'] = dados['Estado Civil'] || dados.estado_civil || '';
    dados['Profissão'] = dados['Profissão'] || dados.profissao || '';

    if (dados.logradouro && dados.numero && dados.bairro && dados.cidade) {
      dados['Endereço Completo'] = `${dados.logradouro}, ${dados.numero} - ${dados.bairro} - ${dados.cidade}/${dados.estado || ''}`;
  }

    // Validação crítica
    if (!dados['Nome Completo'] || !dados['Placa']) {
      throw new Error('Dados incompletos: Nome Completo ou Placa ausentes.');
    }

    // 🧾 Montar tarefa
    tarefa = {
      email,
      telefone,
      arquivos,
      autuacoes: autuacoes.filter(a => a.tipo && a.arquivo),
      dados,
      tipoServico,
      timestamp: Date.now()
    };

    // Adicionar à fila
    addToQueue(tarefa);

    // Retorno final
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
