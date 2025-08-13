// rgpRobot.js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { acquireLock, releaseLock } = require('../utils/lock');
const { loginPipefy } = require('../utils/auth');
const { normalizarArquivo } = require('../utils/normalizarArquivo');

// ===== Helpers de normalização e digitação =====
const onlyDigits = (s='') => (s || '').replace(/\D+/g, '');
const toCpfMask = (cpfDigits) =>
  cpfDigits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
const normCPF = (s='') => onlyDigits(s);
const normPlaca = (s='') => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

async function typeSlow(locator, value) {
  await locator.click({ clickCount: 3 });
  for (const ch of String(value)) await locator.type(ch);
  await locator.press('Tab');
}

function parseDDMMYYYY(s='') {
  const m = s.trim().match(/^(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})$/);
  if (!m) return null;
  const [ , dd, mm, yyyy ] = m;
  return { dd, mm, yyyy };
}

// Encontra o "painel" do campo (a caixa com título + Pesquisar + lista)
async function getFieldPanel(page, titulo) {
  await page.getByText(titulo, { exact: true }).click();

  // Painel costuma ser um section/div que contem o título e a caixa "Pesquisar"
  const panel = page.locator('section, div').filter({
    has: page.getByText(titulo, { exact: true }),
    has: page.getByPlaceholder(/Pesquisar/i)
  }).first();

  await panel.waitFor({ state: 'visible', timeout: 10000 });
  return panel;
}

// =================================================

async function runRgpRobot(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.write('<pre>⏳ Preparando robô RGP...\n');
  console.log('📥 Dados recebidos pelo robô RGP:', JSON.stringify(req.body, null, 2));

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
  let browser, context, page;

  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    context = await browser.newContext({
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo'
    });
    page = await context.newPage();

    await loginPipefy(page, log);

    log('📂 Acessando Pipe RGP...');
    await page.getByText('RGP', { exact: true }).click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('networkidle');

    const botaoPipe = page.locator('text=Entrar no pipe');
    if (await botaoPipe.count() > 0) {
      await botaoPipe.first().click();
      await page.waitForLoadState('networkidle');
    }

    await abrirNovoCardPreCadastro(page, log);
    await selecionarCliente(page, cpf, log);
    await selecionarCRLV(page, placa, log);
    await preencherAIT(page, ait, log);
    await preencherOrgao(page, orgao, log);
    await preencherPrazoParaProtocoloMascarado(page, prazo, log);
    await anexarAutuacao(page, caminhoPDF, log);

    log('🚀 Finalizando card...');
    const botoesFinal = page.locator('button:has-text("Create new card")');
    for (let i = 0, n = await botoesFinal.count(); i < n; i++) {
      const b = botoesFinal.nth(i);
      const box = await b.boundingBox();
      if (box && box.width > 200) {
        await b.scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
        await b.click();
        break;
      }
    }

    const printPath = path.resolve(__dirname, '../../prints/print_final_rgp.png');
    fs.mkdirSync(path.dirname(printPath), { recursive: true });
    await page.screenshot({ path: printPath });

    log(`📸 Print final salvo: ${path.basename(printPath)}`);
    await browser.close();

    const img = fs.readFileSync(printPath).toString('base64');
    res.write(`<img src="data:image/png;base64,${img}" style="max-width:100%">`);
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
    try {
      if (req.body?.ultimaTarefa && fs.existsSync(caminhoPDF)) {
        fs.unlinkSync(caminhoPDF);
        console.log('🧹 Arquivo da autuação apagado com sucesso.');
      }
    } catch (e) {
      console.warn('⚠️ Falha ao apagar o arquivo da autuação:', e.message);
    }
    releaseLock();
  }
}

// ===== Funções auxiliares =====

async function abrirNovoCardPreCadastro(page, log = console.log) {
  log('📂 Abrindo novo card em "Pré-cadastro"...');
  const botaoNovoCard = page
    .getByTestId('phase-328258629-container')
    .getByTestId('new-card-button');
  await botaoNovoCard.click();
  log('✅ Novo card criado com sucesso.');
}

// Seleciona cliente via painel embutido do campo "Clientes"
async function selecionarCliente(page, cpf, log = console.log) {
  const cpfDigits = normCPF(cpf);
  if (!cpfDigits) throw new Error('CPF vazio para seleção de cliente');
  const cpfMasked = toCpfMask(cpfDigits);
  const cpfRegex = new RegExp(cpfMasked.replace(/\./g, '\\.').replace('-', '-'));

  log('👤 Acessando seção de clientes (painel embutido)...');
  const panel = await getFieldPanel(page, 'Clientes');

  const search = panel.getByPlaceholder(/Pesquisar/i);
  await search.waitFor({ state: 'visible', timeout: 10000 });
  await search.fill('');
  await typeSlow(search, cpfDigits);

  // aguarda algum resultado
  const results = panel.locator('div').filter({ hasText: /\S/ });
  await results.first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});

  // tenta match com CPF mascarado
  let candidato = panel.locator('div').filter({ hasText: cpfRegex }).first();
  if (!(await candidato.count())) {
    // fallback: últimos 4 dígitos
    const last4 = cpfDigits.slice(-4);
    candidato = panel.locator('div').filter({ hasText: new RegExp(last4) }).first();
  }

  if (await candidato.count()) {
    await candidato.click();
    await page.getByText('Clientes', { exact: true }).click(); // recolhe painel
    log(`✅ Cliente selecionado (${cpfMasked})`);
    return;
  }

  // fallback: criar registro
  const criar = panel.getByRole('button', { name: /\+?\s*Criar registro/i });
  if (await criar.count()) {
    await criar.click();
    log('ℹ️ Nenhum cliente encontrado — cliquei em "+ Criar registro". (implemente aqui o preenchimento do novo registro)');
    return;
  }

  throw new Error(`Não encontrei cliente com CPF ${cpfMasked}.`);
}

// Seleciona CRLV via painel embutido do campo "Veículo (CRLV)"
async function selecionarCRLV(page, placa, log = console.log) {
  const placaNorm = normPlaca(placa);
  if (!placaNorm) throw new Error('Placa vazia para seleção de CRLV');

  log('🚗 Selecionando CRLV (painel embutido)...');
  const panel = await getFieldPanel(page, 'Veículo (CRLV)');

  const search = panel.getByPlaceholder(/Pesquisar/i);
  await search.waitFor({ state: 'visible', timeout: 10000 });
  await search.fill('');
  await typeSlow(search, placaNorm);

  const results = panel.locator('div').filter({ hasText: /\S/ });
  await results.first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});

  // aceita placa com/sem hífen/espaço
  const placaRegex = new RegExp(placaNorm.split('').join('[- ]?'), 'i');
  const candidato = panel.locator('div').filter({ hasText: placaRegex }).first();

  if (await candidato.count()) {
    await candidato.click();
    await page.getByText('Veículo (CRLV)', { exact: true }).click();
    log(`✅ CRLV selecionado para ${placaNorm}`);
    return;
  }

  const criar = panel.getByRole('button', { name: /\+?\s*Criar registro/i });
  if (await criar.count()) {
    await criar.click();
    log('ℹ️ Nenhum CRLV encontrado — cliquei em "+ Criar registro".');
    return;
  }

  throw new Error(`Não encontrei CRLV para a placa ${placaNorm}.`);
}

async function preencherAIT(page, ait, log = console.log) {
  if (!ait) {
    log('⚠️ Nenhum número de AIT fornecido. Pulando etapa.');
    return;
  }
  log('📝 Preenchendo campo AIT...');
  await page.getByTestId('phase-fields').getByText('AIT').click();
  const inputAIT = page.getByRole('textbox', { name: 'AIT' });
  await inputAIT.click();
  await inputAIT.fill(ait);
  await inputAIT.press('Tab');
  log(`✅ AIT preenchido: ${ait}`);
}

async function preencherOrgao(page, orgao, log = console.log) {
  if (!orgao) {
    log('⚠️ Nenhum órgão fornecido. Pulando etapa.');
    return;
  }
  log('🏛️ Preenchendo campo Órgão...');
  await page.getByTestId('phase-fields').getByText('Órgão').click();
  const input = page.getByRole('textbox', { name: 'Órgão' });
  await input.fill(orgao);
  await input.press('Tab');
  log(`✅ Órgão preenchido: ${orgao}`);
}

// Campo único com máscara DD/MM/AAAA, --:-- (digitar parte a parte)
async function preencherPrazoParaProtocoloMascarado(page, prazo, log = console.log) {
  log('🗓️ Preenchendo "Prazo para Protocolo"...');

  let dd, mm, yyyy;
  const parsed = parseDDMMYYYY(prazo || '');
  if (parsed) ({ dd, mm, yyyy } = parsed);
  else {
    const now = new Date();
    dd = String(now.getDate()).padStart(2, '0');
    mm = String(now.getMonth() + 1).padStart(2, '0');
    yyyy = String(now.getFullYear());
  }
  const hora = '00';
  const minuto = '00';

  // localiza pelo placeholder (varia pouco)
  const input = page.getByPlaceholder(/DD\/MM\/AAAA/);
  await input.waitFor({ state: 'visible', timeout: 7000 });
  await input.click({ clickCount: 3 });

  // Digita cada parte e avança com setas para respeitar a máscara
  await page.keyboard.type(dd, { delay: 100 });
  await page.keyboard.press('ArrowRight');
  await page.keyboard.type(mm, { delay: 100 });
  await page.keyboard.press('ArrowRight');
  await page.keyboard.type(yyyy, { delay: 100 });

  // Se existir a parte de hora/minuto, avance e preencha
  // Mesmo sem checar DOM, as setas apenas não terão efeito se não houver máscara de hora
  await page.keyboard.press('ArrowRight');
  await page.keyboard.type(hora, { delay: 100 }).catch(() => {});
  await page.keyboard.press('ArrowRight');
  await page.keyboard.type(minuto, { delay: 100 }).catch(() => {});
  await input.press('Tab');

  log(`✅ Prazo preenchido: ${dd}/${mm}/${yyyy} ${hora}:${minuto}`);
}

async function anexarAutuacao(page, caminhoPDF, log = console.log) {
  log('📎 Anexando arquivo da autuação...');
  const botaoUpload = page.locator('button[data-testid="attachments-dropzone-button"]').last();
  await botaoUpload.scrollIntoViewIfNeeded();

  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    botaoUpload.click()
  ]);

  await fileChooser.setFiles(caminhoPDF);
  await page.waitForTimeout(2000);

  // opcional: confirmar que um PDF apareceu na lista
  await page.waitForSelector('[data-testid="attachment-list"]', { timeout: 8000 }).catch(() => {});
  log(`✅ Autuação anexada: ${caminhoPDF}`);
}

module.exports = { runRgpRobot };
