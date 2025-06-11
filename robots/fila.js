const path = require('path');
const fs = require('fs');
const { runClientRobot } = require('./client');
const { runCrlvRobot } = require('./crlv');
const { runRgpRobot } = require('./rgp');
const { runSemRgpRobot } = require('./semrgp');

let fila = [];
let emExecucao = false;

function addToQueue(tarefa) {
  fila.push(tarefa);
  console.log(`📥 Tarefa adicionada à fila. Total na fila: ${fila.length}`);
}

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

async function processarTarefa(tarefa) {
  const fakeRes = criarRespostaSimples();
  const req = {
    query: { observacao: 'Cadastro via site' },
    body: tarefa,
    files: tarefa.arquivos
  };

  // ✅ CLIENTE
  try {
    console.log('\n📌 Executando robô de CLIENTES...');
    await runClientRobot(req, fakeRes);
  } catch (err) {
    console.error('❌ Erro no robô de CLIENTES:', err.message);
  }

  // ✅ CRLV
  try {
    console.log('\n📌 Executando robô de CRLV...');
    await runCrlvRobot(req, fakeRes);
  } catch (err) {
    console.error('❌ Erro no robô de CRLV:', err.message);
  }

  // ✅ AUTUAÇÕES
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
      } else if (tipo === 'Sem RGP') {
        console.log('\n📌 Executando robô de Sem RGP...');
        await runSemRgpRobot(fakeReq, fakeRes);
      } else {
        console.warn(`⚠️ Tipo desconhecido de autuação: ${tipo}`);
      }
    } catch (err) {
      console.error(`❌ Erro no robô de ${tipo}:`, err.message);
    }
  }

  console.log('\n✅ Tarefa finalizada.');
}

function criarRespostaSimples() {
  return {
    setHeader: () => {},
    write: (msg) => console.log('[LOG]', msg),
    end: (html) => html && console.log('[FIM]', html)
  };
}

module.exports = { addToQueue, startQueue };
