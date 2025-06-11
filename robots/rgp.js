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
     
// ✅ Etapa: Fechar janela flutuante e posicionar a tela
log('🚗 Preparando para selecionar CRLV...');

const campoEstavel = await page.locator('input[placeholder="Digite aqui ..."]').first();
await campoEstavel.scrollIntoViewIfNeeded();
await campoEstavel.click();
await page.waitForTimeout(1000);

// Scroll para garantir que a seção CRLV esteja visível
await page.keyboard.press('PageDown');
await page.waitForTimeout(1000);

// ✅ Etapa: Selecionar botão "Criar registro" do CRLV
log('🚗 Selecionando CRLV...');
const botoesCriar = await page.locator('text=Criar registro');
const total = await botoesCriar.count();
log(`🧩 Encontrados ${total} botões 'Criar registro'`);

if (total >= 2) {
  const botaoCRLV = botoesCriar.nth(1); // segundo botão geralmente é o do CRLV
  const box = await botaoCRLV.boundingBox();

  if (box && box.width > 0 && box.height > 0) {
    await botaoCRLV.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    await botaoCRLV.click();
    log('✅ Botão "Criar registro" do CRLV clicado com sucesso');
  } else {
    throw new Error('❌ Botão do CRLV invisível ou mal renderizado!');
  }
} else {
  throw new Error('❌ Botão de CRLV não encontrado!');
}

// ✅ Etapa: Preencher campo de busca do CRLV
try {
  await page.waitForSelector('input[placeholder*="Pesquisar"]', { timeout: 15000 });
  await page.locator('input[placeholder*="Pesquisar"]').fill('OPB3D62');
  await page.waitForTimeout(1500);

  const opcaoCRLV = await page.getByText('OPB3D62', { exact: false }).first();
  await opcaoCRLV.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await opcaoCRLV.click();

  log('✅ CRLV selecionado com sucesso');
} catch (e) {
  log('❌ Campo de pesquisa do CRLV não apareceu ou falhou');

  const erroPath = path.resolve(__dirname, '../../prints/print_crlv_erro.jpg');
  if (!fs.existsSync(path.dirname(erroPath))) {
    fs.mkdirSync(path.dirname(erroPath), { recursive: true });
  }

  try {
    await page.screenshot({ path: erroPath, type: 'jpeg', quality: 80 });
    const base64Erro = fs.readFileSync(erroPath).toString('base64');
    res.write(`<h3>🖼️ Print de erro CRLV (JPG):</h3>`);
    res.write(`<img src="data:image/jpeg;base64,${base64Erro}" style="max-width:100%; border:1px solid #ccc;">`);
  } catch {
    log('⚠️ Falha ao salvar print de erro do CRLV');
  }

  throw new Error('❌ Falha ao selecionar CRLV');
}

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

// PRINT final
const caminhoPrint = path.resolve(__dirname, '../../prints/print_final_rgp.png');
if (!fs.existsSync(path.dirname(caminhoPrint))) {
  fs.mkdirSync(path.dirname(caminhoPrint), { recursive: true });
}
await page.screenshot({ path: caminhoPrint });
log(`📸 Print salvo como ${path.basename(caminhoPrint)}`);

await browser.close();

// 🖼️ Mostra print de debug no navegador
const base64debug = fs.readFileSync(debugPath).toString('base64');
res.write('<h3>🖼️ Tela após clicar em CRLV:</h3>');
res.write(`<img src="data:image/jpeg;base64,${base64debug}" style="max-width:100%; border:1px solid #ccc;">`);

res.end('</pre><h3>✅ Processo RGP concluído com sucesso</h3><p><a href="/">⬅️ Voltar</a></p>');

} catch (err) {
  log(`❌ Erro crítico: ${err.message}`);

  const erroPath = path.resolve(__dirname, '../../prints/print_erro_debug.jpg');
  if (!fs.existsSync(path.dirname(erroPath))) {
    fs.mkdirSync(path.dirname(erroPath), { recursive: true });
  }

  try {
    if (page) {
      await page.screenshot({ path: erroPath, type: 'jpeg', quality: 80 });
      log(`📸 Print de erro salvo como ${path.basename(erroPath)}`);

      const base64Erro = fs.readFileSync(erroPath).toString('base64');
      res.write(`<h3>🖼️ Print do erro (JPG):</h3>`);
      res.write(`<img src="data:image/jpeg;base64,${base64Erro}" style="max-width:100%; border:1px solid #ccc;">`);
    } else {
      log('⚠️ Página não estava disponível para capturar print.');
    }
  } catch (e) {
    log('⚠️ Falha ao gerar ou exibir o print de erro.');
  }

  if (page) {
  const erroPath = path.resolve(__dirname, '../../prints/print_erro_debug.jpg');
  await page.screenshot({ path: erroPath, type: 'jpeg', quality: 80 });
  const base64Erro = fs.readFileSync(erroPath).toString('base64');
  res.write(`<h3>🖼️ Print do erro (JPG):</h3>`);
  res.write(`<img src="data:image/jpeg;base64,${base64Erro}" style="max-width:100%; border:1px solid #ccc;">`);
}
if (browser) await browser.close();
res.end('</pre><p style="color:red"><b>❌ Erro ao executar robô RGP.</b></p>');

}
finally {
  releaseLock();
}
  }, 60000);
}

module.exports = { runRgpRobot };
