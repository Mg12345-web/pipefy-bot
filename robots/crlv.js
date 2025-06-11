const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { acquireLock, releaseLock } = require('../utils/lock');
const { loginPipefy } = require('../utils/auth');
const { extractText } = require('../utils/extractText');

async function extrairDadosDoCrlv(caminhoArquivo) {
  const texto = await extractText(caminhoArquivo);

  const placa = texto.match(/Placa[:\s]*([A-Z]{3}[0-9A-Z][0-9]{2})/)?.[1]?.trim();
  const renavam = texto.match(/Renavam[:\s]*([\d]{9,})/)?.[1]?.trim();
  const chassi = texto.match(/Chassi[:\s]*([\w\d]{10,})/)?.[1]?.trim();

  return {
    'Placa': placa || '',
    'CHASSI': chassi || '',
    'RENAVAM': renavam || '',
    'Estado de emplacamento': 'MG'
  };
}

async function runCrlvRobot(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.write('<pre>🧠 Iniciando robô de CRLV...\n');

  const log = (msg) => {
    res.write(`${msg}\n`);
    console.log(msg);
  };

  if (!acquireLock()) {
    log('⛔ Robô já em execução.');
    return res.end('</pre>');
  }

  const arquivos = req.files || {};
  const arquivoCRLV = arquivos?.crlv?.[0]?.path;

  if (!arquivoCRLV || !fs.existsSync(arquivoCRLV)) {
    log('❌ Arquivo de CRLV não recebido.');
    releaseLock();
    return res.end('</pre><p style="color:red">Arquivo de CRLV ausente.</p>');
  }

  let browser;

  try {
    const dados = await extrairDadosDoCrlv(arquivoCRLV);
    log(`📄 Dados extraídos: ${JSON.stringify(dados, null, 2)}`);

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
    if (fs.existsSync(arquivoCRLV)) fs.unlinkSync(arquivoCRLV);
    releaseLock();
  }
}

module.exports = { runCrlvRobot };
