const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { loginPipefy } = require('../utils/auth');
const { acquireLock, releaseLock } = require('../utils/lock');

async function runClientRobot(req, res) {
  const dados = req.body?.dados || {};
  const arquivos = req.files || {};

  const nome = dados.nome_completo || dados['Nome Completo'] || '';
  const cpf = dados.cpf || dados['CPF'] || dados['CPF OU CNPJ'] || '';
  const estadoCivil = dados['Estado Civil'] || '';
  const profissão = dados['Profissão'] || '';
  const Email = dados.Email || '';
  const Númerodetelefone = dados['Número de telefone'] || '';
  const endereçocompleto = dados['Endereço Completo'] || '';

  const log = msg => {
    console.log(msg);
    res?.write?.(msg + '\n');
  };

  console.log('📤 Preenchendo formulário com os dados:');
  console.log({ nome, cpf, estadoCivil, profissao, email, telefone, endereçocompleto });
  
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
    await page.getByText('Databases', { exact: true }).click();
    await page.getByText('Clientes', { exact: true }).click();
    await page.click('button:has-text("Criar registro")');
    await page.waitForTimeout(2000);

    const botaoEntrar = page.locator('text=Entrar no pipe');
    if (await botaoEntrar.count() > 0) {
      log('📥 Clicando em "Entrar no pipe"...');
      await botaoEntrar.first().click();
      await page.waitForTimeout(2000);
    }

    const campos = [
      ['Nome Completo', nome],
      ['CPF OU CNPJ', cpf],
      ['Estado Civil Atual', estadoCivil],
      ['Profissão', profissao],
      ['Email', email],
      ['Número de telefone', telefone],
      ['Endereço Completo', enderecoCompleto]
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
        // 1º botão: CNH
if (label === 'CNH') {
  const botaoCNH = page.locator('text=Adicionar novos arquivos').nth(0);
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    botaoCNH.click()
  ]);
  await fileChooser.setFiles(files.map(f => f.path));
  log(`📎 Arquivo(s) anexado(s) no campo CNH`);
}

// 2º botão: Procuração + contrato
if (label === 'Procuração + contrato') {
  const botaoProc = page.locator('text=Adicionar novos arquivos').nth(1);
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    botaoProc.click()
  ]);
  await fileChooser.setFiles(files.map(f => f.path));
  log(`📎 Arquivo(s) anexado(s) no campo Procuração + contrato`);
}
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
    const botoes = await page.$$('button');
    for (let i = 0; i < botoes.length; i++) {
      const texto = await botoes[i].innerText();
      const box = await botoes[i].boundingBox();
      if (texto.trim() === 'Criar registro' && box && box.width > 200) {
        await botoes[i].scrollIntoViewIfNeeded();
        await botoes[i].click();
        console.log('✅ Registro de cliente criado');
        break;
      }
    }
    
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
