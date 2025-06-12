const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { acquireLock, releaseLock } = require('../utils/lock');
const { loginPipefy } = require('../utils/auth');
const { normalizarArquivo } = require('../utils/arquivos');

async function runSemRgpRobot(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.write('<pre>⏳ Preparando robô Sem RGP...\n');

  const log = msg => { res.write(msg + '\n'); console.log(msg); };
  if (!acquireLock()) {
    log('⛔ Robô já está em execução.');
    return res.end('</pre>');
  }

  const arquivos = req.files?.autuacoes || [];
  const { ait = '', orgao = '' } = req.body;

  if (!arquivos.length) {
    log('❌ Nenhum arquivo de autuação recebido.');
    releaseLock();
    return res.end('</pre>');
  }

  const caminhoPDF = normalizarArquivo('autuacao', arquivos[0].path);
  let browser, page;

  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext();
    page = await context.newPage();

    await loginPipefy(page, log);

    log('📂 Acessando Pipe Sem RGP...');
    await page.getByText('Sem RGP', { exact: true }).click();
    await page.waitForTimeout(3000);

    const botaoPipe = page.locator('text=Entrar no pipe');
    if (await botaoPipe.count() > 0) {
      await botaoPipe.first().click();
      await page.waitForTimeout(3000);
    }

    log('🆕 Criando novo card...');
    await page.locator('span:text("Create new card")').first().click();
    await page.waitForTimeout(3000);

    // Cliente
    log('👤 Selecionando cliente...');
    await page.locator('div:has-text("Cliente") >> :text("Criar registro")').first().click();
    await page.locator('input[placeholder*="Pesquisar"]').fill('143.461.936-25');
    await page.waitForTimeout(1500);
    await page.getByText('143.461.936-25', { exact: false }).first().click();
    log('✅ Cliente selecionado');

    // CRLV
    log('🚗 Selecionando CRLV...');
    const campoEstavel = page.locator('input[placeholder="Digite aqui ..."]').first();
    await campoEstavel.scrollIntoViewIfNeeded();
    await campoEstavel.click();
    await page.waitForTimeout(1000);
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(1000);

    const botoesCriar = await page.locator('text=Criar registro');
    if ((await botoesCriar.count()) >= 2) {
      const botaoCRLV = botoesCriar.nth(1);
      const box = await botaoCRLV.boundingBox();
      if (!box || box.width === 0) throw new Error('❌ Botão CRLV invisível!');
      await botaoCRLV.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      await botaoCRLV.click();
      log('✅ Botão CRLV clicado');
    } else {
      throw new Error('❌ Botão CRLV não encontrado');
    }

    try {
      await page.waitForSelector('input[placeholder*="Pesquisar"]', { timeout: 15000 });
      await page.locator('input[placeholder*="Pesquisar"]').fill('OPB3D62');
      await page.waitForTimeout(1500);
      await page.getByText('OPB3D62', { exact: false }).first().click();
      log('✅ CRLV selecionado');
    } catch (e) {
      log('❌ Falha ao selecionar CRLV');
      const erroPath = path.resolve(__dirname, '../../prints/print_crlv_erro.jpg');
      fs.mkdirSync(path.dirname(erroPath), { recursive: true });
      await page.screenshot({ path: erroPath });
      const base64Erro = fs.readFileSync(erroPath).toString('base64');
      res.write(`<img src="data:image/jpeg;base64,${base64Erro}" style="max-width:100%">`);
      throw new Error('❌ Falha ao selecionar CRLV');
    }

    // Preenchimento
    const inputs = await page.locator('input[placeholder="Digite aqui ..."]');
    if (ait) { await inputs.nth(0).fill(ait); log('✅ AIT preenchido'); }
    if (orgao) { await inputs.nth(1).fill(orgao); log('✅ Órgão preenchido'); }

    // Prazo para Protocolo
    log('📆 Preenchendo campo "Prazo para Protocolo"...');
    const df = [
      '[data-testid="day-input"]',
      '[data-testid="month-input"]',
      '[data-testid="year-input"]',
      '[data-testid="hour-input"]',
      '[data-testid="minute-input"]'
    ];
    const val = ['09','06','2025','08','00'];
    for (let i = 0; i < df.length; i++) {
      const el = await page.locator(df[i]).first();
      await el.click();
      await page.keyboard.type(val[i], { delay: 100 });
    }
    log('✅ Prazo preenchido');

    // Upload da autuação
    log('📎 Anexando arquivo...');
    const botaoUpload = await page.locator('button[data-testid="attachments-dropzone-button"]').last();
    await botaoUpload.scrollIntoViewIfNeeded();
    const [fileChooser] = await Promise.all([page.waitForEvent('filechooser'), botaoUpload.click()]);
    await fileChooser.setFiles(caminhoPDF);
    await page.waitForTimeout(3000);
    log('📎 Autuação anexada');

    // Finalizar card
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

    const printPath = path.resolve(__dirname, '../../prints/print_final_semrgp.png');
    fs.mkdirSync(path.dirname(printPath), { recursive: true });
    await page.screenshot({ path: printPath });

    log(`📸 Print final salvo: ${path.basename(printPath)}`);
    await browser.close();

    const img = fs.readFileSync(printPath).toString('base64');
    res.write(`<img src="data:image/png;base64,${img}" style="max-width:100%">`);
    res.end('</pre><h3>✅ Processo Sem RGP concluído com sucesso</h3><p><a href="/">⬅️ Voltar</a></p>');

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
    res.end('</pre><h3 style="color:red">❌ Erro no robô Sem RGP.</h3>');
  } finally {
    if (fs.existsSync(caminhoPDF)) fs.unlinkSync(caminhoPDF);
    releaseLock();
  }
}

module.exports = { runSemRgpRobot };
