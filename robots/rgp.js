const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { acquireLock, releaseLock } = require('../utils/lock');
const { loginPipefy } = require('../utils/auth');
const { extractText } = require('../utils/extractText');

async function runRgpRobot(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.write('<pre>⏳ Aguardando 1 minuto para iniciar o robô RGP...\n');

  const log = msg => { res.write(msg + '\n'); console.log(msg); };
  if (!acquireLock()) { log('⛔ Robô já está em execução.'); return res.end('</pre>'); }

  const arquivos = req.files?.autuacoes || [];
  if (!arquivos.length) { log('❌ Nenhum arquivo de autuação recebido.'); releaseLock(); return res.end('</pre>'); }

  let browser, page;

  setTimeout(async () => {
    try {
      browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
      const context = await browser.newContext();
      page = await context.newPage();

      await loginPipefy(page, log);
      log('📂 Acessando Pipe "RGP"...');
      await page.getByText('RGP', { exact: true }).click();
      await page.waitForTimeout(3000);

      const botaoEntrar = page.locator('text=Entrar no pipe');
      if (await botaoEntrar.count() > 0) {
        await botaoEntrar.first().click();
        await page.waitForTimeout(3000);
      }

      log('🆕 Criando novo card...');
      await page.locator('span:text("Create new card")').first().click();
      await page.waitForTimeout(3000);

      // Selecionar cliente
      log('👤 Selecionando cliente...');
      await page.locator('div:has-text("Cliente") >> :text("Criar registro")').first().click();
      await page.locator('input[placeholder*="Pesquisar"]').fill('143.461.936-25');
      await page.waitForTimeout(1500);
      await page.getByText('143.461.936-25', { exact: false }).first().click();
      log('✅ Cliente selecionado');

      // Preparar CRLV
      log('🚗 Preparando para selecionar CRLV...');
      const campoEstavel = page.locator('input[placeholder="Digite aqui ..."]').first();
      await campoEstavel.scrollIntoViewIfNeeded();
      await campoEstavel.click();
      await page.waitForTimeout(1000);
      await page.keyboard.press('PageDown');
      await page.waitForTimeout(1000);

      // Selecionar CRLV
      log('🚗 Selecionando CRLV...');
      const botoesCriar = await page.locator('text=Criar registro');
      if ((await botoesCriar.count()) >= 2) {
        const botaoCRLV = botoesCriar.nth(1);
        const box = await botaoCRLV.boundingBox();
        if (!box || box.width === 0) throw new Error('❌ Botão CRLV invisível!');
        await botaoCRLV.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1000);
        await botaoCRLV.click();
        log('✅ Botão CRLV clicado');
      } else throw new Error('❌ Botão CRLV não encontrado');

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
        await page.screenshot({ path: erroPath, type: 'jpeg', quality: 80 });
        const base64Erro = fs.readFileSync(erroPath).toString('base64');
        res.write(`<img src="data:image/jpeg;base64,${base64Erro}" style="max-width:100%">`);
        throw new Error('❌ Falhou selecionar CRLV');
      }

      // Extração da autuação
      const pasta = path.dirname(arquivos[0].path);
      const caminhoPDF = path.join(pasta, 'autuacao.pdf');
      fs.renameSync(arquivos[0].path, caminhoPDF);
      
      const textoPDF = await extractText(caminhoPDF);
      log('📄 Texto da autuação capturado');

      const ait = textoPDF.match(/AIT[:\s]*([A-Z0-9\-]+)/i)?.[1] || '';
      const orgao = textoPDF.match(/Órgão Autuador[:\s]*([A-Za-zÀ-ú\s]+)/i)?.[1]?.trim() || '';
      log(`🧾 AIT=${ait} | Órgão=${orgao}`);

      try {
        const inputs = await page.locator('input[placeholder="Digite aqui ..."]');
        if (ait) { await inputs.nth(0).fill(ait); log('✅ AIT preenchido'); }
        if (orgao) { await inputs.nth(1).fill(orgao); log('✅ Órgão preenchido'); }
      } catch (e) {
        log(`❌ Erro preenchendo AIT/Órgão: ${e.message}`);
      }

      // Prazo para Protocolo
      log('📆 Preenchendo campo "Prazo para Protocolo"...');
      try {
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
      } catch (e) {
        log('❌ Falha preenchimento prazo: ' + e.message);
      }

      // Anexar autuação
      log('📎 Anexando arquivo...');
      const botaoUpload = await page.locator('button[data-testid="attachments-dropzone-button"]').last();
      await botaoUpload.scrollIntoViewIfNeeded();
      const [fileChooser] = await Promise.all([page.waitForEvent('filechooser'), botaoUpload.click()]);
      await fileChooser.setFiles(caminhoPDF);
      await page.waitForTimeout(3000);
      log('📎 Autuação anexada');

      // Criar card
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

      const finalPrint = path.resolve(__dirname, '../../prints/print_final_rgp.png');
      fs.mkdirSync(path.dirname(finalPrint), { recursive: true });
      await page.screenshot({ path: finalPrint });
      log('📸 Print final salvo');

      await browser.close();
      res.end('</pre><h3>✅ Processo RGP concluído com sucesso</h3><p><a href="/">⬅️ Voltar</a></p>');

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
    if (fs.existsSync(caminhoPDF)) fs.unlinkSync(caminhoPDF);
      releaseLock();
    }
  }, 60000);
}

module.exports = { runRgpRobot };
