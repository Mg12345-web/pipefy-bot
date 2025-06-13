// extrairDadosProcuracaoPorPadrao.js
const fs = require('fs');
const Tesseract = require('tesseract.js');

// Função para aplicar OCR e retornar texto
async function extrairTexto(path) {
  const resultado = await Tesseract.recognize(path, 'por', {
    logger: m => console.log(`[OCR] ${m.status}`)
  });
  return resultado.data.text;
}

// Função que extrai os dados com base em padrões fixos do modelo da procuração
function extrairCamposDaProcuracao(texto) {
  const campos = {};

  campos["Nome Completo"] = texto.match(/NOME DO OUTORGANTE:\s*(.*)/i)?.[1]?.trim() || '';
  campos["CPF"] = texto.match(/CPF:\s*([0-9.\-]+)/i)?.[1] || '';
    campos["Estado Civil"] = texto.match(/estado civil:\s*([^\n]+)/i)?.[1] || '';
  campos["Profiss\u00e3o"] = texto.match(/profiss\u00e3o:\s*([^\n]+)/i)?.[1] || '';
  campos["Endere\u00e7o"] = texto.match(/residente e domiciliado\(a\)\s*([^\n]+)/i)?.[1] || '';
  campos["Cidade"] = texto.match(/na cidade de\s*([^\n]+)/i)?.[1] || '';
  campos["Estado do Servi\u00e7o"] = texto.match(/estado de\s*([^\n]+)/i)?.[1] || '';

  return campos;
}

module.exports = {
  extrairTexto,
  extrairCamposDaProcuracao
};
