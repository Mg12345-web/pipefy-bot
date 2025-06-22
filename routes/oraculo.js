const fs = require('fs');
const path = require('path');
const { extractText, interpretarTextoComGPT } = require('../utils/extractText');
const { interpretarImagemComGptVision } = require('../utils/gptVision');
const { extrairAitsDosArquivos } = require('../utils/extrairAitsDosArquivos');
const { addToQueue } = require('../robots/fila');

// ✅ Função de delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function handleOraculo(req, res) {
  const { email, telefone } = req.body;
  const servico = req.body.tipo_servico || req.body.servico || '';
  req.body.cpf = req.body.cpf || req.body.CPF || '';
  req.body.placa = req.body.placa || req.body.Placa || '';
  const tipoServicoNormalizado = servico.trim().toLowerCase();
  const arquivos = {};
  let autuacoes = [];
  let tarefa = {};

  if (!req.body.placa && req.body.dados?.Placa) {
  req.body.placa = req.body.dados.Placa;
}
    if (tipoServicoNormalizado === 'processo administrativo') {
    const numeroProcesso = req.body.numeroProcesso;
    const orgao = req.body.orgao;
    const prazo = req.body.prazo;
    const documento = req.files?.find(f => f.fieldname === 'documento');

     if (!req.body.cpf || !numeroProcesso || !orgao || !prazo || !req.body.placa || !documento) {
    return res.status(400).send({ status: 'erro', mensagem: 'Campos obrigatórios ausentes para processo administrativo' });
  }

    const idCliente = `${req.body.cpf.replace(/\D/g, '')}_${Date.now()}`;
    const pastaTemp = path.join(__dirname, '..', 'temp', idCliente);
    fs.mkdirSync(pastaTemp, { recursive: true });

      const dados = {
    CPF: req.body.cpf,
    'Número do Processo': numeroProcesso,
    'Órgão': orgao,
    'Prazo para Protocolo': prazo,
    'Placa': req.body.placa
  };

    const tarefa = {
      email,
      telefone,
      arquivos: { documento: [documento] },
      autuacoes: [],
      dados,
      tipoServico: servico,
      tempPath: pastaTemp,
      timestamp: Date.now(),
      idCliente,
      robo: 'processo_administrativo'
    };

    console.log('📤 Enviando tarefa processo administrativo:', JSON.stringify(tarefa, null, 2));
    addToQueue(tarefa);

    return res.send({
      status: 'ok',
      mensagem: 'Tarefa de processo administrativo enviada',
      dadosExtraidos: dados
    });
  }

  // Copia dados manuais
  let dados = {
  ...req.body.dados,
  CPF: req.body.cpf,
  Placa: req.body.placa
};

  console.log('📥 req.body:', JSON.stringify(req.body, null, 2));
  console.log('📎 req.files:', req.files?.map(f => f.originalname));

  // Captura autuações
  if (Array.isArray(req.body.autuacoes)) {
    autuacoes = req.body.autuacoes.map((a) => ({ ...a }));
  } else {
    Object.keys(req.body).forEach(key => {
      const match = key.match(/autuacoes\[(\d+)\]\[(.+?)\]/);
      if (match) {
        const idx = +match[1];
        const prop = match[2];
        autuacoes[idx] = autuacoes[idx] || {};
        autuacoes[idx][prop] = req.body[key];
      }
    });
  }

  autuacoes.forEach(a => {
    if (!a.tipo && servico) {
      a.tipo = servico;
    }
  });

  for (const file of req.files || []) {
    const field = file.fieldname;
    const match = field.match(/autuacoes\[(\d+)\]\[arquivo\]/);
    if (match) {
      const idx = +match[1];
      autuacoes[idx] = autuacoes[idx] || {};
      autuacoes[idx].arquivo = file.path;
    } else {
      arquivos[field] = arquivos[field] || [];
      arquivos[field].push(file);
    }
  }

  const procuracao = req.files?.find(f => f.fieldname === 'procuracao')?.path;
  const crlv = req.files?.find(f => f.fieldname === 'crlv')?.path;

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

      dados['Placa'] = (req.body.placa || req.body.Placa || dados['Placa'] || '').toUpperCase();
      dados['Chassi'] = (crlvDados.chassi || crlvDados['Chassi'] || '').toUpperCase();
      dados['Renavam'] = crlvDados.renavam || crlvDados['Renavam'] || '';
      dados['Estado de Emplacamento'] = (crlvDados.estadoEmplacamento || crlvDados['Estado de Emplacamento'] || crlvDados.estado || '').toUpperCase();
    }

    dados['Nome Completo'] = dados['Nome Completo'] || dados.nomecompleto || '';
    dados['CPF'] = dados['CPF'] || dados['CPF OU CNPJ'] || dados.cpf || '';
    dados['Estado Civil'] = dados['Estado Civil'] || dados.estado_civil || '';
    dados['Profissão'] = dados['Profissão'] || dados.profissao || '';

    if (dados.logradouro && dados.numero && dados.bairro && dados.cidade) {
      dados['Endereço Completo'] = `${dados.logradouro}, ${dados.numero} - ${dados.bairro} - ${dados.cidade}/${dados.estado || ''}`;
    }

    dados['Placa'] = dados['Placa'] || req.body.placa || req.body.Placa || '';

    const cpf = dados['CPF'];
    const placa = dados['Placa'];

    if (!cpf || !placa) {
      console.warn('⚠️ CPF ou Placa ausente. Encerrando sem enviar à fila.');
      return res.status(400).send({ status: 'erro', mensagem: 'CPF ou Placa ausente' });
    }

    const idCliente = `${req.body.cpf.replace(/\D/g, '')}_${Date.now()}`;
    const pastaTemp = path.join(__dirname, '..', 'temp', idCliente);
    fs.mkdirSync(pastaTemp, { recursive: true });

    if (autuacoes.length > 1) {
      console.log('📚 Múltiplas autuações detectadas. Gerando tarefas separadas com atraso entre elas...');

      for (let i = 0; i < autuacoes.length; i++) {
  const autuacao = autuacoes[i];
  const ultimaAutuacao = i === autuacoes.length - 1;

  const dadosAutuacao = i === 0
    ? {
        ...dados,
        AIT: autuacao.ait || '',
        'Órgão Autuador': autuacao.orgao || '',
        'Prazo para Protocolo': autuacao.prazo || '',
      }
    : {
        CPF: dados['CPF'],
        Placa: dados['Placa'],
        AIT: autuacao.ait || '',
        'Órgão Autuador': autuacao.orgao || '',
        'Prazo para Protocolo': autuacao.prazo || '',
      };

  const tarefaAutuacao = {
    email,
    telefone,
    arquivos: i === 0 ? arquivos : {},
    autuacoes: [autuacao],
    dados: dadosAutuacao,
    tipoServico: servico,
    tempPath: pastaTemp,
    timestamp: Date.now(),
    robo: i === 0 ? 'RGP' : 'Sem RGP',
    ultimaTarefa: ultimaAutuacao,
    idCliente: idCliente
  };

  console.log(`📤 Enviando tarefa ${i + 1}/${autuacoes.length}:`, JSON.stringify(tarefaAutuacao, null, 2));
  addToQueue(tarefaAutuacao);

  if (!ultimaAutuacao) {
    console.log('⏳ Aguardando 5 minutos antes da próxima tarefa...');
    await delay(5 * 60 * 1000);
  }
}
      res.send({
        status: 'ok',
        mensagem: 'Tarefas enfileiradas com espaçamento de 5 minutos',
        dadosExtraidos: { ...dados }
      });

      fs.writeFileSync('./logs/ultimo-oraculo.json', JSON.stringify({ dadosExtraidos: { ...dados, aits: autuacoes.map(a => a.ait) } }, null, 2));
      return;
    }

    // Caso tenha só uma autuação
    const autuacaoPrincipal = autuacoes[0] || {
      ait: req.body.ait,
      orgao: req.body.orgao,
      prazo: req.body.prazo
    };

    dados['AIT'] = autuacaoPrincipal.ait || '';
    dados['Órgão Autuador'] = autuacaoPrincipal.orgao || '';
    dados['Prazo para Protocolo'] = autuacaoPrincipal.prazo || '';

    tarefa = {
  email,
  telefone,
  arquivos,
  autuacoes,
  dados,
  tipoServico: servico,
  tempPath: pastaTemp,
  timestamp: Date.now(),
  idCliente
};

    const robos = [];
    if (tipoServicoNormalizado === 'rgp') robos.push('RGP');
    if (tipoServicoNormalizado === 'sem rgp') robos.push('Sem RGP');

    // Aguarda 5 minutos antes de enviar a tarefa (mesmo que seja uma só)
console.log('⏳ Aguardando 5 minutos antes de enviar tarefa única...');
await delay(5 * 60 * 1000);

if (robos.length === 0) {
  tarefa.robo = 'Sem RGP';
  console.log('🚨 Enviando tarefa manualmente com robô forçado:', tarefa.robo);
  addToQueue(tarefa);
} else {
  for (const robo of robos) {
    const tarefaFinal = { ...tarefa, robo };
    console.log('📤 Tarefa enviada ao robô:', JSON.stringify(tarefaFinal, null, 2));
    addToQueue(tarefaFinal);
  }
}

    res.send({
      status: 'ok',
      mensagem: 'Oráculo processado com sucesso',
      dadosExtraidos: { ...dados }
    });

    fs.writeFileSync('./logs/ultimo-oraculo.json', JSON.stringify({ dadosExtraidos: { ...dados, aits: autuacoes.map(a => a.ait) } }, null, 2));

  } catch (err) {
    console.error('❌ Oráculo erro:', err.message);
    res.status(500).send({ status: 'erro', mensagem: err.message });
  }
}

module.exports = { handleOraculo };
