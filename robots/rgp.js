const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { acquireLock, releaseLock } = require('../utils/lock');
const { loginPipefy } = require('../utils/auth');
const { normalizarArquivo } = require('../utils/normalizarArquivo');

async function runRgpRobot(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.write('<pre>⏳ Preparando robô RGP...\n');
  console.log('📥 Dados recebidos pelo robô RGP:', JSON.stringify(req.body, null, 2));

  const log = msg => { res.write(msg + '\n'); console.log(msg); };
  if (!acquireLock()) {
    log('⛔ Robô já está em execução.');
    return res.end('</pre>');
  }

  let arquivos = [];
  if (req.files?.autuacoes?.length) {
    arquivos = req.files.autuacoes.map(f => f.path);
  }

  if (!arquivos.length && Array.isArray(req.body?.autuacoes)) {
    arquivos = req.body.autuacoes
      .map(a => (typeof a.arquivo === 'object' && a.arquivo?.path) ? a.arquivo.path : a.arquivo)
      .filter(Boolean);
  }

  const { dados = {}, autuacoes = [] } = req.body;
  console.log('📦 Conteúdo de autuacoes:', autuacoes);
  const cpf = dados['CPF'] || '';
  const placa = dados['Placa'] || req.body.placa || '';
  autuacoes[0] = {
    ait: req.body.ait || dados['AIT'] || '',
    orgao: req.body.orgao || dados['Órgão Autuador'] || '',
    prazo: dados['Prazo para Protocolo'] || '',
    arquivo: arquivos[0] || ''
  };

  const ait = autuacoes[0].ait;
  const orgao = autuacoes[0].orgao;
  const prazo = autuacoes[0].prazo;

  log(`📄 Dados extraídos: AIT=${ait} | Órgão=${orgao} | Prazo=${prazo}`);

  if (!arquivos.length) {
    log('❌ Nenhum arquivo de autuação recebido.');
    releaseLock();
    return res.end('</pre>');
  }

  log(`🔍 Buscando cliente com CPF: ${cpf}`);
  log(`🔍 Buscando CRLV com Placa: ${placa}`);

  const caminhoPDF = normalizarArquivo('autuacao', arquivos[0]); 
  let browser, page;

  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext();
    page = await context.newPage();

    await loginPipefy(page, log);

    log('📂 Acessando Pipe RGP...');
    await page.getByText('RGP', { exact: true }).click();
    await page.waitForTimeout(10000);

    const botaoPipe = page.locator('text=Entrar no pipe');
    if (await botaoPipe.count() > 0) {
      await botaoPipe.first().click();
      await page.waitForTimeout(10000);
    }

    await abrirNovoCardPreCadastro(page, log);
    await selecionarCliente(page, cpf, log);
    await selecionarCRLV(page, placa, log);
    await preencherAIT(page, ait, log);
    await preencherOrgao(page, orgao, log);
    await preencherPrazoParaProtocoloComTeclado(page, prazo, log);
    await anexarAutuacao(page, caminhoPDF, log);

    log('🚀 Finalizando card...');
    const botoesFinal = await page.locator('button:has-text("Create new card")');
    for (let i = 0; i < await botoesFinal.count(); i++) {
      const b = botoesFinal.nth(i);
      const box = await b.boundingBox();
      if (box && box.width > 200) {
        await b.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await b.click();
        break;
      }
    }

    const printPath = path.resolve(__dirname, '../../prints/print_final_rgp.png');
    fs.mkdirSync(path.dirname(printPath), { recursive: true });
    await page.screenshot({ path: printPath });

    log(`📸 Print final salvo: ${path.basename(printPath)}`);
    await browser.close();

    const img = fs.readFileSync(printPath).toString('base64');
    res.write(`<img src="data:image/png;base64,${img}" style="max-width:100%">`);
    res.end('</pre><h3>✅ Processo RGP concluído com sucesso</h3><p><a href="/">⬅️ Voltar</a></p>');

  } catch (err) {
    log(`❌ Erro crítico: ${err.message}`);
    if (page) {
      const erroPath = path.resolve(__dirname, '../../prints/print_erro_debug.jpg');
      fs.mkdirSync(path.dirname(erroPath), { recursive: true });
      await page.screenshot({ path: erroPath });
      const img = fs.readFileSync(erroPath).toString('base64');
      res.write(`<img src="data:image/jpeg;base64,${img}" style="max-width:100%">`);
    }
    if (browser) await browser.close();
    res.end('</pre><h3 style="color:red">❌ Erro no robô RGP.</h3>');
  } finally {
    try {
      if (req.body?.ultimaTarefa && fs.existsSync(caminhoPDF)) {
        fs.unlinkSync(caminhoPDF);
        console.log('🧹 Arquivo da autuação apagado com sucesso.');
      }
    } catch (e) {
      console.warn('⚠️ Falha ao apagar o arquivo da autuação:', e.message);
    }

    releaseLock();
  }
}

// Funções auxiliares

async function abrirNovoCardPreCadastro(page, log = console.log) {
  log('📂 Abrindo novo card em "Pré-cadastro"...');

  const botaoNovoCard = page
    .getByTestId('phase-328258629-container')
    .getByTestId('new-card-button');

  await botaoNovoCard.waitFor({ state: 'visible', timeout: 20000 });
  await botaoNovoCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await botaoNovoCard.click();

  log('✅ Novo card criado com sucesso.');
}

async function selecionarCliente(page, cpf, log = console.log) {
  log('👤 Acessando seção de clientes...');
  await page.getByLabel('* Clientes').click({ force: true });
  await page.getByTestId('star-form-connection-button').first().click();
  await page.getByRole('combobox', { name: 'Pesquisar' }).fill(cpf);
  await page.waitForTimeout(10000);

  const card = page
    .locator('div[data-testid^="connected-card-box"]')
    .filter({ hasText: cpf })
    .first();

  await card.waitFor({ state: 'visible', timeout: 15000 });
  await card.click({ force: true });
  await page.getByText('Clientes').click();
  log(`✅ Cliente ${cpf} selecionado com sucesso`);
}

async function selecionarCRLV(page, placa, log = console.log) {
  log('🚗 Selecionando CRLV...');
  await page.getByText('Veículo (CRLV)').click();
  await page.getByTestId('star-form-connection-button').nth(1).click();
  await page.getByRole('combobox', { name: 'Pesquisar' }).fill(placa);
  await page.waitForTimeout(10000);

  const card = page
    .locator('div[data-testid^="connected-card-box"]')
    .filter({ hasText: placa })
    .first();

  await card.waitFor({ state: 'visible', timeout: 15000 });
  await card.click({ force: true });
  await page.getByText('Veículo (CRLV)').click();
  log(`✅ CRLV da placa ${placa} selecionado com sucesso`);
}

async function preencherAIT(page, ait, log = console.log) {
  if (!ait) {
    log('⚠️ Nenhum número de AIT fornecido. Pulando etapa.');
    return;
  }

  log('📝 Preenchendo campo AIT...');
  await page.getByTestId('phase-fields').getByText('AIT').click();
  const inputAIT = page.getByRole('textbox', { name: 'AIT' });
  await inputAIT.click();
  await inputAIT.fill(ait);
  log(`✅ AIT preenchido: ${ait}`);
}

async function preencherOrgao(page, orgao, log = console.log) {
  if (!orgao) {
    log('⚠️ Nenhum órgão fornecido. Pulando etapa.');
    return;
  }

  log('🏛️ Preenchendo campo Órgão...');
  await page.getByTestId('phase-fields').getByText('Órgão').click();
  await page.getByRole('textbox', { name: 'Órgão' }).fill(orgao);
  log(`✅ Órgão preenchido: ${orgao}`);
}

async function preencherPrazoParaProtocoloComTeclado(page, prazo, log = console.log) {
  log('🗓️ Preenchendo "Prazo para Protocolo"...');
  const campos = [
    '[data-testid="day-input"]',
    '[data-testid="month-input"]',
    '[data-testid="year-input"]',
    '[data-testid="hour-input"]',
    '[data-testid="minute-input"]'
  ];

  let valores = ['01', '01', '2025', '00', '00'];
  try {
    const dt = new Date(prazo);
    if (!isNaN(dt)) {
      valores = [
        String(dt.getDate()).padStart(2, '0'),
        String(dt.getMonth() + 1).padStart(2, '0'),
        String(dt.getFullYear()),
        '00',
        '00'
      ];
    }
  } catch (err) {
    log('⚠️ Erro ao interpretar data. Usando padrão.');
  }

  for (let i = 0; i < campos.length; i++) {
    const el = await page.locator(campos[i]).first();
    await el.waitFor({ state: 'visible', timeout: 5000 });
    await el.click();
    await page.keyboard.type(valores[i], { delay: 100 });
  }

  log(`✅ Prazo preenchido: ${valores.slice(0, 3).join('/')} às ${valores[3]}:${valores[4]}`);
}

async function anexarAutuacao(page, caminhoPDF, log = console.log) {
  log('📎 Anexando arquivo da autuação...');
  const botaoUpload = await page.locator('button[data-testid="attachments-dropzone-button"]').last();
  await botaoUpload.scrollIntoViewIfNeeded();

  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    botaoUpload.click({ force: true })
  ]);

  await fileChooser.setFiles(caminhoPDF);
  await page.waitForTimeout(3000);

  log(`✅ Autuação anexada: ${caminhoPDF}`);
}

module.exports = { runRgpRobot };
