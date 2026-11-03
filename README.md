# Sistema de Chamados – API REST

API para gestão de chamados de suporte, desenvolvida na disciplina **DAS – Design e Arquitetura de Sistemas** (Engenharia de Software – UNIVILLE), aplicando arquitetura em camadas com Java e Spring Boot.

## Tecnologias

- Java 21
- Spring Boot 4 (Spring Web, Spring Data JPA, Bean Validation)
- H2 Database (em memória)
- Maven Wrapper

## Arquitetura

```
controller  → recebe HTTP, valida entrada (@Valid) e devolve status/resposta
service     → regras de negócio e transações (@Transactional)
repository  → acesso a dados (Spring Data JPA)
entity      → mapeamento objeto-relacional e relacionamentos (@ManyToOne / @OneToMany)
dto         → contrato de entrada/saída da API
exception   → exceções de domínio e padronização de erros (GlobalExceptionHandler)
```

## Como executar

```bash
# Windows (PowerShell)
.\mvnw spring-boot:run

# macOS / Linux
./mvnw spring-boot:run
```

A API sobe em `http://localhost:8080`.

### Testes automatizados

```bash
# Windows (PowerShell)
.\mvnw clean test

# macOS / Linux
./mvnw clean test
```

| Classe | Tipo | O que cobre |
|---|---|---|
| `ClienteRepositoryTest` | `@DataJpaTest` | Queries derivadas e restrição de e-mail único no banco |
| `ChamadoRepositoryTest` | `@DataJpaTest` | Filtros combinados, paginação e vínculo com cliente |
| `ClienteControllerTest` | `@WebMvcTest` | Criação (201), validação (400), duplicidade (409) e não encontrado (404) |

### H2 Console

- URL: `http://localhost:8080/h2-console`
- JDBC URL: `jdbc:h2:mem:chamadosdb`
- Usuário: `sa` | Senha: *(vazia)*

> O banco é em memória: os dados são perdidos ao reiniciar a aplicação.

## Endpoints

### Clientes

| Método | Rota | Ação | Sucesso |
|---|---|---|---|
| POST | `/clientes` | Criar | 201 |
| GET | `/clientes` | Listar | 200 |
| GET | `/clientes/{id}` | Buscar por ID | 200 |
| PUT | `/clientes/{id}` | Atualizar | 200 |
| DELETE | `/clientes/{id}` | Excluir | 204 |
| GET | `/clientes/{id}/chamados` | Chamados do cliente (paginado) | 200 |

### Categorias

| Método | Rota | Ação | Sucesso |
|---|---|---|---|
| POST | `/categorias` | Criar | 201 |
| GET | `/categorias` | Listar | 200 |
| GET | `/categorias/{id}` | Buscar por ID | 200 |
| PUT | `/categorias/{id}` | Atualizar | 200 |
| DELETE | `/categorias/{id}` | Excluir | 204 |

### Técnicos

| Método | Rota | Ação | Sucesso |
|---|---|---|---|
| POST | `/tecnicos` | Criar | 201 |
| GET | `/tecnicos` | Listar | 200 |
| GET | `/tecnicos/{id}` | Buscar por ID | 200 |
| PUT | `/tecnicos/{id}` | Atualizar | 200 |
| DELETE | `/tecnicos/{id}` | Excluir | 204 |

### Chamados

| Método | Rota | Ação | Sucesso |
|---|---|---|---|
| POST | `/chamados` | Abrir chamado | 201 |
| GET | `/chamados` | Listar com filtros e paginação | 200 |
| GET | `/chamados/{id}` | Detalhe do chamado com comentários | 200 |
| PUT | `/chamados/{id}` | Atualizar dados | 200 |
| DELETE | `/chamados/{id}` | Excluir (remove também os comentários) | 204 |
| PATCH | `/chamados/{id}/atribuir` | Atribuir técnico | 200 |
| PATCH | `/chamados/{id}/status` | Alterar status | 200 |
| POST | `/chamados/{id}/comentarios` | Adicionar comentário | 201 |

## Exemplos de requisição

### Criar cliente

```bash
curl -i -X POST http://localhost:8080/clientes \
  -H "Content-Type: application/json" \
  -d '{"nome":"Ana Souza","email":"ana@exemplo.com","telefone":"47999999999"}'
```

### Abrir chamado

```bash
curl -i -X POST http://localhost:8080/chamados \
  -H "Content-Type: application/json" \
  -d '{"titulo":"Impressora não liga","descricao":"Setor financeiro","prioridade":"ALTA","clienteId":1,"categoriaId":1}'
```

### Atribuir técnico

```bash
curl -i -X PATCH http://localhost:8080/chamados/1/atribuir \
  -H "Content-Type: application/json" \
  -d '{"tecnicoId":1}'
```

### Alterar status

```bash
curl -i -X PATCH http://localhost:8080/chamados/1/status \
  -H "Content-Type: application/json" \
  -d '{"status":"FECHADO"}'
```

### Comentar chamado

```bash
curl -i -X POST http://localhost:8080/chamados/1/comentarios \
  -H "Content-Type: application/json" \
  -d '{"texto":"Verificando o cabo de energia.","autor":"Carlos Lima"}'
```

### Detalhe do chamado

```bash
curl -i http://localhost:8080/chamados/1
```

Resposta (comentários em ordem cronológica):

```json
{
  "chamado": {
    "id": 1,
    "titulo": "Impressora não liga",
    "status": "ABERTO",
    "clienteNome": "Ana Souza",
    "categoriaNome": "Hardware",
    "...": "..."
  },
  "comentarios": [
    { "id": 1, "texto": "Verificando o cabo de energia.", "data": "2026-11-03T17:40:56", "autor": "Carlos Lima" },
    { "id": 2, "texto": "Cabo substituído, impressora ligou.", "data": "2026-11-03T17:41:02", "autor": "Carlos Lima" }
  ]
}
```

## Consultas com filtros e paginação

Parâmetros opcionais de `GET /chamados`:

| Parâmetro | Valores | Exemplo |
|---|---|---|
| `status` | `ABERTO`, `EM_ATENDIMENTO`, `AGUARDANDO_CLIENTE`, `FECHADO` | `?status=ABERTO` |
| `prioridade` | `BAIXA`, `MEDIA`, `ALTA`, `CRITICA` | `?prioridade=ALTA` |
| `clienteId` | ID do cliente | `?clienteId=2` |
| `page` | Número da página (começa em 0) | `?page=1` |
| `size` | Itens por página (padrão 10) | `?size=5` |
| `sort` | `campo,asc` ou `campo,desc` (padrão `dataAbertura,desc`) | `?sort=titulo,asc` |

Exemplos:

```bash
# Chamados abertos
curl -i "http://localhost:8080/chamados?status=ABERTO"

# Chamados de prioridade ALTA de um cliente
curl -i "http://localhost:8080/chamados?prioridade=ALTA&clienteId=2"

# Combinação de filtros
curl -i "http://localhost:8080/chamados?status=ABERTO&prioridade=ALTA&clienteId=2"

# Paginação: segunda página com 2 itens
curl -i "http://localhost:8080/chamados?size=2&page=1"

# Ordenação por título
curl -i "http://localhost:8080/chamados?sort=titulo,asc"

# Chamados de um cliente específico
curl -i "http://localhost:8080/clientes/1/chamados?size=5"
```

Formato da resposta paginada:

```json
{
  "content": [ { "id": 4, "titulo": "Monitor piscando", "...": "..." } ],
  "page": { "size": 2, "number": 0, "totalElements": 4, "totalPages": 2 }
}
```

## Regras de negócio

- E-mail de cliente e de técnico é único.
- Nome de categoria é único (sem diferenciar maiúsculas/minúsculas).
- Todo chamado nasce com status `ABERTO` e `dataAbertura` preenchida automaticamente.
- Ao atribuir técnico a um chamado `ABERTO`, ele passa para `EM_ATENDIMENTO`.
- Só é possível ir para `EM_ATENDIMENTO` com técnico atribuído.
- Um chamado não pode voltar para `ABERTO` nem receber o mesmo status atual.
- Ao fechar, `dataFechamento` é preenchida automaticamente.
- Chamado `FECHADO` não pode ser alterado, nem receber técnico.
- Chamado `FECHADO` não aceita novos comentários.
- A data do comentário é preenchida automaticamente; comentários não são editáveis.
- Ao excluir um chamado, seus comentários são excluídos junto.
- Cliente, categoria ou técnico com chamados vinculados não pode ser excluído.

## Códigos HTTP

| Código | Significado na API |
|---|---|
| 200 | Consulta ou alteração bem-sucedida |
| 201 | Recurso criado |
| 204 | Recurso excluído |
| 400 | Dados inválidos (Bean Validation, enum ou ordenação inválida) |
| 404 | Recurso não encontrado |
| 409 | Regra de negócio violada (duplicidade, transição inválida, chamado fechado) |

Exemplo de erro padronizado:

```json
{
  "momento": "2026-11-03T17:20:00",
  "status": 400,
  "erro": "Dados inválidos",
  "detalhes": ["nome: Nome é obrigatório", "email: E-mail inválido"]
}
```