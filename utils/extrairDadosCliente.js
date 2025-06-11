// utils/extrairDadosCliente.js
const fs = require('fs');
const pdfParse = require('pdf-parse');

async function extrairDadosCliente(pathPdf) {
  const buffer = fs.readFileSync(pathPdf);
  const data = await pdfParse(buffer);
  const texto = data.text;

  // Expressões para capturar dados (ajuste se necessário conforme os PDFs)
  const nome = texto.match(/Nome\s*[:\-]?\s*(.+)/i)?.[1]?.trim();
  const cpf = texto.match(/CPF\s*[:\-]?\s*([\d.-]{11,})/i)?.[1]?.trim();
  const endereco = texto.match(/Endereço\s*[:\-]?\s*(.+)/i)?.[1]?.trim();
  const estadoCivil = texto.match(/Estado Civil\s*[:\-]?\s*(.+)/i)?.[1]?.trim();
  const profissao = texto.match(/Profissão\s*[:\-]?\s*(.+)/i)?.[1]?.trim();

  return {
    'Nome Completo': nome || '',
    'CPF OU CNPJ': cpf || '',
    'Estado Civil Atual': estadoCivil || '',
    'Profissão': profissao || '',
    'Endereço Completo': endereco || '',
  };
}

module.exports = { extrairDadosCliente };
