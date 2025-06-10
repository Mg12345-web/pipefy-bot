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
      const span = await page.locator('span:text("Create new card")').first();
      await span.scrollIntoViewIfNeeded();
      await span.evaluate(el => el.click());
      await page.waitForTimeout(3000);

    // CLIENTE
log('👤 Selecionando cliente...');
const botaoCliente = await page.locator('div:has-text("Cliente") >> :text("Criar registro")').first();
await botaoCliente.click();
await page.waitForSelector('input[placeholder*="Pesquisar"]', { timeout: 10000 }); // Espera o campo aparecer
await page.locator('input[placeholder*="Pesquisar"]').fill('143.461.936-25');
await page.waitForTimeout(1500);
await page.getByText('143.461.936-25', { exact: false }).first().click();
log('✅ Cliente selecionado');
await page.waitForTimeout(1000);
      await page.getByText('*Cliente', { exact: true }).click();
      await page.waitForTimeout(10000);
      await page.keyboard.press('PageDown');
      await page.waitForTimeout(1000);

      // CRLV
log('🚗 Selecionando CRLV...');

// Encontra a seção correta pelo título "Veículo (CRLV)" e clica no botão "Criar registro" dentro dela
const secaoCRLV = await page.locator('div:has-text("Veículo (CRLV)")').first();
const botaoCRLV = await secaoCRLV.locator('text=Criar registro').first();
await botaoCRLV.click();

// Aguarda o campo de pesquisa
await page.waitForSelector('input[placeholder*="Pesquisar"]', { timeout: 10000 });
await page.locator('input[placeholder*="Pesquisar"]').fill('OPB3D62');
await page.waitForTimeout(1500);

// Seleciona o item da lista
await page.getByText('OPB3D62', { exact: false }).first().click();
log('✅ CRLV selecionado com sucesso');
await page.waitForTimeout(1000);

      // OBSERVAÇÃO
      try {
  const valorObservacao = req.query.observacao || 'nada de observações';
  const campoObs = await page.getByLabel('Observação');
  await campoObs.scrollIntoViewIfNeeded();
  await campoObs.fill(valorObservacao);
  log('✅ Observação preenchida');
} catch (e) {
  log('❌ Campo Observação não encontrado ou ignorado');
}

     // 🧾 Preenchendo campos AIT e Órgão Autuador
try {
  const inputs = await page.locator('input[placeholder="Digite aqui ..."]');
  await inputs.nth(0).scrollIntoViewIfNeeded();
  await inputs.nth(0).fill('AM09263379');
  log('✅ AIT preenchido');

  await inputs.nth(1).scrollIntoViewIfNeeded();
  await inputs.nth(1).fill('Prefeitura de BH');
  log('✅ Órgão Autuador preenchido');
} catch (e) {
  log('❌ Erro ao preencher AIT ou Órgão Autuador');
}
      log('📆 Preenchendo campo "Prazo para Protocolo"...');

try {
  const segmentoDia = await page.locator('[data-testid="day-input"]').first();
  const segmentoMes = await page.locator('[data-testid="month-input"]').first();
  const segmentoAno = await page.locator('[data-testid="year-input"]').first();
  const segmentoHora = await page.locator('[data-testid="hour-input"]').first();
  const segmentoMinuto = await page.locator('[data-testid="minute-input"]').first();

  await segmentoDia.click();
  await page.keyboard.type('09', { delay: 100 });

  await segmentoMes.click();
  await page.keyboard.type('06', { delay: 100 });

  await segmentoAno.click();
  await page.keyboard.type('2025', { delay: 100 });

  await segmentoHora.click();
  await page.keyboard.type('08', { delay: 100 });

  await segmentoMinuto.click();
  await page.keyboard.type('00', { delay: 100 });

  log('✅ Prazo para Protocolo preenchido corretamente');
} catch (e) {
  log('❌ Erro ao preencher o campo Prazo para Protocolo');
}

      const urlPDF = 'https://www.africau.edu/images/default/sample.pdf';
      const nomePDF = 'anexo.pdf';
      const caminhoPDF = path.resolve(__dirname, nomePDF);
      await baixarArquivo(urlPDF, caminhoPDF);

      const botaoUpload = await page.locator('button[data-testid="attachments-dropzone-button"]').last();
      await botaoUpload.scrollIntoViewIfNeeded();
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        botaoUpload.click()
      ]);
      await fileChooser.setFiles(caminhoPDF);
      await page.waitForTimeout(3000);

      await page.keyboard.press('PageDown');
      await page.waitForTimeout(1000);
      await page.keyboard.press('PageDown');
      await page.waitForTimeout(1000);

      log('🚀 Finalizando card...');
       try {
  const botoes = await page.locator('button:has-text("Create new card")');
  const total = await botoes.count();
  for (let i = 0; i < total; i++) {
    const botao = botoes.nth(i);
    const box = await botao.boundingBox();
    if (box && box.width > 200 && box.height > 30) {
      await botao.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await botao.click();
      break;
    }
  }
      await page.screenshot({ path: printFinalCRLV });
  log('📸 Print final do CRLV salvo como print_final_crlv_semrgp.png');
} catch (e) {
  log('❌ Erro ao finalizar o card ou tirar print');
}

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
