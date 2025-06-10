const { chromium } = require('playwright');
const path = require('path');
const { acquireLock, releaseLock } = require('../utils/lock');
const { loginPipefy } = require('../utils/auth');
const { baixarArquivo } = require('../utils/downloads');
const fs = require('fs');

async function runClientRobot(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.write('<pre>🧠 Iniciando robô de CLIENTES...\n');

  const log = (msg) => {
    res.write(`${msg}\n`);
    console.log(msg);
  };

  if (!acquireLock()) {
    log('⛔ Robô já está em execução.');
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
    log('📁 Acessando banco "Clientes"...');

    await page.getByText('Databases', { exact: true }).click();
    await page.getByText('Clientes', { exact: true }).click();
    await page.click('button:has-text("Criar registro")');
    await page.waitForTimeout(2000);

    const dados = {
      'Nome Completo': 'ADRIANO ANTONIO DE SOUZA',
      'CPF OU CNPJ': '414.746.148-41',
      'Estado Civil Atual': 'Solteiro',
      'Profissão': 'Vigilante',
      'Email': 'jonas1gui@gmail.com',
      'Número de telefone': '31988429016',
      'Endereço Completo': 'Rua Luzia de Jesus, 135, Jardim dos Comerciários, Ribeirão das Neves - MG'
    };

    for (const [campo, valor] of Object.entries(dados)) {
      try {
        const labelLocator = page.getByLabel(campo);
        await labelLocator.scrollIntoViewIfNeeded();
        await labelLocator.fill(valor);
        log(`✅ ${campo} preenchido`);
      } catch {
        try {
          const inputPlaceholder = page.locator(`input[placeholder="${campo}"]`);
          await inputPlaceholder.scrollIntoViewIfNeeded();
          await inputPlaceholder.fill(valor);
          log(`✅ ${campo} (placeholder) preenchido`);
        } catch (erro) {
          log(`❌ Não foi possível preencher o campo "${campo}": ${erro.message}`);
        }
      }
    }

    log('📎 Anexando arquivos...');
    const arquivos = [
      { url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', nome: 'cnh_teste.pdf' },
      { url: 'https://www.africau.edu/images/default/sample.pdf', nome: 'proc_teste.pdf' }
    ];

    for (let i = 0; i < arquivos.length; i++) {
      const destino = path.resolve(__dirname, arquivos[i].nome);
      try {
        await baixarArquivo(arquivos[i].url, destino);
        const nomeArquivo = path.basename(destino);

        const botoesUpload = await page.locator('button[data-testid="attachments-dropzone-button"]');
        if (i >= await botoesUpload.count()) {
          log(`❌ Botão de upload não encontrado para o arquivo ${i + 1}`);
          continue;
        }

        const botao = botoesUpload.nth(i);
        await botao.scrollIntoViewIfNeeded();
        const [fileChooser] = await Promise.all([
          page.waitForEvent('filechooser'),
          botao.click()
        ]);
        await fileChooser.setFiles(destino);
        await page.waitForTimeout(3000);

        const sucesso = await page.locator(`text="${nomeArquivo}"`).first().isVisible({ timeout: 7000 });
        if (sucesso) {
          log(`✅ Arquivo ${nomeArquivo} enviado com sucesso`);
        } else {
          log(`❌ Falha no upload do arquivo ${nomeArquivo}`);
        }
      } catch (err) {
        log(`❌ Erro ao processar ${arquivos[i].nome}: ${err.message}`);
      } finally {
        if (fs.existsSync(destino)) fs.unlinkSync(destino);
      }
    }

    log('✅ Criando registro...');
    const botoesRegistro = await page.locator('button:has-text("Criar registro")').all();
    let registroCriado = false;

    for (const botao of botoesRegistro) {
      const box = await botao.boundingBox();
      if (box && box.width > 100 && box.height > 20) {
        await botao.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await botao.click();
        registroCriado = true;
        log('✅ Registro criado com sucesso');
        break;
      }
    }

    if (!registroCriado) {
      log('❌ Não foi possível encontrar o botão final de "Criar registro"');
    }

    log('📸 Salvando print...');
    const printPath = path.resolve(__dirname, '../../prints/print_final_clientes.png');
    if (!fs.existsSync(path.dirname(printPath))) {
      fs.mkdirSync(path.dirname(printPath), { recursive: true });
    }
    await page.screenshot({ path: printPath });
    log(`✅ Print salvo como ${path.basename(printPath)}`);

    await browser.close();
    res.end('</pre><h3>✅ Cadastro de cliente concluído!</h3><p><a href="/">⬅️ Voltar</a></p>');

  } catch (err) {
    log(`❌ Erro crítico: ${err.message}`);
    if (browser) await browser.close();
    res.end('</pre><p style="color:red">Erro no robô. Verifique os logs.</p>');
  } finally {
    releaseLock();
  }
}

module.exports = { runClientRobot };
