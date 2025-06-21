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
  setInterval(async () => {
    if (emExecucao || fila.length === 0) return;

    console.log(`⏳ Verificando fila... emExecucao: ${emExecucao} | Tarefas pendentes: ${fila.length}`);

    const tarefa = fila.shift();
    emExecucao = true;

    try {
      console.log('🚀 Iniciando tarefa da fila...');
      await processarTarefa(tarefa);
    } catch (err) {
      console.error('❌ Erro ao processar tarefa:', err.message);
    } finally {
      console.log('⏱️ Aguardando 5 minutos antes de iniciar próxima tarefa...');
      await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
      console.log('✅ Fila liberada.');
      emExecucao = false;
    }
  }, 3000);
}

async function processarTarefa(tarefa) {
  const fakeRes = criarRespostaSimples();

  const pastaDoCliente = tarefa.idCliente
    ? path.join(__dirname, '..', 'temp', tarefa.idCliente)
    : path.join(__dirname, '..', 'temp', 'geral');

  fs.mkdirSync(pastaDoCliente, { recursive: true });
  console.log('📁 Pasta do cliente isolada:', pastaDoCliente);

  const req = {
    query: { observacao: 'Cadastro via site' },
    body: tarefa,
    files: tarefa.arquivos
  };

  req.body.tempPath = pastaDoCliente;

  console.log('📤 Dados do cliente recebidos:', req.body.dados);

  try {
    console.log('\n📌 Executando robô de CLIENTES...');
    await runClientRobot(req, fakeRes);
    await aguardarEstabilizacao('CLIENTES');
  } catch (err) {
    console.error('❌ Erro no robô de CLIENTES:', err.message);
  }

  try {
    console.log('\n📌 Executando robô de CRLV...');
    await runCrlvRobot(req, fakeRes);
    await aguardarEstabilizacao('CRLV');
  } catch (err) {
    console.error('❌ Erro no robô de CRLV:', err.message);
  }

  const autuacoesValidas = (tarefa.autuacoes || []).filter(a => a.arquivo && a.tipo);
  console.log('🧾 Tipo de serviço:', tarefa.tipoServico);

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
        console.log('\n📍 Executando robô de RGP (tipo global)...');
        await runRgpRobot(fakeReq, fakeRes);
        await aguardarEstabilizacao('RGP');
      } else if (tipo === 'Sem RGP') {
        console.log('\n📍 Executando robô de Sem RGP (tipo global)...');
        await runSemRgpRobot(fakeReq, fakeRes);
        await aguardarEstabilizacao('Sem RGP');
      }
    } catch (err) {
      console.error(`❌ Erro no robô de ${tipo}: ${err.message}`);
    }
  }

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
        console.log('\n📍 Executando robô de RGP (individual)...');
        await runRgpRobot(fakeReq, fakeRes);
        await aguardarEstabilizacao('RGP');
      } else if (tipo === 'Sem RGP') {
        console.log('\n📍 Executando robô de Sem RGP (individual)...');
        await runSemRgpRobot(fakeReq, fakeRes);
        await aguardarEstabilizacao('Sem RGP');
      }
    } catch (err) {
      console.error(`❌ Erro no robô individual de ${tipo}: ${err.message}`);
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
  console.log(`⏳ Aguardando 60 segundos após o robô de ${contexto}...`);
  await new Promise(resolve => setTimeout(resolve, 60000));
  console.log(`✅ Estabilização concluída para ${contexto}.\n`);
}

module.exports = { addToQueue, startQueue };
