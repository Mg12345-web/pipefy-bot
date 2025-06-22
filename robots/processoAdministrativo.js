// processoAdministrativo.js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { acquireLock, releaseLock } = require('../utils/lock');
const { loginPipefy } = require('../utils/auth');

async function runProcessoAdministrativo(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.write('<pre>⏳ Iniciando robô Processo Administrativo...
');
  const log = msg => { res.write(msg + '\n'); console.log(msg); };

  if (!acquireLock()) {
    log('⛔ Robô já está em execução.');
    return res.end('</pre>');
  }

  const { cpf, numeroProcesso, orgao, prazo, documento } = req.body;
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
    await page.getByTestId(/connected-card-box/i).first().click();
    await page.getByText('* Cliente').click();

    log('📝 Preenchendo dados do processo...');
    await page.getByRole('textbox', { name: '* Número do processo' }).fill(numeroProcesso);
    await page.getByRole('textbox', { name: '* Órgão' }).fill(orgao);
    await page.getByTestId('day-input').fill(prazo);

    log('📎 Anexando documento...');
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByTestId('attachments-dropzone-button').click()
    ]);
    await fileChooser.setFiles(caminhoPDF);
    await page.waitForTimeout(3000);

    await page.getByTestId('start-form-click-on-button').click();
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

module.exports = { runProcessoAdministrativo };
