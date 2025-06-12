const path = require('path');
const fs = require('fs');
const { runClientRobot } = require('./client');
const { runCrlvRobot } = require('./crlv');
const { runRgpRobot } = require('./rgp');
const { runSemRgpRobot } = require('./semrgp');

let fila = [];
let emExecucao = false;

// Função para adicionar uma tarefa na fila
function addToQueue(tarefa) {
  fila.push(tarefa);
  console.log(`📥 Tarefa adicionada à fila. Total na fila: ${fila.length}`);
}

// Função para iniciar o loop da fila
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

  }, 3000); // Executa a cada 3 segundos
}

// Função para processar cada tarefa
async function processarTarefa(tarefa) {
  const fakeRes = criarRespostaSimples();

  const req = {
    query: { observacao: 'Cadastro via site' },
    body: tarefa,
    files: tarefa.arquivos
  };

  // Robô CLIENTES
  try {
    console.log('\n📌 Executando robô de CLIENTES...');
    await runClientRobot(req, fakeRes);
    await aguardarEstabilizacao('CLIENTES');
  } catch (err) {
    console.error('❌ Erro no robô de CLIENTES:', err.message);
  }

  // Robô CRLV
  try {
    console.log('\n📌 Executando robô de CRLV...');
    await runCrlvRobot(req, fakeRes);
    await aguardarEstabilizacao('CRLV');
  } catch (err) {
    console.error('❌ Erro no robô de CRLV:', err.message);
  }

  // Robôs de Autuação (RGP ou Sem RGP)
  for (const autuacao of tarefa.autuacoes || []) {
    const tipo = autuacao.tipo;
    const fakeReq = {
      files: { autuacao: [{ path: autuacao.arquivo }] },
      body: {}
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
      console.error(`❌ Erro no robô de ${tipo}:`, err.message);
    }
  }

  console.log('\n✅ Tarefa finalizada.');
}

// Resposta simulada para logs internos
function criarRespostaSimples() {
  return {
    setHeader: () => {},
    write: (msg) => console.log('[LOG]', msg),
    end: (html) => html && console.log('[FIM]', html)
  };
}

// Delay para simular tempo de espera entre tarefas
async function aguardarEstabilizacao(contexto) {
  console.log(`⏳ Aguardando 30 segundos após o robô de ${contexto}...`);
  await delay(30000);
  console.log(`✅ Tempo de estabilização concluído para ${contexto}.\n`);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { addToQueue, startQueue };
