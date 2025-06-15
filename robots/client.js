const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { loginPipefy } = require('../utils/auth');
const { acquireLock, releaseLock } = require('../utils/lock');

async function runClientRobot(req, res) {
  const dados = req.body?.dados || {};
  const arquivos = req.files || {};

  const nome = dados['Nome Completo'] || '';
  const cpf = dados['CPF OU CNPJ'] || '';
  const estadoCivil = dados['Estado Civil'] || '';
  const profissao = dados['Profissão'] || '';
  const email = dados.Email || '';
  const telefone = dados['Número de telefone'] || '';

  const log = msg => {
    console.log(msg);
    res?.write?.(msg + '\n');
  };

  res?.setHeader?.('Content-Type', 'text/html; charset=utf-8');
  res?.write?.('<pre>🤖 Iniciando robô de CLIENTES...\n');

  if (!acquireLock()) {
    log('⛔ Robô já está em execução.');
    return res?.end?.('</pre>');
  }

  log('📤 Dados recebidos:');
  log(JSON.stringify(dados, null, 2));

  let browser, page;
  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext();
    page = await context.newPage();

    log('🔐 Fazendo login no Pipefy...');
    await loginPipefy(page, log);

    log('📁 Acessando Pipe Clientes...');
    await page.getByText('Clientes', { exact: true }).click();
    await page.waitForTimeout(2000);

    const botaoEntrar = page.locator('text=Entrar no pipe');
    if (await botaoEntrar.count() > 0) {
      log('📥 Clicando em "Entrar no pipe"...');
      await botaoEntrar.first().click();
      await page.waitForTimeout(2000);
    }

    log('🆕 Criando novo card...');
    await page.locator('span:text("Create new card")').first().click();
    await page.waitForTimeout(2000);

    const campos = [
      ['Nome Completo', nome],
      ['CPF OU CNPJ', cpf],
      ['Estado Civil Atual', estadoCivil],
      ['Profissão', profissao],
      ['Email', email],
      ['Número de telefone', telefone],
    ];

    for (const [campo, valor] of campos) {
      if (!valor) {
        log(`⚠️ Campo "${campo}" vazio, pulando...`);
        continue;
      }

      try {
        const input = page.getByLabel(campo);
        await input.fill(valor);
        log(`✍️ Campo preenchido: ${campo}`);
        await page.waitForTimeout(300);
      } catch (e) {
        log(`⚠️ Falha ao preencher o campo: ${campo} – ${e.message}`);
      }
    }

    // Uploads
    const anexar = async (label, files) => {
      if (!files || files.length === 0) return;
      try {
        const el = page.locator(`text=${label}`).first();
        const [fileChooser] = await Promise.all([
          page.waitForEvent('filechooser'),
          el.click()
        ]);
        await fileChooser.setFiles(files.map(f => f.path));
        log(`📎 Arquivo(s) anexado(s) em ${label}`);
      } catch (e) {
        log(`⚠️ Falha ao anexar em ${label}: ${e.message}`);
      }
    };

    await anexar('CNH', arquivos.cnh);
    await anexar('Procuração + contrato', [
      ...(arquivos.procuracao || []),
      ...(arquivos.contrato || [])
    ]);

    log('💾 Enviando formulário...');
    await page.locator('button:has-text("Criar registro")').click();
    await page.waitForTimeout(3000);

    const printPath = path.resolve(__dirname, '../../prints/print_final_clientes.png');
    fs.mkdirSync(path.dirname(printPath), { recursive: true });
    await page.screenshot({ path: printPath });

    log('🖼️ Print salvo como print_final_clientes.png');
    await browser.close();
    res?.end?.('</pre><h3>✅ Cadastro de cliente concluído!</h3><p><a href="/">⬅️ Voltar</a></p>');

  } catch (err) {
    log(`❌ Erro: ${err.message}`);
    if (page) {
      const erroPath = path.resolve(__dirname, '../../prints/erro_clientes.png');
      fs.mkdirSync(path.dirname(erroPath), { recursive: true });
      await page.screenshot({ path: erroPath });
    }
    if (browser) await browser.close();
    res?.end?.('</pre><h3 style="color:red">❌ Erro no robô de clientes.</h3>');
  } finally {
    releaseLock();
  }
}

module.exports = { runClientRobot };
