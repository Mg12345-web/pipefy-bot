const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { acquireLock, releaseLock } = require('../utils/lock');
const { loginPipefy } = require('../utils/auth');

// 🔍 Função para extrair os dados da procuração
async function extrairDadosDaProcuracao(caminhoPDF) {
  const dataBuffer = fs.readFileSync(caminhoPDF);
  const texto = (await pdfParse(dataBuffer)).text;

  const nome = texto.match(/(?:Nome|NOME):?\s*([A-Z\s]{5,})/)?.[1]?.trim();
  const cpf = texto.match(/CPF[:\s]*([\d\.\-]{11,})/)?.[1]?.trim();
  const estadoCivil = texto.match(/Estado Civil:?\s*([A-Za-zçãéíõú\s]+)/i)?.[1]?.trim();
  const profissao = texto.match(/Profissão:?\s*([A-Za-zçãéíõú\s]+)/i)?.[1]?.trim();
  const endereco = texto.match(/residente e domiciliado à\s*(.*?CEP.*)/i)?.[1]?.trim();

  return {
    'Nome Completo': nome || '',
    'CPF OU CNPJ': cpf || '',
    'Estado Civil Atual': estadoCivil || '',
    'Profissão': profissao || '',
    'Endereço Completo': endereco || ''
  };
}

async function runClientRobot(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.write('<pre>🤖 Iniciando robô de CLIENTES...\n');

  const log = (msg) => {
    res.write(`${msg}\n`);
    console.log(msg);
  };

  if (!acquireLock()) {
    log('⛔ Robô já está em execução.');
    return res.end('</pre>');
  }

  const arquivos = req.files || {};
  const emailManual = req.body?.email || '';
  const telefoneManual = req.body?.telefone || '';
  const arquivoProcuracao = arquivos?.procuracao?.[0]?.path;

  let browser;

  try {
    if (!arquivoProcuracao || !fs.existsSync(arquivoProcuracao)) {
      throw new Error('❌ Arquivo de procuração não encontrado.');
    }

    const dadosExtraidos = await extrairDadosDaProcuracao(arquivoProcuracao);
    const dados = {
      ...dadosExtraidos,
      'Email': emailManual,
      'Número de telefone': telefoneManual
    };

    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    await loginPipefy(page, log);
    log('📁 Acessando banco "Clientes"...');

    await page.getByText('Databases', { exact: true }).click();
    await page.getByText('Clientes', { exact: true }).click();
    await page.click('button:has-text("Criar registro")');
    await page.waitForTimeout(2000);

    for (const [campo, valor] of Object.entries(dados)) {
      try {
        const labelLocator = page.getByLabel(campo);
        await labelLocator.scrollIntoViewIfNeeded();
        await labelLocator.fill(valor);
        log(`✅ ${campo} preenchido`);
      } catch {
        log(`⚠️ Campo não encontrado: ${campo}`);
      }
    }

    // Envio de arquivos CNH + procuração (campo agrupado)
    if (arquivos.cnh && arquivos.procuracao) {
      const anexos = [arquivos.cnh[0].path, arquivos.procuracao[0].path];
      for (const caminho of anexos) {
        const botao = await page.locator('button[data-testid="attachments-dropzone-button"]').first();
        const [fileChooser] = await Promise.all([page.waitForEvent('filechooser'), botao.click()]);
        await fileChooser.setFiles(caminho);
        await page.waitForTimeout(1500);
        log(`📎 Anexo enviado: ${path.basename(caminho)}`);
      }
    }

    log('✅ Criando registro...');
    const botaoCriar = await page.getByText('Criar registro', { exact: true });
    await botaoCriar.scrollIntoViewIfNeeded();
    await botaoCriar.click();

    const printPath = path.resolve(__dirname, '../../prints/print_final_clientes.png');
    if (!fs.existsSync(path.dirname(printPath))) fs.mkdirSync(path.dirname(printPath), { recursive: true });
    await page.screenshot({ path: printPath });
    log(`📸 Print salvo como ${path.basename(printPath)}`);

    await browser.close();
    res.end('</pre><h3>✅ Cadastro de cliente concluído!</h3><p><a href="/">⬅️ Voltar</a></p>');

  } catch (err) {
    log(`❌ Erro crítico: ${err.message}`);
    if (browser) await browser.close();
    res.end('</pre><p style="color:red">Erro no robô. Verifique os logs.</p>');
  } finally {
    releaseLock();
  }
}

module.exports = { runClientRobot };
