const path = require('path');
const fs = require('fs');
const { runClientRobot } = require('./client');
const { runCrlvRobot } = require('./crlv');
const { runRgpRobot } = require('./rgp');
const { runSemRgpRobot } = require('./semrgp');

let fila = [];
let emExecucao = false;
const clientesProcessados = new Set();
const placasProcessadas = new Set();

function addToQueue(tarefa) {
  console.log('📦 Tarefa recebida no addToQueue:', JSON.stringify(tarefa, null, 2));

  const autuacoesValidas = (tarefa.autuacoes || []).filter(a => a.arquivo && a.tipo);

  if (autuacoesValidas.length > 1) {
    console.log(`📑 Dividindo em ${autuacoesValidas.length} tarefas individuais...`);
    autuacoesValidas.forEach(autuacao => {
      const tarefaIndividual = {
        ...tarefa,
        autuacoes: [autuacao],
        tipoServico: autuacao.tipo
      };
      fila.push(tarefaIndividual);
    });
  } else {
    fila.push(tarefa);
  }

  console.log(`📥 Tarefa(s) adicionada(s) à fila. Total agora: ${fila.length}`);
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

  const cpf = tarefa.dados?.cpf?.replace(/\D/g, '');
  const placa = tarefa.dados?.placa?.replace(/[^A-Z0-9]/gi, '').toUpperCase();

  if (cpf && !clientesProcessados.has(cpf)) {
    try {
      console.log('\n📌 Executando robô de CLIENTES...');
      await runClientRobot(req, fakeRes);
      await aguardarEstabilizacao('CLIENTES');
    } catch (err) {
      console.error('❌ Erro no robô de CLIENTES:', err.message);
    }

    clientesProcessados.add(cpf);
  } else {
    console.log(`⏭️ Cliente ${cpf || 'desconhecido'} já foi processado. Pulando CLIENTES.`);
  }

  if (!placa) {
  console.warn(`⚠️ Nenhuma placa informada. Pulando CRLV.`);
} else if (!placasProcessadas.has(placa)) {
  try {
    console.log('\\n📌 Executando robô de CRLV...');
    await runCrlvRobot(req, fakeRes);
    await aguardarEstabilizacao('CRLV');
  } catch (err) {
    console.error('❌ Erro no robô de CRLV:', err.message);
  }
  placasProcessadas.add(placa);
} else {
  console.log(`⏭️ Placa ${placa} já foi processada. Pulando CRLV.`);
}

  const tipo = tarefa.tipoServico;
  const autuacao = tarefa.autuacoes?.[0];
  const ait = autuacao?.ait || tarefa.dados.numeroAIT || '0000000';
  const orgao = autuacao?.orgao || tarefa.dados.orgaoAutuador || 'SPTRANS';

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
    }
  } catch (err) {
    console.error(`❌ Erro no robô de ${tipo}: ${err.message}`);
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
  await new Promise(resolve => setTimeout(resolve, 30000));
  console.log(`✅ Tempo de estabilização concluído para ${contexto}.\n`);
}

module.exports = { addToQueue, startQueue };
