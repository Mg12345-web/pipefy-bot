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
    body: {
      ...tarefa,
      dados: tarefa.dados || {}
    },
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

   // ✅ Verifica tipoServico global mesmo sem autuações
  if (tarefa.tipoServico) {
    const tipo = tarefa.tipoServico;
    const ait = tarefa.dados.numeroAIT || '0000000';
    const orgao = tarefa.dados.orgaoAutuador || 'SPTRANS';

    const fakeReq = {
      files: { autuacoes: [{ path: tarefa.arquivos?.autuacao?.[0]?.path || '' }] },
      body: { ait, orgao, dados: tarefa.dados }
    };

    try {
      if (tipo === 'RGP') {
        console.log('\n📌 Executando robô de RGP (tipo global)...');
        await runRgpRobot(fakeReq, fakeRes);
        await aguardarEstabilizacao('RGP');
      } else if (tipo === 'Sem RGP') {
        console.log('\n📌 Executando robô de Sem RGP (tipo global)...');
        await runSemRgpRobot(fakeReq, fakeRes);
        await aguardarEstabilizacao('Sem RGP');
      }
    } catch (err) {
      console.error(`❌ Erro no robô de ${tipo}: ${err.message}`);
    }
  }
    } else {
      console.warn('⚠️ Nenhum arquivo de autuação encontrado para tipoServico.');
    }
  }

  // ⚖️ Autuações Individuais
  for (const autuacao of autuacoesValidas) {
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

function criarRespostaSimples() {
  return {
    setHeader: () => {},
    write: msg => console.log('[LOG]', msg),
    end: html => html && console.log('[FIM]', html)
  };
}

async function aguardarEstabilizacao(contexto) {
  console.log(`⏳ Aguardando 30 segundos após o robô de ${contexto}...`);
  await new Promise(resolve => setTimeout(resolve, 30000));
  console.log(`✅ Tempo de estabilização concluído para ${contexto}.\n`);
}

module.exports = { addToQueue, startQueue };
