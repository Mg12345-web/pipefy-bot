const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { acquireLock, releaseLock } = require('../utils/lock');
const { loginPipefy } = require('../utils/auth');
const { baixarArquivo } = require('../utils/downloads');

async function runRgpRobot(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.write('<pre>⏳ Aguardando 1 minuto para iniciar o robô RGP...\n');

  const log = (msg) => {
    res.write(`${msg}\n`);
    console.log(msg);
  };

  if (!acquireLock()) {
    log('⛔ Robô já está em execução.');
    return res.end('</pre>');
  }

  let browser;

  setTimeout(async () => {
    try {
      browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

      const context = await browser.newContext();
      const page = await context.newPage();

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
      const botaoNovo = page.locator('span:text("Create new card")').first();
      await botaoNovo.scrollIntoViewIfNeeded();
      await botaoNovo.evaluate(el => el.click());
      await page.waitForTimeout(3000);

      // CLIENTE
      log('👤 Selecionando cliente...');
      const botaoCliente = await page.locator('div:has-text("Cliente") >> text=Criar registro').first();
      await botaoCliente.click();
      await page.waitForTimeout(1000);
      await page.locator('input[placeholder*="cards pelo título"]').fill('143.461.936-25');
      await page.waitForTimeout(1500);
      await page.getByText('143.461.936-25', { exact: false }).first().click();
      log('👤 Cliente selecionado com sucesso');
      await page.getByText('*Cliente', { exact: true }).click();
      await page.waitForTimeout(10000);
      await page.keyboard.press('PageDown');
      await page.waitForTimeout(1000);

      // CRLV
      log('🚗 Selecionando CRLV...');
      await page.locator('text=Criar registro').nth(1).click();
      await page.waitForTimeout(1000);
      await page.locator('input[placeholder*="cards pelo título"]').fill('OPB3D62');
      await page.waitForTimeout(1500);
      await page.getByText('OPB3D62', { exact: false }).first().click();
      log('✅ CRLV selecionado');
      await page.waitForTimeout(1000);

      // OBSERVAÇÃO
      try {
        const observacao = req.query.observacao || 'nada de observações';
        const campo = await page.getByLabel('Observação');
        await campo.scrollIntoViewIfNeeded();
        await campo.fill(observacao);
        log('✅ Observação preenchida');
      } catch (e) {
        log(`❌ Erro ao preencher "Observação": ${e.message}`);
      }

      // CAMPOS DE TEXTO
      try {
        const inputs = page.locator('input[placeholder="Digite aqui ..."]');
        await inputs.nth(0).fill('AM09263379'); log('✅ AIT preenchido');
        await inputs.nth(1).fill('Prefeitura de BH'); log('✅ Órgão Autuador preenchido');
      } catch (e) {
        log(`❌ Erro ao preencher AIT/Órgão: ${e.message}`);
      }

      // DATA DE PRAZO
      try {
        await page.locator('[data-testid="day-input"]').fill('09');
        await page.locator('[data-testid="month-input"]').fill('06');
        await page.locator('[data-testid="year-input"]').fill('2025');
        await page.locator('[data-testid="hour-input"]').fill('08');
        await page.locator('[data-testid="minute-input"]').fill('00');
        log('✅ Prazo para Protocolo preenchido');
      } catch (e) {
        log(`❌ Erro no prazo: ${e.message}`);
      }

      // UPLOAD
      const urlPDF = 'https://www.africau.edu/images/default/sample.pdf';
      const nomePDF = 'anexo_rgp.pdf';
      const caminhoPDF = path.resolve(__dirname, nomePDF);

      try {
        log('📎 Baixando e enviando anexo...');
        await baixarArquivo(urlPDF, caminhoPDF);
        const botaoUpload = await page.locator('button[data-testid="attachments-dropzone-button"]').last();

        const [fileChooser] = await Promise.all([
          page.waitForEvent('filechooser'),
          botaoUpload.click()
        ]);
        await fileChooser.setFiles(caminhoPDF);
        await page.waitForTimeout(3000);

        const sucesso = await page.locator(`text="${nomePDF}"`).first().isVisible({ timeout: 7000 });
        log(sucesso ? `✅ Anexo "${nomePDF}" enviado` : `❌ Falha no upload do anexo`);
      } catch (e) {
        log(`❌ Erro ao enviar anexo: ${e.message}`);
      } finally {
        if (fs.existsSync(caminhoPDF)) fs.unlinkSync(caminhoPDF);
      }

      await page.keyboard.press('PageDown');
      await page.waitForTimeout(1000);
      await page.keyboard.press('PageDown');

      // FINALIZAÇÃO
      log('🚀 Finalizando card...');
      const botoes = await page.locator('button:has-text("Create new card")').all();
      let finalizado = false;

      for (const botao of botoes) {
        const box = await botao.boundingBox();
        if (box && box.width > 200 && box.height > 30) {
          await botao.scrollIntoViewIfNeeded();
          await page.waitForTimeout(500);
          await botao.click();
          log('✅ Card criado com sucesso!');
          finalizado = true;
          break;
        }
      }

      if (!finalizado) log('❌ Botão final "Create new card" não encontrado');

      // PRINT
      const caminhoPrint = path.resolve(__dirname, '../../prints/print_final_rgp.png');
      if (!fs.existsSync(path.dirname(caminhoPrint))) {
        fs.mkdirSync(path.dirname(caminhoPrint), { recursive: true });
      }
      await page.screenshot({ path: caminhoPrint });
      log(`📸 Print salvo como ${path.basename(caminhoPrint)}`);

      await browser.close();
      res.end('</pre><h3>✅ Processo RGP concluído com sucesso</h3><p><a href="/">⬅️ Voltar</a></p>');

    } catch (err) {
      log(`❌ Erro crítico: ${err.message}`);
      if (browser) await browser.close();
      res.end('</pre><p style="color:red"><b>❌ Erro ao executar robô RGP.</b></p>');
    } finally {
      releaseLock();
    }
  }, 60000);
}

module.exports = { runRgpRobot };
