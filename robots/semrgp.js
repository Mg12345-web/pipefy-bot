const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { acquireLock, releaseLock } = require('../utils/lock');
const { loginPipefy } = require('../utils/auth');
const { normalizarArquivo } = require('../utils/normalizarArquivo');

async function runSemRgpRobot(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.write('<pre>⏳ Preparando robô Sem RGP...\n');
  console.log('📥 Dados recebidos pelo robô Sem RGP:', JSON.stringify(req.body, null, 2));

  const log = msg => { res.write(msg + '\n'); console.log(msg); };
  if (!acquireLock()) {
    log('⛔ Robô já está em execução.');
    return res.end('</pre>');
  }

  let arquivos = [];
  if (req.files?.autuacoes?.length) {
    arquivos = req.files.autuacoes.map(f => f.path);
  }

  if (!arquivos.length && Array.isArray(req.body?.autuacoes)) {
    arquivos = req.body.autuacoes
      .map(a => (typeof a.arquivo === 'object' && a.arquivo?.path) ? a.arquivo.path : a.arquivo)
      .filter(Boolean);
  }

const { dados = {}, autuacoes = [] } = req.body;
console.log('📦 Conteúdo de autuacoes:', autuacoes);
const cpf = dados['CPF'] || '';
const placa = dados['Placa'] || req.body.placa || '';
autuacoes[0] = {
  ait: req.body.ait || dados['AIT'] || '',
  orgao: req.body.orgao || dados['Órgão Autuador'] || '',
  prazo: dados['Prazo para Protocolo'] || '',
  arquivo: arquivos[0] || ''
};

const ait = autuacoes[0].ait;
const orgao = autuacoes[0].orgao;
const prazo = autuacoes[0].prazo;

log(`📄 Dados extraídos: AIT=${ait} | Órgão=${orgao} | Prazo=${prazo}`);
  
  if (!arquivos.length) {
    log('❌ Nenhum arquivo de autuação recebido.');
    releaseLock();
    return res.end('</pre>');
  }

  log(`🔍 Buscando cliente com CPF: ${cpf}`);
  log(`🔍 Buscando CRLV com Placa: ${placa}`);

  const caminhoPDF = normalizarArquivo('autuacao', arquivos[0]); 
  let browser, page;

  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext();
    page = await context.newPage();

    await loginPipefy(page, log);

    log('📂 Acessando Pipe Sem RGP...');
    await page.getByText('Sem RGP', { exact: true }).click();
    await page.waitForTimeout(10000);

    const botaoPipe = page.locator('text=Entrar no pipe');
    if (await botaoPipe.count() > 0) {
      await botaoPipe.first().click();
      await page.waitForTimeout(10000);
    }

    log('🆕 Criando novo card...');
    await page.locator('span:text("Create new card")').first().click();
    await page.waitForTimeout(10000);

// 👤 Selecionando cliente...
log('👤 Selecionando cliente...');

// Abre o modal de seleção de cliente
const botaoCriarCliente = await page
  .locator('div:has-text("Clientes") >> button:has-text("Criar registro")')
  .first();
await botaoCriarCliente.click();

// Aguarda o input de busca
await page.waitForSelector('input[placeholder*="Pesquisar"]', { timeout: 15000 });
const clienteInput = page.locator('input[placeholder*="Pesquisar"]');

// Preenche o CPF dinamicamente vindo dos logs
await clienteInput.fill(cpf);
await page.waitForTimeout(1500);

// Aguarda e clica no card que contém exatamente o CPF
const clienteCard = page.locator(`div:has-text("${cpf}")`).first();
await clienteCard.waitFor({ state: 'visible', timeout: 15000 });
await clienteCard.click({ force: true });

log(`✅ Cliente ${cpf} selecionado`);

// Fecha o dropdown clicando no próprio label de "Clientes"
await page.locator('label:has-text("* Clientes")').first().click();
await page.waitForTimeout(1000);

// Scroll para garantir que a seção CRLV fique visível
await page.keyboard.press('PageDown');
await page.waitForTimeout(1000);

// ✅ Etapa: Selecionar botão "Criar registro" do CRLV dinâmico
log(`🚗 Selecionando CRLV ${placa}...`);
const botoesCriar = await page.locator('text=Criar registro');
const total = await botoesCriar.count();
log(`🧩 Encontrados ${total} botões 'Criar registro'`);

if (total >= 2) {
  const botaoCRLV = botoesCriar.nth(1); // geralmente o segundo é o do CRLV
  const box = await botaoCRLV.boundingBox();

  if (box && box.width > 0 && box.height > 0) {
    await botaoCRLV.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await botaoCRLV.click({ force: true });
    log('✅ Botão "Criar registro" do CRLV clicado com sucesso');
  } else {
    throw new Error('❌ Botão do CRLV invisível ou mal renderizado!');
  }
} else {
  throw new Error('❌ Botão de CRLV não encontrado!');
}

// ✅ Etapa: Preencher e selecionar o CRLV
try {
  await page.waitForSelector('input[placeholder*="Pesquisar"]', { timeout: 15000 });
  await page.locator('input[placeholder*="Pesquisar"]').fill(placa);
  await page.waitForTimeout(1500);

  // usa o atributo data-selector-card-title para garantir unicidade
  const opcaoCRLV = page.locator(`[data-selector-card-title="${placa}"]`).first();
  await opcaoCRLV.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await opcaoCRLV.click({ force: true });

  log(`✅ CRLV ${placa} selecionado com sucesso`);
} catch (e) {
  log('❌ Campo de pesquisa do CRLV não apareceu ou falhou');
  // snapshot de erro
  const erroPath = path.resolve(__dirname, '../../prints/print_crlv_erro.jpg');
  if (!fs.existsSync(path.dirname(erroPath))) {
    fs.mkdirSync(path.dirname(erroPath), { recursive: true });
  }
  await page.screenshot({ path: erroPath, fullPage: true });
  throw e;
}

    // Preenchimento
    const inputs = await page.locator('input[placeholder="Digite aqui ..."]');
    if (ait) { await inputs.nth(0).fill(ait); log('✅ AIT preenchido'); }
    if (orgao) { await inputs.nth(1).fill(orgao); log('✅ Órgão preenchido'); }

    // Prazo
    log('📆 Preenchendo campo "Prazo para Protocolo"...');
    const df = [
      '[data-testid="day-input"]',
      '[data-testid="month-input"]',
      '[data-testid="year-input"]',
      '[data-testid="hour-input"]',
      '[data-testid="minute-input"]'
    ];
    
    let val = ['','','','','']; // padrão
    try {
      const dt = new Date(prazo);
      if (!isNaN(dt)) {
        val = [
          String(dt.getDate()).padStart(2, '0'),
          String(dt.getMonth() + 1).padStart(2, '0'),
          String(dt.getFullYear()),
          '08', '00'
        ];
      } else {
        log('⚠️ Data inválida no campo "prazo". Usando valor padrão.');
      }
    } catch (err) {
      log('⚠️ Erro ao interpretar data de prazo. Usando valor padrão.');
    }

    for (let i = 0; i < df.length; i++) {
      const el = await page.locator(df[i]).first();
      await el.click();
      await page.keyboard.type(val[i], { delay: 100 });
    }
    log('✅ Prazo preenchido');

    // Upload
    log('📎 Anexando arquivo...');
    const botaoUpload = await page.locator('button[data-testid="attachments-dropzone-button"]').last();
    await botaoUpload.scrollIntoViewIfNeeded();
    const [fileChooser] = await Promise.all([page.waitForEvent('filechooser'), botaoUpload.click()]);
    await fileChooser.setFiles(caminhoPDF);
    await page.waitForTimeout(3000);
    log('📎 Autuação anexada');

    // Finalizar
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
