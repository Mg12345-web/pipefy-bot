const fs = require('fs');
const path = require('path');
const { extractText, interpretarTextoComGPT } = require('../utils/extractText');
const { interpretarImagemComGptVision } = require('../utils/gptVision');
const { extrairAitsDosArquivos } = require('../utils/extrairAitsDosArquivos');
const { addToQueue } = require('../robots/fila');

async function handleOraculo(req, res) {
  const { email, telefone, servico } = req.body;
  const arquivos = {};
  const autuacoes = [];
  let tarefa = {};

  // Copia dados manuais
  let dados = { ...req.body.dados };
  dados['Placa'] = req.body.placa || req.body.Placa;
  let aits = [];

  console.log('📥 req.body:', JSON.stringify(req.body, null, 2));
  console.log('📎 req.files:', req.files?.map(f => f.originalname));

  for (const file of req.files || []) {
  const field = file.fieldname;

  const match = field.match(/autuacoes\[(\d+)\]/);
  if (match) {
    const idx = +match[1];
    autuacoes[idx] = autuacoes[idx] || {};
    autuacoes[idx].arquivo = file.path;
  } else {
    arquivos[field] = arquivos[field] || [];
    arquivos[field].push(file);
  }
}

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
    if (procuracao) {
      try {
        const ext = path.extname(procuracao).toLowerCase();
        if ([".jpg", ".jpeg", ".png"].includes(ext)) {
          const dadosProc = await interpretarImagemComGptVision(procuracao, 'procuracao');
          dados = { ...dados, ...dadosProc };
        } else {
          const texto = await extractText(procuracao);
          const gptResponse = await interpretarTextoComGPT(texto, 'procuracao');
          const dadosProc = JSON.parse(gptResponse);
          dados = { ...dados, ...dadosProc };
        }
      } catch (err) {
        console.warn('⚠️ Falha ao extrair dados da procuração:', err.message);
      }
    }

    dados.Email = email;
    dados['Número de telefone'] = telefone;

    if (crlv) {
      const ext = path.extname(crlv).toLowerCase();
      let crlvDados = {};

      if ([".jpg", ".jpeg", ".png"].includes(ext)) {
        crlvDados = await interpretarImagemComGptVision(crlv, 'crlv');
      } else {
        const textoCR = await extractText(crlv);
        crlvDados = JSON.parse(await interpretarTextoComGPT(textoCR, 'crlv'));
      }

      dados['Placa'] = (crlvDados.placa || crlvDados['Placa'] || dados['Placa'] || '').toUpperCase();
      dados['Chassi'] = (crlvDados.chassi || crlvDados['Chassi'] || '').toUpperCase();
      dados['Renavam'] = crlvDados.renavam || crlvDados['Renavam'] || '';
      dados['Estado de Emplacamento'] = (crlvDados.estadoEmplacamento || crlvDados['Estado de Emplacamento'] || crlvDados.estado || '').toUpperCase();
    }

    dados['Nome Completo'] = dados['Nome Completo'] || dados.nome || '';
    dados['CPF'] = dados['CPF'] || dados['CPF OU CNPJ'] || dados.cpf || '';
    dados['Estado Civil'] = dados['Estado Civil'] || dados.estado_civil || '';
    dados['Profissão'] = dados['Profissão'] || dados.profissao || '';

    if (dados.logradouro && dados.numero && dados.bairro && dados.cidade) {
      dados['Endereço Completo'] = `${dados.logradouro}, ${dados.numero} - ${dados.bairro} - ${dados.cidade}/${dados.estado || ''}`;
    }

    const cpf = dados['CPF'];
    const placa = dados['Placa'];

    if (!cpf || !placa) {
      throw new Error('Dados incompletos: CPF ou Placa ausentes.');
    }

        // Não precisa extrair AITs para RGP/Sem RGP, mas deixamos o campo preparado
console.log('🔍 Autuações filtradas:', autuacoes.filter(a => a.tipo && a.arquivo));

tarefa = {
      email,
      telefone,
      arquivos,
      autuacoes: autuacoes.filter(a => a.tipo && a.arquivo),
      dados,
       tipoServico: servico,
      timestamp: Date.now()
    };

    // Ativação condicional dos robôs com base no tipo de serviço
    const robos = [];
    const tipoServico = tarefa.tipoServico;
    if (tipoServico === 'RGP') robos.push('RGP');
    if (tipoServico === 'Sem RGP') robos.push('Sem RGP');
    
    for (const robo of robos) {
  const tarefaFinal = { ...tarefa, robo };
  console.log('📤 Tarefa enviada ao robô:', JSON.stringify(tarefaFinal, null, 2));
  addToQueue(tarefaFinal);
}

    res.send({
      status: 'ok',
      mensagem: 'Oráculo processado com sucesso',
      dadosExtraidos: { ...dados }
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
