'use strict';

/**
 * Cliente HTTP da API REST.
 * O front-end é servido pelo próprio Spring Boot (pasta static), então as
 * chamadas usam caminhos relativos (/clientes, /chamados...) e não há CORS.
 */
class ApiError extends Error {
  constructor(status, corpo) {
    // Formato do GlobalExceptionHandler: { momento, status, erro, detalhes }
    // Formato padrão do Spring:            { timestamp, status, error, path }
    super((corpo && (corpo.erro || corpo.error)) || `Erro ${status}`);
    this.status = status;
    this.detalhes = (corpo && Array.isArray(corpo.detalhes)) ? corpo.detalhes : [];
  }
}

const Api = {
  async request(metodo, url, corpo) {
    const opcoes = { method: metodo, headers: { Accept: 'application/json' } };
    if (corpo !== undefined) {
      opcoes.headers['Content-Type'] = 'application/json';
      opcoes.body = JSON.stringify(corpo);
    }

    let resposta;
    try {
      resposta = await fetch(url, opcoes);
    } catch (e) {
      throw new ApiError(0, {
        erro: 'Não foi possível conectar à API. Verifique se a aplicação está rodando.'
      });
    }

    if (resposta.status === 204) return null;

    const texto = await resposta.text();
    let dados = null;
    if (texto) {
      try { dados = JSON.parse(texto); } catch (e) { dados = { erro: texto }; }
    }

    if (!resposta.ok) throw new ApiError(resposta.status, dados);
    return dados;
  },

  get(url)          { return this.request('GET', url); },
  post(url, corpo)  { return this.request('POST', url, corpo); },
  put(url, corpo)   { return this.request('PUT', url, corpo); },
  patch(url, corpo) { return this.request('PATCH', url, corpo); },
  del(url)          { return this.request('DELETE', url); }
};
