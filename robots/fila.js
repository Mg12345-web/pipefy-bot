// queue.js
const path = require('path');
const fs = require('fs');
const { runClientRobot } = require('./client');
const { runCrlvRobot } = require('./crlv');
const { runRgpRobot } = require('./rgp');
const { runSemRgpRobot } = require('./semrgp');
const { runProcessoAdministrativoRobot } = require('./processoAdministrativo');

let fila = [];
let emExecucao = false;

/* ==================== Fila ==================== */
function addToQueue(tarefa) {
  console.log('📦 Tarefa recebida no addToQueue:', JSON.stringify(tarefa, null, 2));
  fila.push(tarefa);
  if (tarefa.tipoServico)
    console.log(`📥 Tarefa adicionada à fila. Total na fila: ${fila.length}`);

  // dispara o processamento se estiver ocioso
  if (!emExecucao) processQueue();
}

function startQueue() {
  // dispara o worker se houver tarefas e não estiver rodando
  if (!emExecucao && fila.length > 0) processQueue();
}

async function processQueue() {
  if (emExecucao) return; // já está processando
  emExecucao = true;

  try {
    while (fila.length > 0) {
      console.log(`⏳ Processando fila... Tarefas pendentes: ${fila.length}`);
      const tarefa = fila.shift(); // FIFO garantido
      try {
        console.log('🚀 Iniciando tarefa...');
        const tipo = (tarefa.tipoServico || '').trim().toLowerCase();

        // mesmo comportamento anterior de espera para Processo Administrativo
        if (tipo === 'processo administrativo') {
          console.log('⏳ Aguardando 5 minutos antes de iniciar Processo Administrativo...');
          await new Promise(r => setTimeout(r, 5 * 60 * 1000));
        }

        await processarTarefa(tarefa);
      } catch (err) {
        console.error('❌ Erro ao processar tarefa:', err?.message || err);
      } finally {
        console.log('⏱️ Aguardando 5 minutos antes de iniciar próxima tarefa...');
        await new Promise(r => setTimeout(r, 5 * 60 * 1000));
        console.log('✅ Pronto para a próxima da fila.');
      }
    }
  } finally {
    emExecucao = false;
  }
}

/* ============== Processamento da tarefa ============== */
async function processarTarefa(tarefa) {
  const fakeRes = criarRespostaSimples();

  const pastaDoCliente = path.join(__dirname, '..', 'temp', `tarefa_${Date.now()}`);
  fs.mkdirSync(pastaDoCliente, { recursive: true });
  console.log('📁 Pasta temporária criada para a tarefa:', pastaDoCliente);

  // Copiar os arquivos de autuação para a pasta da tarefa
  if (tarefa.autuacoes && tarefa.autuacoes.length) {
    for (const autuacao of tarefa.autuacoes) {
      const origem = autuacao.arquivo;
      const destino = path.join(pastaDoCliente, path.basename(origem || ''));
      try {
        fs.copyFileSync(origem, destino);
        autuacao.arquivo = destino;
      } catch (e) {
        console.warn(`⚠️ Erro ao copiar arquivo de autuação: ${origem} → ${destino}`, e.message);
      }
    }
  }

  // (removido mkdirSync duplicado)

  const req = {
    query: { observacao: 'Cadastro via site' },
    body: tarefa,
    files: tarefa.arquivos || {}
  };

  req.body.tempPath = pastaDoCliente;

  console.log('📤 Dados do cliente recebidos:', req.body.dados || {});

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
    const tipo = (tarefa.tipoServico || '').trim().toLowerCase();
    const ait = tarefa.dados?.numeroAIT || '0000000';
    const orgao = tarefa.dados?.orgaoAutuador || 'SPTRANS';

    if (tipo === 'processo administrativo') {
      console.log('\n📍 Executando robô de Processo Administrativo...');

      // Ajustar req.body com os dados corretos
      req.body.cpf = tarefa.dados?.CPF;
      req.body.numeroProcesso = tarefa.dados?.['Número do Processo'];
      req.body.orgao = tarefa.dados?.['Órgão'];
      req.body.prazo = tarefa.dados?.['Prazo para Protocolo'];
      req.body.documento = tarefa.arquivos?.documento?.[0];

      try {
        await runProcessoAdministrativoRobot(req, fakeRes);
        await aguardarEstabilizacao('Processo Administrativo');
      } catch (err) {
        console.error('❌ Erro no robô de Processo Administrativo:', err.message);
      }
      return; // Encerra aqui, pois processo administrativo é único
    }

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
      if (tipo === 'rgp') {
        console.log('\n📍 Executando robô de RGP (tipo global)...');
        await runRgpRobot(fakeReq, fakeRes);
        await aguardarEstabilizacao('RGP');
      } else if (tipo === 'sem rgp') {
        console.log('\n📍 Executando robô de Sem RGP (tipo global)...');
        await runSemRgpRobot(fakeReq, fakeRes);
        await aguardarEstabilizacao('Sem RGP');
      }
    } catch (err) {
      console.error(`❌ Erro no robô de ${tipo}: ${err.message}`);
    }
  }

  for (const autuacao of autuacoesValidas) {
    const tipo = (autuacao.tipo || '').trim().toLowerCase();
    const ait = autuacao.ait || tarefa.dados?.numeroAIT || '';
    const orgao = autuacao.orgao || tarefa.dados?.orgaoAutuador || '';

    if (!ait || !orgao) {
      console.warn(`⚠️ Dados incompletos para autuação ${autuacao.tipo}. Pulando execução.`);
      continue;
    }

    const fakeReq = {
      files: { autuacoes: [{ path: autuacao.arquivo }] },
      body: { ait, orgao, dados: tarefa.dados || {} }
    };

    try {
      if (tipo === 'rgp') {
        console.log('\n📍 Executando robô de RGP (individual)...');
        await runRgpRobot(fakeReq, fakeRes);
        await aguardarEstabilizacao('RGP');
      } else if (tipo === 'sem rgp') {
        console.log('\n📍 Executando robô de Sem RGP (individual)...');
        await runSemRgpRobot(fakeReq, fakeRes);
        await aguardarEstabilizacao('Sem RGP');
      }
    } catch (err) {
      console.error(`❌ Erro no robô individual de ${autuacao.tipo}: ${err.message}`);
    }
  }

  console.log('\n✅ Tarefa finalizada.');
}

/* ============== Utilitários comuns ============== */
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
