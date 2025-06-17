const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Renomeia um arquivo de forma segura, com nome único e extensão preservada.
 * @param {string} nomeBase - Prefixo do nome (ex: 'autuacao').
 * @param {string} caminhoOriginal - Caminho do arquivo recebido.
 * @returns {string} - Caminho final do novo arquivo.
 */
function normalizarArquivo(nomeBase, caminhoOriginal) {
  if (!fs.existsSync(caminhoOriginal)) {
    throw new Error(`Arquivo não encontrado: ${caminhoOriginal}`);
  }

  const dir = path.dirname(caminhoOriginal);
  const ext = path.extname(caminhoOriginal).toLowerCase();
  const hash = crypto.randomBytes(4).toString('hex'); // exemplo: 'a9f1c2d3'
  const nomeFinal = `${nomeBase}_${hash}${ext}`;
  const timestamp = Date.now();
  const novoCaminho = path.join(dir, `${nomeBase}_${timestamp}${ext}`);

  fs.renameSync(caminhoOriginal, novoCaminho);
  return novoCaminho;
}

module.exports = { normalizarArquivo };
