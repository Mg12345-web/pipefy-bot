const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { acquireLock, releaseLock } = require('../utils/lock');
const { loginPipefy } = require('../utils/auth');
const { normalizarArquivo } = require('../utils/normalizarArquivo');
const { interpretarPaginaComGptVision } = require('../utils/interpretadorPaginaGPT');

// Retry genérico
async function withRetry(fn, tentativas = 3, delayMs = 2000) {
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    try {
      return await fn(tentativa);
    } catch (err) {
      if (tentativa === tentativas) throw err;
      console.log(`⚠️ Erro: ${err.message} | Retry ${tentativa}/${tentativas}`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

// Selecionar cliente com fallback CPF → CRLV
async function selecionarClienteComFallback(page, cpf, placa, log) {
  log('👤 Selecionando cliente...');
  try {
    await page.getByTestId('star-form-connection-button').first().click();
  } catch {
    log('⚠️ Falha no botão do cliente, tentando via GPT Vision...');
    const seletor = await interpretarPaginaComGptVision(page, 'Botão "+ Criar registro" abaixo do campo "Clientes"');
    if (!seletor || seletor === 'NÃO ENCONTRADO') {
      throw new Error('❌ Não foi possível encontrar botão de cliente');
    }
    await page.locator(seletor).click({ force: true });
  }

  const campoBusca = page.getByRole('combobox', { name: 'Pesquisar' });

  async function tentarBusca(termo) {
    await campoBusca.fill('');
    await campoBusca.fill(termo);
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      await page.waitForTimeout(1500);
      const card = page.locator(`div:has-text("${termo}")`).first();
      if (await card.count()) {
        await card.click({ force: true });
        log(`✅ Cliente ${termo} selecionado`);
        return true;
      }
    }
    return false;
  }

  if (!(await tentarBusca(cpf))) {
    log(`⚠️ CPF ${cpf} não encontrado, tentando CRLV: ${placa}`);
    if (!(await tentarBusca(placa))) {
      throw new Error(`❌ Cliente não encontrado por CPF nem CRLV`);
    }
  }
}

// Selecionar CRLV com verificação
async function selecionarCRLVComRetry(page, placa, log) {
  log('🚗 Selecionando CRLV...');
  await page.getByText('Veículo (CRLV)').click();
  await page.getByTestId('star-form-connection-button').nth(1).click();
  const buscaCRLV = page.getByRole('combobox', { name: 'Pesquisar' });

  for (let tentativa = 0; tentativa < 3; tentativa++) {
    await buscaCRLV.fill('');
    await buscaCRLV.fill(placa);
    await page.waitForTimeout(1500);

    const card = page.locator(`div[data-testid^="connected-card-box"]:has-text("${placa}")`).first();
    if (await card.count()) {
      await card.click({ force: true });
      await page.getByText('Veículo (CRLV)').click();
      log(`✅ CRLV ${placa} selecionado`);
      return;
    }
  }
  throw new Error(`❌ CRLV ${placa} não encontrado`);
}

// Upload de autuação com confirmação
async function anexarAutuacaoComVerificacao(page, caminhoPDF, log) {
  log('📎 Anexando arquivo...');
  const nomeArquivo = path.basename(caminhoPDF);

  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.locator('button[data-testid="attachments-dropzone-button"]').last().click()
    ]);
    await fileChooser.setFiles(caminhoPDF);

    try {
      await page.waitForSelector(`text=${nomeArquivo}`, { timeout: 5000 });
      log(`✅ Autuação anexada: ${nomeArquivo}`);
      return;
    } catch {
      log(`⚠️ Upload falhou (tentativa ${tentativa + 1}), tentando novamente...`);
    }
  }
  throw new Error(`❌ Falha ao anexar: ${nomeArquivo}`);
}

async function runRgpRobot(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.write('<pre>⏳ Preparando robô RGP...\n');
  const log = msg => { res.write(msg + '\n'); console.log(msg); };

  if (!acquireLock()) {
    log('⛔ Robô já está em execução.');
    return res.end('</pre>');
  }

  const { dados = {}, autuacoes = [] } = req.body;
  const cpf = dados['CPF'] || '';
  const placa = dados['Placa'] || req.body.placa || '';
  const arquivos = req.files?.autuacoes?.map(f => f.path) || [];
  const caminhoPDF = normalizarArquivo('autuacao', arquivos[0]); 

  let browser, page;
  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext();
    page = await context.newPage();

    await loginPipefy(page, log);

    log('📂 Acessando Pipe RGP...');
    await page.getByText('RGP', { exact: true }).click();
    await page.waitForTimeout(8000);

    const botaoPipe = page.locator('text=Entrar no pipe');
    if (await botaoPipe.count()) {
      await botaoPipe.first().click();
      await page.waitForTimeout(8000);
    }

    // Fluxo blindado
    await withRetry(() => abrirNovoCardPreCadastro(page, log));
    await withRetry(() => selecionarClienteComFallback(page, cpf, placa, log));
    await withRetry(() => selecionarCRLVComRetry(page, placa, log));
    await withRetry(() => preencherAIT(page, autuacoes[0]?.ait || '', log));
    await withRetry(() => preencherOrgao(page, autuacoes[0]?.orgao || '', log));
    await withRetry(() => preencherPrazoParaProtocoloComTeclado(page, autuacoes[0]?.prazo || '', log));
    await withRetry(() => anexarAutuacaoComVerificacao(page, caminhoPDF, log));

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
    res.end('</pre><h3>✅ Processo RGP concluído com sucesso</h3>');

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
    releaseLock();
  }
}

// Aproveitando suas funções já existentes
async function abrirNovoCardPreCadastro(page, log) {
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

async function preencherAIT(page, ait, log) {
  if (!ait) return;
  log('📝 Preenchendo AIT...');
  await page.getByTestId('phase-fields').getByText('AIT').click();
  const inputAIT = page.getByRole('textbox', { name: 'AIT' });
  await inputAIT.fill(ait);
  log(`✅ AIT preenchido: ${ait}`);
}

async function preencherOrgao(page, orgao, log) {
  if (!orgao) return;
  log('🏛️ Preenchendo Órgão...');
  await page.getByTestId('phase-fields').getByText('Órgão').click();
  await page.getByRole('textbox', { name: 'Órgão' }).fill(orgao);
  log(`✅ Órgão preenchido: ${orgao}`);
}

async function preencherPrazoParaProtocoloComTeclado(page, prazo, log) {
  log('🗓️ Preenchendo Prazo...');
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
  } catch {
    log('⚠️ Data inválida, usando padrão.');
  }

  for (let i = 0; i < campos.length; i++) {
    const el = await page.locator(campos[i]).first();
    await el.waitFor({ state: 'visible', timeout: 5000 });
    await el.click();
    await page.keyboard.type(valores[i], { delay: 100 });
  }

  log(`✅ Prazo preenchido: ${valores.slice(0, 3).join('/')} às ${valores[3]}:${valores[4]}`);
}

module.exports = { runRgpRobot };
