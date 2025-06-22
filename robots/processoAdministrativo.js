const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { acquireLock, releaseLock } = require('../utils/lock');
const { loginPipefy } = require('../utils/auth');

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

async function runProcessoAdministrativo(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.write('<pre>⏳ Iniciando robô Processo Administrativo...\n');
  const log = msg => { res.write(msg + '\n'); console.log(msg); };

  if (!acquireLock()) {
    log('⛔ Robô já está em execução.');
    return res.end('</pre>');
  }

  const { cpf, numeroProcesso, orgao, prazo } = req.body;
  const documento = (req.files?.documento || [])[0];
  const caminhoPDF = documento?.path || '';

  if (!cpf || !numeroProcesso || !orgao || !prazo || !caminhoPDF) {
    log('❌ Dados incompletos recebidos. Verifique os campos obrigatórios.');
    releaseLock();
    return res.end('</pre>');
  }

  let browser, page;

  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext();
    page = await context.newPage();

    await loginPipefy(page, log);

    log('📂 Acessando Pipe Processo Administrativo...');
    await page.getByRole('link', { name: 'Processo Administrativo' }).click();
    await page.waitForTimeout(5000);

    await page.getByTestId('phase-328258120-container').getByTestId('new-card-button').click();
    await page.getByTestId('star-form-connection-button').click();
    await page.getByRole('textbox', { name: 'Pesquisar' }).fill(cpf);
    await page.getByRole('textbox', { name: 'Pesquisar' }).click();
    await page.waitForTimeout(2000);

    const card = page.locator('div[data-testid^="connected-card-box"]').filter({ hasText: cpf }).first();
    await card.waitFor({ state: 'visible', timeout: 10000 });
    await card.click();
    await page.getByText('* Cliente').click();

    log('📝 Preenchendo dados do processo...');
    await page.getByRole('textbox', { name: '* Número do processo' }).fill(numeroProcesso);
    await page.getByRole('textbox', { name: '* Órgão' }).fill(orgao);

    await preencherPrazoParaProtocoloComTeclado(page, prazo, log);

    log('📎 Anexando documento...');
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByTestId('attachments-dropzone-button').click()
    ]);
    await fileChooser.setFiles(caminhoPDF);
    await page.waitForTimeout(3000);

    const botaoEnviar = await page.getByTestId('start-form-click-on-button');
    await botaoEnviar.scrollIntoViewIfNeeded();
    await botaoEnviar.click();

    log('✅ Processo Administrativo criado com sucesso.');

    await browser.close();
    res.end('</pre><h3>✅ Robô finalizado com sucesso.</h3>');

  } catch (err) {
    log(`❌ Erro: ${err.message}`);
    if (browser) await browser.close();
    res.end('</pre><h3 style="color:red">❌ Erro no robô.</h3>');
  } finally {
    releaseLock();
  }
}

module.exports = { runProcessoAdministrativoRobot: runProcessoAdministrativo };
