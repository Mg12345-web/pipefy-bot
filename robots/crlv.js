const { chromium } = require('playwright');
const path = require('path');
const { acquireLock, releaseLock } = require('../utils/lock');
const { loginPipefy } = require('../utils/auth');
const { baixarArquivo } = require('../utils/downloads');
const fs = require('fs');

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

  let browser;

  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: '/usr/bin/google-chrome-stable',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    await loginPipefy(page, log);

    log('📁 Acessando banco "CRLV"...');
    await page.getByText('Databases', { exact: true }).click();
    await page.getByText('CRLV', { exact: true }).click();
    await page.click('button:has-text("Criar registro")');
    await page.waitForTimeout(2000);

    const dados = {
      'Placa': 'GKD0F82',
      'CHASSI': '9C2KF4300NR006285',
      'RENAVAM': '01292345630',
      'Estado de emplacamento': 'SP'
    };

    for (const [campo, valor] of Object.entries(dados)) {
      try {
        if (campo === 'Placa') {
          const inputPlaca = page.locator('input[placeholder="Digite aqui ..."]').first();
          await inputPlaca.scrollIntoViewIfNeeded();
          await inputPlaca.fill(valor);
          log(`✅ ${campo} (campo especial) preenchido`);
        } else {
          const labelLocator = page.getByLabel(campo);
          await labelLocator.scrollIntoViewIfNeeded();
          await labelLocator.fill(valor);
          log(`✅ ${campo} preenchido`);
        }
      } catch (e) {
        log(`❌ Erro ao preencher "${campo}": ${e.message}`);
      }
    }

    log('📎 Anexando arquivo CRLV...');
    const urlArquivo = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
    const localPath = path.resolve(__dirname, 'crlv_temp.pdf');

    try {
      await baixarArquivo(urlArquivo, localPath);
      const nomeArquivo = path.basename(localPath);

      const botoesUpload = await page.locator('button[data-testid="attachments-dropzone-button"]');
      if ((await botoesUpload.count()) === 0) {
        log('❌ Nenhum botão de upload encontrado');
      } else {
        const botao = botoesUpload.nth(0);
        await botao.scrollIntoViewIfNeeded();

        const [fileChooser] = await Promise.all([
          page.waitForEvent('filechooser'),
          botao.click()
        ]);
        await fileChooser.setFiles(localPath);
        await page.waitForTimeout(3000);

        const sucesso = await page.locator(`text="${nomeArquivo}"`).first().isVisible({ timeout: 7000 });
        if (sucesso) {
          log(`✅ Arquivo "${nomeArquivo}" enviado com sucesso`);
        } else {
          log(`❌ Falha no upload do arquivo "${nomeArquivo}"`);
        }
      }
    } catch (e) {
      log(`❌ Erro ao baixar ou anexar o CRLV: ${e.message}`);
    } finally {
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
    }

    log('✅ Criando registro CRLV...');
    const botoesRegistro = await page.locator('button:has-text("Criar registro")').all();
    let registroCriado = false;

    for (const botao of botoesRegistro) {
      const box = await botao.boundingBox();
      if (box && box.width > 100 && box.height > 20) {
        await botao.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await botao.click();
        registroCriado = true;
        log('✅ Registro CRLV criado com sucesso');
        break;
      }
    }

    if (!registroCriado) {
      log('❌ Botão final "Criar registro" não encontrado');
    }

    log('📸 Salvando print da tela final...');
    const screenshotPath = path.resolve(__dirname, '../../prints/registro_crlv.png');
    if (!fs.existsSync(path.dirname(screenshotPath))) {
      fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    }
    await page.screenshot({ path: screenshotPath });
    log(`✅ Print salvo como ${path.basename(screenshotPath)}`);

    await browser.close();
    res.end('</pre><h3>✅ Cadastro de CRLV concluído!</h3><p><a href="/">⬅️ Voltar</a></p>');

  } catch (err) {
    log(`❌ Erro crítico: ${err.message}`);
    if (browser) await browser.close();
    res.end('</pre><p style="color:red">Erro crítico no robô de CRLV. Verifique os logs.</p>');
  } finally {
    releaseLock();
  }
}

module.exports = { runCrlvRobot };
