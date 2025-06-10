const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { acquireLock, releaseLock } = require('../utils/lock');
const { loginPipefy } = require('../utils/auth');
const { baixarArquivo } = require('../utils/downloads');

/**
 * Executa o robô de cadastro de serviço SEM RGP no Pipefy.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function runSemRgpRobot(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.write('<pre>⏳ Aguardando 1 minuto para iniciar o robô SEM RGP...\n');

  function log(msg) {
    res.write(`${msg}\n`);
    console.log(msg);
  }

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

      log('📂 Acessando Pipe Sem RGP...');
      await page.getByText('Sem RGP', { exact: true }).click();
      await page.waitForTimeout(3000);

      const botaoEntrarPipe = page.locator('text=Entrar no pipe');
      if (await botaoEntrarPipe.count() > 0) {
        await botaoEntrarPipe.first().click();
        await page.waitForTimeout(3000);
      }

      log('🆕 Criando novo card...');
      const spanCreateNewCard = await page.locator('span:text("Create new card")').first();
      await spanCreateNewCard.scrollIntoViewIfNeeded();
      await spanCreateNewCard.evaluate(el => el.click());
      await page.waitForTimeout(3000);

      log('👤 Selecionando cliente...');
      await page.locator('div:has-text("Cliente") >> text=Criar registro').first().click();
      await page.waitForTimeout(1000);
      await page.locator('input[placeholder*="cards pelo título"]').fill('143.461.936-25');
      await page.waitForTimeout(1500);
      await page.getByText('143.461.936-25', { exact: false }).first().click();
      log('✅ Cliente selecionado com sucesso');
      await page.getByText('*Cliente', { exact: true }).click();
      await page.waitForTimeout(10000);
      await page.keyboard.press('PageDown');

      log('🚗 Selecionando CRLV...');
      await page.locator('text=Criar registro').nth(1).click();
      await page.waitForTimeout(1000);
      await page.locator('input[placeholder*="cards pelo título"]').fill('OPB3D62');
      await page.waitForTimeout(1500);
      await page.getByText('OPB3D62', { exact: false }).first().click();
      log('✅ CRLV selecionado com sucesso');
      await page.waitForTimeout(1000);

      log('📌 Preenchendo dados (AIT e Órgão Autuador)...');
      try {
        const inputs = await page.locator('input[placeholder="Digite aqui ..."]');
        await inputs.nth(0).fill('AM09263379');
        await inputs.nth(1).fill('Prefeitura de BH');
        log('✅ AIT e Órgão Autuador preenchidos');
      } catch (e) {
        log(`❌ Erro ao preencher campos: ${e.message}`);
      }

      log('📆 Preenchendo campo "Prazo"...');
      try {
        const prazoCampos = [
          { selector: '[data-testid="day-input"]', valor: '09' },
          { selector: '[data-testid="month-input"]', valor: '06' },
          { selector: '[data-testid="year-input"]', valor: '2025' },
          { selector: '[data-testid="hour-input"]', valor: '08' },
          { selector: '[data-testid="minute-input"]', valor: '00' },
        ];
        for (const campo of prazoCampos) {
          const input = await page.locator(campo.selector).first();
          await input.click();
          await page.keyboard.type(campo.valor, { delay: 100 });
        }
        log('✅ Prazo preenchido');
      } catch (e) {
        log(`❌ Erro ao preencher prazo: ${e.message}`);
      }

      log('📎 Anexando arquivo...');
      const urlPDF = 'https://www.africau.edu/images/default/sample.pdf';
      const nomePDF = 'anexo_semrgp.pdf';
      const caminhoPDF = path.resolve(__dirname, nomePDF);

      try {
        await baixarArquivo(urlPDF, caminhoPDF);
        const botaoUpload = await page.locator('button[data-testid="attachments-dropzone-button"]').last();
        const [fileChooser] = await Promise.all([
          page.waitForEvent('filechooser'),
          botaoUpload.click()
        ]);
        await fileChooser.setFiles(caminhoPDF);
        await page.waitForTimeout(3000);

        const sucesso = await page.locator(`text="${nomePDF}"`).first().isVisible({ timeout: 7000 });
        log(sucesso ? `✅ Arquivo ${nomePDF} enviado com sucesso!` : `❌ Falha no upload do arquivo ${nomePDF}.`);
      } catch (e) {
        log(`❌ Erro ao anexar arquivo: ${e.message}`);
      } finally {
        if (fs.existsSync(caminhoPDF)) fs.unlinkSync(caminhoPDF);
      }

      await page.keyboard.press('PageDown');
      await page.waitForTimeout(1000);
      await page.keyboard.press('PageDown');

      log('🚀 Finalizando card...');
      try {
        const botoes = await page.locator('button:has-text("Create new card")').all();
        let finalizado = false;
        for (const botao of botoes) {
          const box = await botao.boundingBox();
          if (box && box.width > 200 && box.height > 30) {
            await botao.scrollIntoViewIfNeeded();
            await page.waitForTimeout(500);
            await botao.click();
            finalizado = true;
            log('✅ Card finalizado com sucesso!');
            break;
          }
        }
        if (!finalizado) log('❌ Não foi possível finalizar o card.');
      } catch (e) {
        log(`❌ Erro ao finalizar card: ${e.message}`);
      }

      const printFinal = path.resolve(__dirname, '../../prints/print_final_semrgp.png');
      if (!fs.existsSync(path.dirname(printFinal))) {
        fs.mkdirSync(path.dirname(printFinal), { recursive: true });
      }
      await page.screenshot({ path: printFinal });
      log(`✅ Print salvo em ${path.basename(printFinal)}`);

      await browser.close();
      log('✅ Robô SEM RGP finalizado com sucesso!');
      res.end('</pre><p><b>✅ Processo SEM RGP concluído.</b></p>');

    } catch (err) {
      log(`❌ Erro crítico no robô SEM RGP: ${err.message}`);
      if (browser) await browser.close();
      res.end('</pre><p style="color:red"><b>❌ Erro ao executar robô SEM RGP.</b></p>');
    } finally {
      releaseLock();
    }
  }, 60000);
}

module.exports = { runSemRgpRobot };
