async function interpretarTextoComGPT(textoOriginal, tipoDocumento = 'geral') {
  let systemPrompt = '';

  switch (tipoDocumento) {
    case 'procuracao':
      systemPrompt = 'Você é um assistente que extrai dados de uma procuração...';
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
 try {
    const resposta = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: textoOriginal }
      ],
      temperature: 0.2
    });

    const content = resposta.choices[0].message.content;
 // Validação simples: tenta parsear
    JSON.parse(content); // se falhar, vai cair no catch
    return content;

  } catch (err) {
    console.error(`Erro ao interpretar texto com GPT: ${err.message}`);
    return '{}'; // evita que seu código quebre
  }
}
