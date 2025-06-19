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

    // 📂 Acessando diretamente o formulário público do Sem RGP
log('📂 Acessando formulário público Sem RGP...');
await page.goto(
  'https://app.pipefy.com/organizations/301364637/interfaces/9e30a2d5-652a-4590-85c5-f254756c9692/pages/bcf9976f-0e7a-4606-ab2c-8cca4bb1680c'
  + '?form=78b8b5ff-5f9c-46fa-9251-228f2a21ab4a&origin=public+form'
);
await page.waitForLoadState('networkidle');

log('👤 Selecionando cliente...');
// 1) Abre o conector de cliente
await page
  .getByTestId('element-startform-78b8b5ff-5f9c-46fa-9251-228f2a21ab4a-Connector-68050cba-bc72-4fbc-b00d-3f62b8fa6a96')
  .getByTestId('star-form-connection-button')
  .click();

// 2) Preenche o CPF e aguarda resultados
await page.getByRole('textbox', { name: 'Pesquisar' }).fill(cpf);
await page.waitForTimeout(1_500);

// 3) Clica sempre no primeiro card exato
const cardCli = page
  .locator('div[data-testid^="connected-card-box"]')
  .filter({ hasText: cpf })
  .first();
await cardCli.waitFor({ state: 'visible', timeout: 15000 });
await cardCli.click({ force: true });
log(`✅ Cliente ${cpf} selecionado`);

// 🚗 Selecionando CRLV...
log('🚗 Selecionando CRLV...');
// 1) Abre o conector de CRLV
await page
  .getByTestId('element-startform-78b8b5ff-5f9c-46fa-9251-228f2a21ab4a-Connector-abc0d7e3-6e0f-4afd-91b6-dd453eead783')
  .getByTestId('star-form-connection-button')
  .click();

// 2) Preenche a placa e aguarda resultados
await page.getByRole('textbox', { name: 'Pesquisar' }).fill(placa);
await page.waitForTimeout(1_500);

// 3) Clica sempre no primeiro card exato
const cardCRLV = page
  .locator('div[data-testid^="connected-card-box"]')
  .filter({ hasText: placa })
  .first();
await cardCRLV.waitFor({ state: 'visible', timeout: 15000 });
await cardCRLV.click({ force: true });
log(`✅ CRLV ${placa} selecionado com sucesso`);

    // — AIT
if (ait) {
  const aitInput = page.getByLabel('AIT');
  await aitInput.waitFor({ state: 'visible', timeout: 15_000 });
  await aitInput.fill(ait);
  log('✅ AIT preenchido');
}

// — Órgão
if (orgao) {
  const orgInput = page.getByLabel('Órgão');
  await orgInput.waitFor({ state: 'visible', timeout: 15_000 });
  await orgInput.fill(orgao);
  log('✅ Órgão preenchido');
}

// — Observação (se houver)
if (obs) {
  const obsInput = page.getByLabel('Observação');
  await obsInput.waitFor({ state: 'visible', timeout: 15_000 });
  await obsInput.fill(obs);
  log('✅ Observação preenchida');
}

// — Prazo para Protocolo (cada parte tem um data-testid)
log('🕒 Preenchendo "Prazo para Protocolo"...');
await page.getByTestId('day-input').fill(String(df.day));
await page.getByTestId('month-input').fill(String(df.month));
await page.getByTestId('year-input').fill(String(df.year));
await page.getByTestId('hour-input').fill(String(df.hour));
await page.getByTestId('minute-input').fill(String(df.minute));
log('✅ Prazo para Protocolo preenchido');
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
