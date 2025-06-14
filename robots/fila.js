const path = require('path');
const fs = require('fs');
const { runClientRobot } = require('./client');
const { runCrlvRobot } = require('./crlv');
const { runRgpRobot } = require('./rgp');
const { runSemRgpRobot } = require('./semrgp');

let fila = [];
let emExecucao = false;

// Adiciona uma tarefa na fila
function addToQueue(tarefa) {
  fila.push(tarefa);
  console.log(`📥 Tarefa adicionada à fila. Total na fila: ${fila.length}`);
}

// Inicia o loop que processa tarefas da fila
function startQueue() {
  setInterval(() => {
    if (emExecucao || fila.length === 0) return;

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

// Processa uma tarefa (executa os robôs)
async function processarTarefa(tarefa) {
  const fakeRes = criarRespostaSimples();

  const req = {
    query: { observacao: 'Cadastro via site' },
    body: {
      ...tarefa,
      dados: tarefa.dados || {}
    },
    files: tarefa.arquivos
  };

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

  // ⚖️ AUTUAÇÕES
  for (const autuacao of tarefa.autuacoes || []) {
    const tipo = autuacao.tipo;
    const ait = autuacao.ait || tarefa.dados.numeroAIT || '';
    const orgao = autuacao.orgao || tarefa.dados.orgaoAutuador || '';

    if (!ait || !orgao) {
      console.warn(`⚠️ Dados incompletos para autuação ${tipo}. Pulando execução.`);
      continue;
    }

    const fakeReq = {
      files: { autuacoes: [{ path: autuacao.arquivo }] },
      body: { ait, orgao, dados: tarefa.dados }
    };

    try {
      if (tipo === 'RGP') {
        console.log('\n📌 Executando robô de RGP...');
        await runRgpRobot(fakeReq, fakeRes);
        await aguardarEstabilizacao('RGP');
      } else if (tipo === 'Sem RGP') {
        console.log('\n📌 Executando robô de Sem RGP...');
        await runSemRgpRobot(fakeReq, fakeRes);
        await aguardarEstabilizacao('Sem RGP');
      } else {
        console.warn(`⚠️ Tipo desconhecido de autuação: ${tipo}`);
      }
    } catch (err) {
      console.error(`❌ Erro no robô de ${tipo}: ${err.message}`);
    }
  }

  console.log('\n✅ Tarefa finalizada.');
}

// Simula a resposta padrão do Express para logs
function criarRespostaSimples() {
  return {
    setHeader: () => {},
    write: msg => console.log('[LOG]', msg),
    end: html => html && console.log('[FIM]', html)
  };
}

// Delay entre execuções
async function aguardarEstabilizacao(contexto) {
  console.log(`⏳ Aguardando 30 segundos após o robô de ${contexto}...`);
  await new Promise(resolve => setTimeout(resolve, 30000));
  console.log(`✅ Tempo de estabilização concluído para ${contexto}.\n`);
}

module.exports = { addToQueue, startQueue };
