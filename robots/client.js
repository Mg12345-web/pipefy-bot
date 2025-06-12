const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { acquireLock, releaseLock } = require('../utils/lock');
const { loginPipefy } = require('../utils/auth');

// 🔍 Se ainda quiser a opção de extrair dos PDFs:
const { extractText } = require('../utils/extractText');

async function runClientRobot(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.write('<pre>🤖 Iniciando robô de CLIENTES...\n');

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
    const caminhoProcuracao = req.files?.procuracao?.[0]?.path || '';
    const caminhoCnh = req.files?.cnh?.[0]?.path || '';
    const caminhoContrato = req.files?.contrato?.[0]?.path || '';

    const dados = {
      'Nome Completo': req.body.nome || '',
      'CPF OU CNPJ': req.body.cpf || '',
      'Estado Civil Atual': req.body.estadoCivil || '',
      'Profissão': req.body.profissao || '',
      'Endereço Completo': req.body.endereco || '',
      'Email': req.body.email || '',
      'Número de telefone': req.body.telefone || ''
    };

    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const context = await browser.newContext();
    const page = await context.newPage();

    await loginPipefy(page, log);
    log('📁 Acessando banco "Clientes"...');

    await page.getByText('Databases', { exact: true }).click();
    await page.getByText('Clientes', { exact: true }).click();
    await page.click('button:has-text("Criar registro")');
    await page.waitForTimeout(2000);

    for (const [campo, valor] of Object.entries(dados)) {
      try {
        const labelLocator = page.getByLabel(campo);
        await labelLocator.scrollIntoViewIfNeeded();
        await labelLocator.fill(valor);
        log(`✅ ${campo} preenchido`);
      } catch {
        log(`⚠️ Campo não encontrado: ${campo}`);
      }
    }

    const anexos = [caminhoCnh, caminhoProcuracao, caminhoContrato].filter(fs.existsSync);
    for (const caminho of anexos) {
      const botao = await page.locator('button[data-testid="attachments-dropzone-button"]').first();
      await botao.waitFor({ state: 'visible', timeout: 5000 });

      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        botao.click()
      ]);
      await fileChooser.setFiles(caminho);
      await page.waitForTimeout(2000);

      const nomeArquivo = path.basename(caminho);
      const sucesso = await page.locator(`text="${nomeArquivo}"`).first().isVisible({ timeout: 5000 });

      if (sucesso) {
        log(`✅ Upload concluído: ${nomeArquivo}`);
      } else {
        log(`⚠️ Upload pode ter falhado: ${nomeArquivo}`);
      }
    }

    log('✅ Criando registro...');
    const botoes = await page.$$('button');
    let botaoClicado = false;

    for (const botao of botoes) {
      const texto = await botao.innerText();
      const box = await botao.boundingBox();

      if (texto.trim() === 'Criar registro' && box && box.width > 200) {
        await botao.scrollIntoViewIfNeeded();
        await botao.click();
        log('✅ Botão clicado: Criar registro');
        botaoClicado = true;
        break;
      }
    }

    if (!botaoClicado) {
      log('⛔ Nenhum botão visível com texto "Criar registro" foi clicado.');
    } else {
      try {
        await page.waitForSelector('div[role="dialog"]', { state: 'detached', timeout: 10000 });
        log('✅ Modal fechado. Registro presumidamente criado.');
      } catch {
        log('⚠️ Modal não fechou. Pode ter ocorrido falha silenciosa.');
      }
    }

    const printPath = path.resolve(__dirname, '../../prints/print_final_clientes.png');
    if (!fs.existsSync(path.dirname(printPath))) {
      fs.mkdirSync(path.dirname(printPath), { recursive: true });
    }
    await page.screenshot({ path: printPath });
    log(`📸 Print salvo como ${path.basename(printPath)}`);

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
