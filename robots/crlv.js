const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { acquireLock, releaseLock } = require('../utils/lock');
const { loginPipefy } = require('../utils/auth');
const { normalizarArquivo } = require('../utils/normalizarArquivo');

async function runCrlvRobot(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.write('<pre>🧠 Iniciando robô de CRLV...\n');

  const log = (msg) => {
    res.write(`${msg}\n`);
    console.log(msg);
  };

  if (!acquireLock()) {
    log('⛔ Robô já está em execução.');
    return res.end('</pre>');
  }

 const arquivos = req.files || {};
  const arquivoOriginal = arquivos?.crlv?.[0];

  if (!arquivoOriginal || !fs.existsSync(arquivoOriginal.path)) {
    log('❌ Arquivo de CRLV não recebido.');
    releaseLock();
    return res.end('</pre><p style="color:red">Arquivo de CRLV ausente.</p>');
  }

  let browser;

  try {
    const arquivoCRLV = await normalizarArquivo('crlv', arquivoOriginal.path);

    const dados = {
      'Placa': req.body.dados?.['Placa'] || '',
      'Chassi': req.body.dados?.['Chassi'] || '',
      'Renavam': req.body.dados?.['Renavam'] || '',
      'Estado de Emplacamento': req.body.dados?.['Estado de Emplacamento'] || ''
    };

    log(`📄 Dados recebidos para preenchimento:\n${JSON.stringify(dados, null, 2)}`);

    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginPipefy(page, log);

    log('📁 Acessando banco "CRLV"...');
    await page.getByText('Databases', { exact: true }).click();
    await page.getByText('CRLV', { exact: true }).click();
    await page.click('button:has-text("Criar registro")');
    await page.waitForTimeout(2000);

    for (const [campo, valor] of Object.entries(dados)) {
      try {
        const input = campo === 'Placa'
          ? page.locator('input[placeholder="Digite aqui ..."]').first()
          : page.getByLabel(campo);

        await input.scrollIntoViewIfNeeded();
        await input.fill(valor);
        log(`✅ ${campo} preenchido`);
      } catch (e) {
        log(`❌ Erro ao preencher "${campo}": ${e.message}`);
      }
    }

    log('📎 Anexando arquivo CRLV...');
    const botao = await page.locator('button[data-testid="attachments-dropzone-button"]').first();
    const [fileChooser] = await Promise.all([page.waitForEvent('filechooser'), botao.click()]);
    await fileChooser.setFiles(arquivoCRLV);
    await page.waitForTimeout(2000);
    log('✅ Arquivo anexado com sucesso');

    log('✅ Criando registro CRLV...');
    const botoes = await page.$$('button');
    for (const botao of botoes) {
      const texto = await botao.innerText();
      const box = await botao.boundingBox();
      if (texto.trim() === 'Criar registro' && box?.width > 200) {
        await botao.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await botao.click();
        log('✅ Registro CRLV criado');
        break;
      }
    }

    const screenshotPath = path.resolve(__dirname, '../../prints/registro_crlv.png');
    if (!fs.existsSync(path.dirname(screenshotPath))) {
      fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    }
    await page.screenshot({ path: screenshotPath });
    log(`📸 Print salvo como ${path.basename(screenshotPath)}`);

    await browser.close();
    res.end('</pre><h3>✅ Cadastro de CRLV concluído!</h3><p><a href="/">⬅️ Voltar</a></p>');

  } catch (err) {
    log(`❌ Erro: ${err.message}`);
    if (browser) await browser.close();
    res.end('</pre><p style="color:red">Erro crítico no robô de CRLV.</p>');
  } finally {
}

module.exports = { runCrlvRobot };
