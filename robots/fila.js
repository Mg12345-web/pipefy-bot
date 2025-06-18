const path = require('path');
const fs = require('fs');
const { runClientRobot } = require('./client');
const { runCrlvRobot } = require('./crlv');
const { runRgpRobot } = require('./rgp');
const { runSemRgpRobot } = require('./semrgp');

let fila = [];
let emExecucao = false;

function addToQueue(tarefa) {
  console.log('📦 Tarefa recebida no addToQueue:', JSON.stringify(tarefa, null, 2));
  fila.push(tarefa);
  if (tarefa.tipoServico)
    console.log(`📥 Tarefa adicionada à fila. Total na fila: ${fila.length}`);
}

function startQueue() {
  setInterval(() => {
  if (emExecucao || fila.length === 0) return;

  console.log(`⏳ Verificando fila... emExecucao: ${emExecucao} | Tarefas pendentes: ${fila.length}`);

  const tarefa = fila.shift();
  emExecucao = true;

  console.log('🚀 Iniciando tarefa da fila...');
  processarTarefa(tarefa)
    .catch(err => console.error('❌ Erro ao processar tarefa:', err))
    .finally(() => {
      emExecucao = false;
    });
}, 3000);
}

async function processarTarefa(tarefa) {
  const fakeRes = criarRespostaSimples();

  const req = {
    query: { observacao: 'Cadastro via site' },
    body: tarefa,
    files: tarefa.arquivos
  };

  console.log('📤 Dados do cliente recebidos:', req.body.dados);

  // 🧠 CLIENTES
  try {
    console.log('\n📌 Executando robô de CLIENTES...');
    await runClientRobot(req, fakeRes);
    await aguardarEstabilizacao('CLIENTES');
  } catch (err) {
    console.error('❌ Erro no robô de CLIENTES:', err.message);
  }

  // 🚗 CRLV
  try {
    console.log('\n📌 Executando robô de CRLV...');
    await runCrlvRobot(req, fakeRes);
    await aguardarEstabilizacao('CRLV');
  } catch (err) {
    console.error('❌ Erro no robô de CRLV:', err.message);
  }

  // 🔄 Normaliza autuações
  const autuacoesValidas = (tarefa.autuacoes || []).filter(a => a.arquivo && a.tipo);

  // ✅ Log do tipo de serviço para debug
  console.log('🧾 Tipo de serviço:', tarefa.tipoServico);

   // RGP ou Sem RGP baseado em tipoServico
  if (tarefa.tipoServico) {
    const tipo = tarefa.tipoServico;
const ait = tarefa.dados.numeroAIT || '0000000';
const orgao = tarefa.dados.orgaoAutuador || 'SPTRANS';

const fakeReq = {
  files: {
    autuacoes: (tarefa.autuacoes || []).map(a => ({ path: a.arquivo }))
  },
  body: {
    ait,
    orgao,
    autuacoes: tarefa.autuacoes,
    dados: tarefa.dados
  }
};

    try {
      if (tipo === 'RGP') {
        console.log('\n\u{1F4CC} Executando rob\u00f4 de RGP (tipo global)...');
        await runRgpRobot(fakeReq, fakeRes);
        await aguardarEstabilizacao('RGP');
      } else if (tipo === 'Sem RGP') {
        console.log('\n\u{1F4CC} Executando rob\u00f4 de Sem RGP (tipo global)...');
        await runSemRgpRobot(fakeReq, fakeRes);
        await aguardarEstabilizacao('Sem RGP');
      }
    } catch (err) {
      console.error(`\u274C Erro no rob\u00f4 de ${tipo}: ${err.message}`);
    }
  }

  // Autua\u00e7\u00f5es individuais
  const autuacoesFiltradas = (tarefa.autuacoes || []).filter(a => a.arquivo && a.tipo);
  for (const autuacao of autuacoesValidas) {
    const tipo = autuacao.tipo;
    const ait = autuacao.ait || tarefa.dados.numeroAIT || '';
    const orgao = autuacao.orgao || tarefa.dados.orgaoAutuador || '';

    if (!ait || !orgao) {
      console.warn(`\u26A0\uFE0F Dados incompletos para autua\u00e7\u00e3o ${tipo}. Pulando execu\u00e7\u00e3o.`);
      continue;
    }

    const fakeReq = {
      files: { autuacoes: [{ path: autuacao.arquivo }] },
      body: { ait, orgao, dados: tarefa.dados }
    };

    try {
      if (tipo === 'RGP') {
        console.log('\n\u{1F4CC} Executando rob\u00f4 de RGP (individual)...');
        await runRgpRobot(fakeReq, fakeRes);
        await aguardarEstabilizacao('RGP');
      } else if (tipo === 'Sem RGP') {
        console.log('\n\u{1F4CC} Executando rob\u00f4 de Sem RGP (individual)...');
        await runSemRgpRobot(fakeReq, fakeRes);
        await aguardarEstabilizacao('Sem RGP');
      }
    } catch (err) {
      console.error(`\u274C Erro no rob\u00f4 individual de ${tipo}: ${err.message}`);
    }
  }

  console.log('\n\u2705 Tarefa finalizada.');
}

function criarRespostaSimples() {
  return {
    setHeader: () => {},
    write: msg => console.log('[LOG]', msg),
    end: html => html && console.log('[FIM]', html)
  };
}

async function aguardarEstabilizacao(contexto) {
  console.log(`\u23F3 Aguardando 60 segundos ap\u00f3s o rob\u00f4 de ${contexto}...`);
  await new Promise(resolve => setTimeout(resolve, 60000));
  console.log(`\u2705 Tempo de estabiliza\u00e7\u00e3o conclu\u00eddo para ${contexto}.\n`);
}

module.exports = { addToQueue, startQueue };
