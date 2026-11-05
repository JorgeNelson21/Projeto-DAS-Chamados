# Sistema de Chamados

Sistema para registrar e acompanhar chamados de suporte, com **API REST** e **front-end web**. Desenvolvido na disciplina **DAS – Design e Arquitetura de Sistemas** (Engenharia de Software – UNIVILLE), aplicando arquitetura em camadas com Java e Spring Boot.

**Tecnologias:** Java 21 · Spring Boot 4 (Web, Data JPA, Validation) · H2 em memória · Maven Wrapper · HTML, CSS e JavaScript (sem frameworks).

## Como executar

```bash
.\mvnw spring-boot:run     # Windows (PowerShell)
./mvnw spring-boot:run     # macOS / Linux
```

Com a aplicação rodando:

| Endereço | O que é |
|---|---|
| `http://localhost:8080/` | **Front-end**: interface web para usar o sistema |
| `http://localhost:8080/chamados` (e demais rotas) | **API REST**: usada pelo front-end, Postman, Insomnia ou `curl` |
| `http://localhost:8080/h2-console` | **Banco de dados**: JDBC URL `jdbc:h2:mem:chamadosdb`, usuário `sa`, senha vazia |

> O banco é em memória: os dados são apagados sempre que a aplicação é reiniciada.

### Testes automatizados

```bash
.\mvnw clean test
```

Roda 13 testes: `ClienteRepositoryTest` e `ChamadoRepositoryTest` (`@DataJpaTest`, consultas e restrições do banco) e `ClienteControllerTest` (`@WebMvcTest`, respostas 201, 400, 409 e 404).

## Front-end

Fica em `src/main/resources/static` e é servido pelo próprio Spring Boot, por isso não precisa de instalação nem de outro servidor. As telas seguem o mapa de telas da disciplina:

| Tela | Para que serve |
|---|---|
| **Dashboard** | Totais de chamados por status e por prioridade, e os chamados mais recentes. Clicar num número abre a lista já filtrada. |
| **Chamados** | Lista com filtros (status, prioridade, cliente), ordenação e paginação. Botão para abrir um novo chamado. |
| **Detalhe do chamado** | Dados do chamado, atribuição de técnico, mudança de status, edição, exclusão e comentários em linha do tempo. |
| **Clientes** | Cadastro, edição e exclusão. A página do cliente mostra os chamados dele. |
| **Categorias** | Cadastro dos tipos de chamado (ex.: Hardware, Rede). |
| **Técnicos** | Cadastro de quem atende os chamados, com perfil Administrador ou Técnico. |

**Fluxo de uso:**
1. Cadastre ao menos um **cliente**, uma **categoria** e um **técnico**.
2. Em **Chamados → Novo chamado**, informe título, descrição, prioridade, cliente e categoria. O chamado nasce **Aberto**.
3. No detalhe, **atribua um técnico**: o chamado passa para **Em atendimento**.
4. Registre o andamento nos **comentários** e altere o **status** conforme o atendimento evolui.
5. Ao **fechar**, a data de fechamento é registrada e o chamado fica bloqueado para alterações.

Os erros da API aparecem na própria tela: dados inválidos (400) embaixo de cada campo; regras violadas (409) e registros inexistentes (404) numa caixa de aviso.

## Arquitetura

| Camada | Responsabilidade |
|---|---|
| `controller` | Recebe as requisições HTTP, valida a entrada (`@Valid`) e devolve o status da resposta |
| `service` | Aplica as regras de negócio e controla as transações (`@Transactional`) |
| `repository` | Acessa o banco de dados (Spring Data JPA) |
| `entity` | Representa as tabelas e seus relacionamentos (`@ManyToOne`, `@OneToMany`) |
| `dto` | Define o formato do JSON de entrada e de saída, sem expor as tabelas |
| `exception` | Converte os erros em respostas HTTP padronizadas (`GlobalExceptionHandler`) |
| `static` | Front-end que consome a API |

## Endpoints da API

| Recurso | Rotas | O que fazem |
|---|---|---|
| Clientes | `GET/POST /clientes` · `GET/PUT/DELETE /clientes/{id}` | CRUD de clientes |
| | `GET /clientes/{id}/chamados` | Chamados de um cliente (paginado) |
| Categorias | `GET/POST /categorias` · `GET/PUT/DELETE /categorias/{id}` | CRUD de categorias |
| Técnicos | `GET/POST /tecnicos` · `GET/PUT/DELETE /tecnicos/{id}` | CRUD de técnicos |
| Chamados | `POST /chamados` | Abre um chamado |
| | `GET /chamados` | Lista com filtros e paginação (ver abaixo) |
| | `GET /chamados/{id}` | Detalhe do chamado com os comentários |
| | `PUT /chamados/{id}` · `DELETE /chamados/{id}` | Edita ou exclui (a exclusão remove os comentários) |
| | `PATCH /chamados/{id}/atribuir` | Atribui um técnico: `{"tecnicoId": 1}` |
| | `PATCH /chamados/{id}/status` | Altera o status: `{"status": "FECHADO"}` |
| | `POST /chamados/{id}/comentarios` | Adiciona comentário: `{"texto": "...", "autor": "..."}` |

Exemplo, abrir um chamado:

```bash
curl -i -X POST http://localhost:8080/chamados \
  -H "Content-Type: application/json" \
  -d '{"titulo":"Impressora não liga","descricao":"Setor financeiro","prioridade":"ALTA","clienteId":1,"categoriaId":1}'
```

### Filtros e paginação de `GET /chamados`

Todos os parâmetros são opcionais e podem ser combinados, por exemplo `/chamados?status=ABERTO&prioridade=ALTA&size=5`.

| Parâmetro | Para que serve | Valores |
|---|---|---|
| `status` | Filtra pelo status | `ABERTO`, `EM_ATENDIMENTO`, `AGUARDANDO_CLIENTE`, `FECHADO` |
| `prioridade` | Filtra pela prioridade | `BAIXA`, `MEDIA`, `ALTA`, `CRITICA` |
| `clienteId` | Filtra pelo cliente | ID do cliente |
| `page` / `size` | Página (começa em 0) e itens por página | Padrão: página 0, 10 itens |
| `sort` | Ordenação no formato `campo,direção` | Padrão: `dataAbertura,desc` |

A resposta traz os itens em `content` e os totais em `page` (`totalElements`, `totalPages`, `number`, `size`).

## Regras de negócio

- **Unicidade:** e-mail de cliente e de técnico não se repete; nome de categoria também não, sem diferenciar maiúsculas e minúsculas.
- **Abertura:** todo chamado nasce `ABERTO`, sem técnico, com a data de abertura preenchida automaticamente.
- **Atribuição:** atribuir um técnico a um chamado `ABERTO` o coloca em `EM_ATENDIMENTO`. Só é possível ir para `EM_ATENDIMENTO` com técnico atribuído.
- **Transições:** o chamado não volta para `ABERTO` nem recebe o status que já tem.
- **Fechamento:** ao fechar, a data de fechamento é registrada. Um chamado `FECHADO` não pode ser editado, receber técnico, mudar de status nem receber comentários.
- **Comentários:** a data é automática e não podem ser editados. São excluídos junto com o chamado.
- **Exclusão protegida:** cliente, categoria ou técnico com chamados vinculados não pode ser excluído.

## Respostas e erros

| Código | Significado |
|---|---|
| 200 / 201 / 204 | Sucesso: consulta ou alteração / registro criado / registro excluído |
| 400 | Dados inválidos (campo obrigatório, formato, valor ou ordenação inválidos) |
| 404 | Registro não encontrado |
| 409 | Regra de negócio violada (duplicidade, transição de status inválida, chamado fechado, exclusão protegida) |

Os erros seguem sempre o mesmo formato. Em `detalhes` aparecem os campos com problema:

```json
{
  "momento": "2026-11-03T17:20:00",
  "status": 400,
  "erro": "Dados inválidos",
  "detalhes": ["nome: Nome é obrigatório", "email: E-mail inválido"]
}
```