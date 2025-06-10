const { chromium } = require('playwright');
const path = require('path');
const { acquireLock, releaseLock } = require('../utils/lock');
const { loginPipefy } = require('../utils/auth');
const { baixarArquivo } = require('../utils/downloads');
const fs = require('fs'); // Necessário para operações de arquivo

/**
 * Executa o robô de cadastro de serviço SEM RGP no Pipefy.
 * @param {import('express').Request} req - Objeto de requisição do Express.
 * @param {import('express').Response} res - Objeto de resposta do Express.
 */
async function runSemRgpRobot(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.write('<pre>⏳ Aguardando 1 minuto para iniciar o robô SEM RGP...\n');

  function log(msg) {
    res.write(`${msg}\n`);
    console.log(msg);
  }

  // --- Lógica de Lock ---
  if (!acquireLock()) {
    log('⛔ Robô já está em execução.');
    return res.end('</pre>');
  }

  let browser; // Declara a variável browser aqui para estar disponível no finally

  // O robô original tinha um setTimeout de 1 minuto. Mantendo-o aqui para a lógica.
  setTimeout(async () => {
    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();

      await loginPipefy(page, log); // Chama a função de login centralizada

      log('📂 Acessando Pipe sem RGP...');
      await page.getByText('sem RGP', { exact: true }).click();
      await page.waitForTimeout(3000); // Espera após clicar no pipe

      // Tenta clicar em "Entrar no pipe" se presente
      const botaoEntrarPipe = page.locator('text=Entrar no pipe');
      if (await botaoEntrarPipe.count() > 0) {
        await botaoEntrarPipe.first().click();
        await page.waitForTimeout(3000); // Espera após entrar no pipe
      }

      log('🆕 Criando novo card...');
      const spanCreateNewCard = await page.locator('span:text("Create new card")').first();
      await spanCreateNewCard.scrollIntoViewIfNeeded();
      await spanCreateNewCard.evaluate(el => el.click());
      await page.waitForTimeout(3000); // Espera após clicar em "Create new card"

      log('👤 Selecionando cliente...');
      const botaoCliente = await page.locator('div:has-text("Cliente") >> text=Criar registro').first();
      await botaoCliente.click();
      await page.waitForTimeout(1000);
      await page.locator('input[placeholder*="cards pelo título"]').fill('143.461.936-25');
      await page.waitForTimeout(1500);
      await page.getByText('143.461.936-25', { exact: false }).first().click();
      log('✅ Cliente selecionado com sucesso');
      await page.getByText('*Cliente', { exact: true }).click(); // Clica na label para fechar o dropdown, se necessário
      await page.waitForTimeout(10000); // Espera longa, pode ser otimizada
      await page.keyboard.press('PageDown');

      log('🚗 Selecionando CRLV...');
      const botaoCRLV = await page.locator('text=Criar registro').nth(1);
      await botaoCRLV.scrollIntoViewIfNeeded();
      await botaoCRLV.click();
      await page.waitForTimeout(1000);
      await page.locator('input[placeholder*="cards pelo título"]').fill('OPB3D62');
      await page.waitForTimeout(1500);
      await page.getByText('OPB3D62', { exact: false }).first().click();
      log('✅ CRLV selecionado com sucesso');
      await page.waitForTimeout(1000); // Pequena espera após selecionar CRLV

      log('📌 Preenchendo dados (AIT e Órgão Autuador)...');
      try {
        const inputs = await page.locator('input[placeholder="Digite aqui ..."]');
        await inputs.nth(0).fill('AM09263379');
        log('✅ AIT preenchido');
        await inputs.nth(1).fill('Prefeitura de BH');
        log('✅ Órgão Autuador preenchido');
      } catch (e) {
        log(`❌ Erro ao preencher AIT e Órgão Autuador: ${e.message}`);
      }

      log('📆 Preenchendo campo "Prazo"...');
      try {
        const dia = await page.locator('[data-testid="day-input"]').first();
        const mes = await page.locator('[data-testid="month-input"]').first();
        const ano = await page.locator('[data-testid="year-input"]').first();
        const hora = await page.locator('[data-testid="hour-input"]').first();
        const minuto = await page.locator('[data-testid="minute-input"]').first();

        await dia.click(); await page.keyboard.type('09', { delay: 100 });
        await mes.click(); await page.keyboard.type('06', { delay: 100 });
        await ano.click(); await page.keyboard.type('2025', { delay: 100 });
        await hora.click(); await page.keyboard.type('08', { delay: 100 });
        await minuto.click(); await page.keyboard.type('00', { delay: 100 });
        log('✅ Prazo preenchido');
      } catch (e) {
        log(`❌ Erro ao preencher prazo: ${e.message}`);
      }

      log('📎 Anexando arquivo...');
      const urlPDF = 'https://www.africau.edu/images/default/sample.pdf';
      const nomePDF = 'anexo_semrgp.pdf'; // Nome único para este robô
      const caminhoPDF = path.resolve(__dirname, nomePDF);
      
      try {
        await baixarArquivo(urlPDF, caminhoPDF);

        const botaoUpload = await page.locator('button[data-testid="attachments-dropzone-button"]').last();
        const [fileChooser] = await Promise.all([
          page.waitForEvent('filechooser'),
          botaoUpload.click()
        ]);
        await fileChooser.setFiles(caminhoPDF);
        await page.waitForTimeout(3000); // Espera o upload

        const sucesso = await page.locator(`text="${nomePDF}"`).first().isVisible({ timeout: 7000 });
        if (sucesso) {
            log(`✅ Arquivo ${nomePDF} enviado com sucesso!`);
        } else {
            log(`❌ Falha no upload do arquivo ${nomePDF}.`);
        }

      } catch (e) {
        log(`❌ Erro ao baixar ou enviar arquivo anexo: ${e.message}`);
      } finally {
        if (fs.existsSync(caminhoPDF)) {
          fs.unlinkSync(caminhoPDF); // Limpa o arquivo temporário
        }
      }

      await page.keyboard.press('PageDown');
      await page.waitForTimeout(1000);
      await page.keyboard.press('PageDown');

      log('🚀 Finalizando card...');
      try {
        const botoes = await page.locator('button:has-text("Create new card")').all();
        let cardFinalizado = false;
        for (const botao of botoes) {
          const box = await botao.boundingBox();
          if (box && box.width > 200 && box.height > 30) {
            await botao.scrollIntoViewIfNeeded();
            await page.waitForTimeout(500); // Pequena espera antes do clique
            await botao.click();
            cardFinalizado = true;
            log('✅ Card finalizado com sucesso!');
            break;
          }
        }
        if (!cardFinalizado) {
            log('❌ Não foi possível encontrar o botão "Create new card" final.');
        }
      } catch (e) {
        log(`❌ Erro ao tentar finalizar o card: ${e.message}`);
      }

      log('📸 Print final da tela SEM RGP...');
      const printFinalSemRGP = path.resolve(__dirname, '../../prints/print_final_semrgp.png'); // Caminho ajustado
      if (!fs.existsSync(path.dirname(printFinalSemRGP))) {
          fs.mkdirSync(path.dirname(printFinalSemRGP), { recursive: true });
      }
      await page.screenshot({ path: printFinalSemRGP });
      log(`✅ Print salvo em ${path.basename(printFinalSemRGP)}`);

      await browser.close();
      log('✅ Robô SEM RGP finalizado com sucesso!');
      res.end('</pre><p><b>✅ Processo SEM RGP concluído.</b></p>');

    } catch (err) {
      log(`❌ Erro crítico no robô SEM RGP: ${err.message}`);
      console.error(err); // Logar o erro completo no console do servidor
      if (browser) await browser.close();
      res.end('</pre><p style="color:red"><b>❌ Erro ao executar robô SEM RGP.</b></p>');
    } finally {
      releaseLock(); // Garante que o lock seja liberado
    }
  }, 60000); // espera de 1 minuto (mantido conforme o original)
}

module.exports = { runSemRgpRobot };
