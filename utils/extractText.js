async function interpretarTextoComGPT(textoOriginal, tipoDocumento = 'geral') {
  let systemPrompt = '';

  switch (tipoDocumento) {
    case 'procuracao':
      systemPrompt = 'Você é um assistente que extrai dados de uma procuração. Responda com um objeto JSON contendo: nome, cpf, estadoCivil, enderecoCompleto. Extraia apenas os dados do outorgante.';
      break;
    case 'crlv':
      systemPrompt = 'Você é um assistente que extrai dados de um Certificado de Registro e Licenciamento de Veículo (CRLV). Responda com um JSON contendo: placa, chassi, renavam, estadoEmplacamento.';
      break;
    case 'autuacao':
      systemPrompt = 'Você é um assistente que extrai dados de uma notificação de autuação. Responda com um JSON contendo: orgaoAutuador, numeroAIT, dataDefesaRecurso.';
      break;
    default:
      systemPrompt = 'Você é um assistente que extrai dados de documentos de veículos e procurações. Responda com um objeto JSON contendo: nome, cpf, placa, chassi, renavam, estadoCivil, profissao, endereco e órgão autuador se houver.';
  }

  const resposta = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: textoOriginal }
    ],
    temperature: 0.2
  });

  return resposta.choices[0].message.content;
}
