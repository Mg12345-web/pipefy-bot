const fs = require('fs');
const path = require('path');

/**
 * Renomeia um arquivo mantendo sua extensão original para um nome padrão.
 * @param {string} nomeBase - Nome desejado para o arquivo (sem extensão).
 * @param {string} caminhoOriginal - Caminho atual do arquivo.
 * @returns {string} - Novo caminho do arquivo renomeado.
 */
function normalizarArquivo(nomeBase, caminhoOriginal) {
  if (!fs.existsSync(caminhoOriginal)) {
    throw new Error(`Arquivo não encontrado: ${caminhoOriginal}`);
  }

  const dir = path.dirname(caminhoOriginal);
  const ext = path.extname(caminhoOriginal).toLowerCase();
  const novoCaminho = path.join(dir, `${nomeBase}${ext}`);

  if (caminhoOriginal !== novoCaminho) {
    fs.renameSync(caminhoOriginal, novoCaminho);
  }

  return novoCaminho;
}

module.exports = { normalizarArquivo };
