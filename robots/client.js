const { chromium } = require('playwright');
const path = require('path');
const { acquireLock, releaseLock } = require('../utils/lock');
const { loginPipefy } = require('../utils/auth');
const { baixarArquivo } = require('../utils/downloads');
const fs = require('fs'); // Necessário para operações de arquivo, como isVisible

/**
 * Executa o robô de cadastro de clientes no Pipefy.
 * @param {import('express').Request} req - Objeto de requisição do Express.
 * @param {import('express').Response} res - Objeto de resposta do Express.
 */
async function runClientRobot(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.write('<pre>🧠 Iniciando robô de CLIENTES...\n');

  function log(msg) {
    res.write(`${msg}\n`);
    console.log(msg);
  }

  // --- Lógica de Lock ---
  if (!acquireLock()) {
    log('⛔ Robô já em execução.');
    return res.end('</pre>');
  }

  let browser; // Declara a variável browser aqui para estar disponível no finally

  try {
    browser = await chromium.launch({
  headless: true,
  executablePath: '/usr/bin/google-chrome-stable', // Caminho explícito para o executável do Chromium
  args: ['--no-sandbox', '--disable-setuid-sandbox'] // Argumentos recomendados para Docker
});
    const context = await browser.newContext();
    const page = await context.newPage();

    await loginPipefy(page, log); // Chama a função de login centralizada

    log('📁 Acessando banco Clientes...');
    await page.getByText('Databases', { exact: true }).click();
    await page.getByText('Clientes', { exact: true }).click();
    await page.click('button:has-text("Criar registro")');
    await page.waitForTimeout(2000); // Adiciona uma pequena espera para a página carregar após "Criar registro"

    // Dados de exemplo para o cadastro do cliente
    const dados = {
      'Nome Completo': 'ADRIANO ANTONIO DE SOUZA',
      'CPF OU CNPJ': '414.746.148-41',
      'Estado Civil Atual': 'Solteiro',
      'Profissão': 'Vigilante',
      'Email': 'jonas1gui@gmail.com',
      'Número de telefone': '31988429016',
      'Endereço Completo': 'Rua Luzia de Jesus, 135, Jardim dos Comerciários, Ribeirão das Neves - MG'
      // O campo 'Placa' não faz sentido aqui e foi removido para clareza no cadastro de clientes.
      // Se for necessário adicionar campos especiais, trate-os individualmente.
    };

    for (const [campo, valor] of Object.entries(dados)) {
      try {
        // Tentativa de usar getByLabel primeiro, que é mais robusto para campos de formulário
        const labelLocator = page.getByLabel(campo);
        await labelLocator.scrollIntoViewIfNeeded();
        await labelLocator.fill(valor);
        log(`✅ ${campo} preenchido`);
      } catch (labelError) {
        // Se getByLabel falhar, tenta com input[placeholder] como fallback ou para campos específicos
        try {
            const inputPlaceholder = page.locator(`input[placeholder="${campo}"]`);
            await inputPlaceholder.scrollIntoViewIfNeeded();
            await inputPlaceholder.fill(valor);
            log(`✅ ${campo} (placeholder) preenchido`);
        } catch (placeholderError) {
             // Você pode adicionar mais tentativas aqui ou apenas logar a falha
            log(`❌ Não foi possível preencher o campo "${campo}": ${labelError.message || placeholderError.message}`);
        }
      }
    }

    log('📎 Anexando arquivos...');
    const arquivos = [
      { url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', nome: 'cnh_teste.pdf' },
      { url: 'https://www.africau.edu/images/default/sample.pdf', nome: 'proc_teste.pdf' }
    ];

    for (let i = 0; i < arquivos.length; i++) {
      const destino = path.resolve(__dirname, arquivos[i].nome);
      try {
        await baixarArquivo(arquivos[i].url, destino);
        const nomeArquivo = path.basename(destino);
        const botoesUpload = await page.locator('button[data-testid="attachments-dropzone-button"]');
        
        if (i >= await botoesUpload.count()) {
            log(`❌ Não há botão de upload disponível para o arquivo ${i + 1}.`);
            continue;
        }

        const botao = botoesUpload.nth(i);

        await botao.scrollIntoViewIfNeeded();
        const [fileChooser] = await Promise.all([
          page.waitForEvent('filechooser'),
          botao.click()
        ]);
        await fileChooser.setFiles(destino);
        await page.waitForTimeout(3000); // Esperar o upload do arquivo

        const sucesso = await page.locator(`text="${nomeArquivo}"`).first().isVisible({ timeout: 7000 });
        if (sucesso) {
          log(`✅ Arquivo ${i + 1} (${nomeArquivo}) enviado`);
        } else {
          log(`❌ Falha no upload do arquivo ${i + 1} (${nomeArquivo})`);
        }
      } catch (downloadOrUploadError) {
        log(`❌ Erro ao baixar ou enviar arquivo ${arquivos[i].nome}: ${downloadOrUploadError.message}`);
      } finally {
          // Limpa o arquivo temporário após o upload ou falha
          if (fs.existsSync(destino)) {
              fs.unlinkSync(destino);
          }
      }
    }

    log('✅ Tentando criar registro...');
    // Lógica mais robusta para encontrar e clicar no botão "Criar registro" final
    const botoesRegistro = await page.locator('button:has-text("Criar registro")').all();
    let registroCriado = false;
    for (const botao of botoesRegistro) {
        const box = await botao.boundingBox();
        if (box && box.width > 100 && box.height > 20) { // Filtros para encontrar o botão correto
            await botao.scrollIntoViewIfNeeded();
            await page.waitForTimeout(500); // Pequena espera antes do clique
            await botao.click();
            registroCriado = true;
            log('✅ Registro de cliente criado com sucesso!');
            break;
        }
    }

    if (!registroCriado) {
        log('❌ Não foi possível encontrar o botão "Criar registro" final.');
    }


    log('📸 Print final da tela de clientes...');
    const printPath = path.resolve(__dirname, '../../prints/print_final_clientes.png'); // Caminho relativo ajustado
    if (!fs.existsSync(path.dirname(printPath))) { // Garante que a pasta 'prints' existe
        fs.mkdirSync(path.dirname(printPath), { recursive: true });
    }
    await page.screenshot({ path: printPath });
    log(`✅ Print salvo em ${path.basename(printPath)}`);

    await browser.close();
    res.end('</pre><h3>✅ Cadastro de cliente concluído!</h3>');

  } catch (err) {
    log(`❌ Erro crítico no robô de cliente: ${err.message}`);
    console.error(err); // Logar o erro completo no console do servidor
    if (browser) await browser.close();
    res.end('</pre><p style="color:red">Erro crítico no robô de cliente. Verifique os logs.</p>');
  } finally {
    releaseLock(); // Garante que o lock seja liberado
  }
}

module.exports = { runClientRobot };
