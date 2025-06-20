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
  if (tarefa.dados) {
    const dadosNormalizados = {};
    for (const chave in tarefa.dados) {
      dadosNormalizados[chave.toLowerCase()] = tarefa.dados[chave];
    }
    // Ajusta campos derivados
    const camposPrazo = [
  'prazo para protocolo',
  'prazoprotocolo',
  'prazo_protocolo',
  'prazo'
];

for (const nome of camposPrazo) {
  if (dadosNormalizados[nome]) {
    const prazoValor = dadosNormalizados[nome];
    dadosNormalizados.prazo = prazoValor;
    dadosNormalizados.prazoProtocolo = prazoValor;
    dadosNormalizados.prazo_protocolo = prazoValor;
    break;
  }
}
    tarefa.dados = dadosNormalizados;
  }

  if (!tarefa.tipoServico && tarefa.robo) {
    tarefa.tipoServico = tarefa.robo;
  }

  const fakeRes = criarRespostaSimples();

  const req = {
    query: { observacao: 'Cadastro via site' },
    body: tarefa,
    files: tarefa.arquivos
  };

  console.log('📤 Dados do cliente recebidos:', req.body.dados);

  const cpfBruto = tarefa.dados?.cpf || tarefa.dados?.["cpf"];
const placaBruta = tarefa.dados?.placa || tarefa.dados?.["placa"];

const cpfBruto = tarefa.dados?.cpf || tarefa.dados?.["cpf"] || tarefa.dados?.["CPF"];
const placaBruta = tarefa.dados?.placa || tarefa.dados?.["placa"] || tarefa.dados?.["Placa"];

const cpf = cpfBruto ? cpfBruto.replace(/\D/g, '') : '';
const placa = placaBruta ? placaBruta.replace(/[^A-Z0-9]/gi, '').toUpperCase() : '';

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

  try {
    if (!placa) {
      console.warn(`⚠️ Nenhuma placa informada. Pulando CRLV.`);
    } else if (!placasProcessadas.has(placa)) {
      console.log('\n📌 Executando robô de CRLV...');
      await runCrlvRobot(req, fakeRes);
      await aguardarEstabilizacao('CRLV');
      placasProcessadas.add(placa);
    } else {
      console.log(`⏭️ Placa ${placa} já foi processada. Pulando CRLV.`);
    }
  } catch (err) {
    console.error('❌ Erro no robô de CRLV:', err.message);
  }

  const tipoOriginal = tarefa.tipoServico?.toLowerCase().trim();
  const tipo = tipoOriginal === 'semrgp' ? 'sem rgp' : tipoOriginal;

  const autuacao = tarefa.autuacoes?.[0];
  const ait = autuacao?.ait || tarefa.dados.numeroait || '0000000';
  const orgao = autuacao?.orgao || tarefa.dados.orgaoautuador || 'SPTRANS';

  if (!autuacao?.arquivo) {
    console.warn(`⚠️ Nenhum arquivo encontrado para a autuação. Pulando execução do robô ${tipo?.toUpperCase()}.`);
    return;
  }

  const fakeReq = {
    files: {
      autuacoes: [{ path: autuacao.arquivo }]
    },
    body: { ait, orgao, dados: tarefa.dados }
  };

  try {
    if (tipo === 'rgp') {
      console.log('\n📌 Executando robô de RGP...');
      await runRgpRobot(fakeReq, fakeRes);
      await aguardarEstabilizacao('RGP');
    } else if (tipo === 'sem rgp') {
      console.log('\n📌 Executando robô de Sem RGP...');
      await runSemRgpRobot(fakeReq, fakeRes);
      await aguardarEstabilizacao('Sem RGP');
    } else {
      console.warn(`⚠️ Tipo de serviço '${tipo}' não reconhecido. Nenhum robô executado.`);
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
