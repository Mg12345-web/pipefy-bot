// robots/fila.js
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
    processarTarefa(tarefa).then(() => {
      emExecucao = false;
    });
  }, 3000); // verifica a cada 3s
}

async function processarTarefa(tarefa) {
  const fakeRes = criarRespostaSimples();
  const req = { query: { observacao: 'Cadastro via site' } };

  // Roda robô de cliente
  req.body = tarefa;
  req.files = tarefa.arquivos;
  await runClientRobot(req, fakeRes);

  // Roda robô de CRLV
  await runCrlvRobot(req, fakeRes);

  // Roda autuações por tipo
for (const autuacao of tarefa.autuacoes || []) {
  const fakeReq = {
    files: { autuacao: [{ path: autuacao.arquivo }] },
    body: {}
  };

  if (autuacao.tipo === 'RGP') {
    await runRgpRobot(fakeReq, fakeRes);
  } else if (autuacao.tipo === 'Sem RGP') {
    await runSemRgpRobot(fakeReq, fakeRes);
  }
}

  console.log('✅ Tarefa finalizada.');
}

function criarRespostaSimples() {
  return {
    setHeader: () => {},
    write: (msg) => console.log('[LOG]', msg),
    end: (html) => html && console.log('[FIM]', html)
  };
}

module.exports = { addToQueue, startQueue };
