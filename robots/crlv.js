const { chromium } = require('playwright');
const path = require('path');
const { acquireLock, releaseLock } = require('../utils/lock');
const { loginPipefy } = require('../utils/auth');
const { baixarArquivo } = require('../utils/downloads');
const fs = require('fs'); // Necessário para operações de arquivo

/**
 * Executa o robô de cadastro de CRLV no Pipefy.
 * @param {import('express').Request} req - Objeto de requisição do Express.
 * @param {import('express').Response} res - Objeto de resposta do Express.
 */
async function runCrlvRobot(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.write('<pre>🧠 Iniciando robô de CRLV...\n');

  function log(msg) {
    res.write(`${msg}\n`);
    console.log(msg);
  }

  // --- Lógica de Lock ---
  if (!acquireLock()) {
    log('⛔ Robô já em execução.');
    return res.end('</pre>');
  }

  let browser; // Declara a variável browser aqui para estar disponível no finally

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await loginPipefy(page, log); // Chama a função de login centralizada

    log('📁 Acessando banco CRLV...');
    await page.getByText('Databases', { exact: true }).click();
    await page.getByText('CRLV', { exact: true }).click();
    await page.click('button:has-text("Criar registro")');
    await page.waitForTimeout(2000); // Adiciona uma pequena espera para a página carregar

    // Dados para o cadastro do CRLV
    const dados = {
      'Placa': 'GKD0F82', // Campo especial, tratado abaixo
      'CHASSI': '9C2KF4300NR006285',
      'RENAVAM': '01292345630',
      'Estado de emplacamento': 'SP'
    };

    for (const [campo, valor] of Object.entries(dados)) {
      try {
        if (campo === 'Placa') {
          // Trata a placa separadamente, como no código original, por ser um campo de entrada genérico
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
        log(`❌ Não foi possível preencher o campo "${campo}": ${e.message}`);
      }
    }

    log('📎 Anexando arquivo CRLV...');
    const urlArquivo = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
    const localPath = path.resolve(__dirname, 'crlv_temp.pdf'); // Salva temporariamente no diretório do robô

    try {
      await baixarArquivo(urlArquivo, localPath);
      const nomeArquivo = path.basename(localPath);
      const botoesUpload = await page.locator('button[data-testid="attachments-dropzone-button"]');
      
      // Assumindo que o primeiro botão de upload é o correto para o CRLV
      const botao = botoesUpload.nth(0);
      await botao.scrollIntoViewIfNeeded();

      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        botao.click()
      ]);
      await fileChooser.setFiles(localPath);
      await page.waitForTimeout(3000); // Esperar o upload do arquivo

      const sucesso = await page.locator(`text="${nomeArquivo}"`).first().isVisible({ timeout: 7000 });
      if (sucesso) {
        log(`✅ Arquivo CRLV (${nomeArquivo}) enviado`);
      } else {
        log(`❌ Falha no upload do CRLV (${nomeArquivo})`);
      }
    } catch (downloadOrUploadError) {
      log(`❌ Erro ao baixar ou enviar arquivo CRLV: ${downloadOrUploadError.message}`);
    } finally {
        if (fs.existsSync(localPath)) {
            fs.unlinkSync(localPath); // Limpa o arquivo temporário
        }
    }

    log('✅ Tentando criar registro...');
    // Lógica para encontrar e clicar no botão "Criar registro" final
    const botoesRegistro = await page.locator('button:has-text("Criar registro")').all();
    let registroCriado = false;
    for (const botao of botoesRegistro) {
        const box = await botao.boundingBox();
        if (box && box.width > 100 && box.height > 20) { // Filtros para encontrar o botão correto
            await botao.scrollIntoViewIfNeeded();
            await page.waitForTimeout(500); // Pequena espera antes do clique
            await botao.click();
            registroCriado = true;
            log('✅ Registro CRLV criado com sucesso!');
            break;
        }
    }

    if (!registroCriado) {
        log('❌ Não foi possível encontrar o botão "Criar registro" final.');
    }

    log('📸 Print final da tela de CRLV...');
    const screenshotPath = path.resolve(__dirname, '../../prints/registro_crlv.png'); // Caminho ajustado
    if (!fs.existsSync(path.dirname(screenshotPath))) { // Garante que a pasta 'prints' existe
        fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    }
    await page.screenshot({ path: screenshotPath });
    log(`✅ Print salvo em ${path.basename(screenshotPath)}`);

    await browser.close();
    res.end('</pre><h3>✅ Cadastro de CRLV concluído!</h3>');

  } catch (err) {
    log(`❌ Erro crítico no robô de CRLV: ${err.message}`);
    console.error(err); // Logar o erro completo no console do servidor
    if (browser) await browser.close();
    res.end('</pre><p style="color:red">Erro crítico no robô de CRLV. Verifique os logs.</p>');
  } finally {
    releaseLock(); // Garante que o lock seja liberado
  }
}

module.exports = { runCrlvRobot };
