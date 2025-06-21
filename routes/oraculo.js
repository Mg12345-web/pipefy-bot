const fs = require('fs');
const path = require('path');
const { extractText, interpretarTextoComGPT } = require('../utils/extractText');
const { interpretarImagemComGptVision } = require('../utils/gptVision');
const { extrairAitsDosArquivos } = require('../utils/extrairAitsDosArquivos');
const { addToQueue } = require('../robots/fila');

async function handleOraculo(req, res) {
  const { email, telefone, servico } = req.body;
const tipoServicoNormalizado = (servico || '').trim().toLowerCase();
const arquivos = {};
let autuacoes = [];
let tarefa = {};

  // Copia dados manuais
  let dados = { ...req.body.dados };
  dados['Placa'] = req.body.placa || req.body.Placa;
  let aits = [];

  console.log('📥 req.body:', JSON.stringify(req.body, null, 2));
  console.log('📎 req.files:', req.files?.map(f => f.originalname));

  // Captura todos os campos de autuações (ait, orgao, tipo, prazo etc.)
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

  // 🔁 Preenche tipo com base no serviço, se estiver faltando
  autuacoes.forEach(a => {
    if (!a.tipo && servico) {
      a.tipo = servico;
    }
  });

  // 🔧 Associa corretamente os arquivos a cada autuação
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

    // 🛠️ Garante que 'Placa' esteja nos dados, mesmo se vier fora do objeto 'dados'
dados['Placa'] = dados['Placa'] || req.body.placa || req.body.Placa || '';

const cpf = dados['CPF'];
const placa = dados['Placa'];

if (!cpf || !placa) {
  console.warn('⚠️ CPF ou Placa ausente. Encerrando sem enviar à fila.');
  return res.status(400).send({ status: 'erro', mensagem: 'CPF ou Placa ausente' });
}

// 🔧 Cria pasta temporária para o cliente (evita sobreposição entre requisições)
const idCliente = `${cpf.replace(/\D/g, '')}_${Date.now()}`;
const pastaTemp = path.join(__dirname, '..', 'temp', idCliente);
fs.mkdirSync(pastaTemp, { recursive: true });

if (autuacoes.length > 1) {
  console.log('📚 Múltiplas autuações detectadas. Gerando tarefas separadas...');
  for (let i = 0; i < autuacoes.length; i++) {
    const autuacao = autuacoes[i];
    const dadosAutuacao = {
      ...dados,
      AIT: autuacao.ait || '',
      'Órgão Autuador': autuacao.orgao || '',
      'Prazo para Protocolo': autuacao.prazo || '',
    };

    const tarefaAutuacao = {
      email,
      telefone,
      arquivos: i === 0 ? arquivos : {}, // arquivos só na primeira autuação
      autuacoes: [autuacao],
      dados: dadosAutuacao,
      tipoServico: servico,
      tempPath: pastaTemp,
      timestamp: Date.now(),
      robo: i === 0 ? 'RGP' : 'Sem RGP',
    };

    console.log('📤 Tarefa enfileirada:', JSON.stringify(tarefaAutuacao, null, 2));
    addToQueue(tarefaAutuacao);
  }

  res.send({
    status: 'ok',
    mensagem: 'Tarefas separadas enfileiradas com sucesso',
    dadosExtraidos: { ...dados }
  });

  fs.writeFileSync('./logs/ultimo-oraculo.json', JSON.stringify({ dadosExtraidos: { ...dados, aits: autuacoes.map(a => a.ait) } }, null, 2));
  return;
}

// 🔁 Caso tenha apenas UMA autuação, segue o fluxo padrão
const autuacaoPrincipal = autuacoes[0] || {
  ait: req.body.ait,
  orgao: req.body.orgao,
  prazo: req.body.prazo
};

dados['AIT'] = autuacaoPrincipal.ait || '';
dados['Órgão Autuador'] = autuacaoPrincipal.orgao || '';
dados['Prazo para Protocolo'] = autuacaoPrincipal.prazo || '';

let tarefa = {
  email,
  telefone,
  arquivos,
  autuacoes,
  dados,
  tipoServico: servico,
  tempPath: pastaTemp,
  timestamp: Date.now()
};

// Identifica o robô
const tipoServicoNormalizado = (servico || '').trim().toLowerCase();
const robos = [];

if (tipoServicoNormalizado === 'rgp') robos.push('RGP');
if (tipoServicoNormalizado === 'sem rgp') robos.push('Sem RGP');

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
