package br.com.sistemas.chamados.service;

import java.util.List;
import java.time.LocalDateTime;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.sistemas.chamados.dto.ChamadoRequest;
import br.com.sistemas.chamados.dto.ChamadoResponse;
import br.com.sistemas.chamados.entity.Categoria;
import br.com.sistemas.chamados.entity.Chamado;
import br.com.sistemas.chamados.entity.Cliente;
import br.com.sistemas.chamados.exception.RecursoNaoEncontradoException;
import br.com.sistemas.chamados.repository.CategoriaRepository;
import br.com.sistemas.chamados.repository.ChamadoRepository;
import br.com.sistemas.chamados.repository.ClienteRepository;
import br.com.sistemas.chamados.dto.AlterarStatusRequest;
import br.com.sistemas.chamados.dto.AtribuirTecnicoRequest;
import br.com.sistemas.chamados.entity.StatusChamado;
import br.com.sistemas.chamados.entity.Tecnico;
import br.com.sistemas.chamados.exception.RegraNegocioException;
import br.com.sistemas.chamados.repository.TecnicoRepository;

@Service
public class ChamadoService {

       private final ChamadoRepository repository;
    private final ClienteRepository clienteRepository;
    private final CategoriaRepository categoriaRepository;
    private final TecnicoRepository tecnicoRepository;

    public ChamadoService(ChamadoRepository repository,
                          ClienteRepository clienteRepository,
                          CategoriaRepository categoriaRepository,
                          TecnicoRepository tecnicoRepository) {
        this.repository = repository;
        this.clienteRepository = clienteRepository;
        this.categoriaRepository = categoriaRepository;
        this.tecnicoRepository = tecnicoRepository;
    }

    @Transactional
    public ChamadoResponse criar(ChamadoRequest dto) {
        Cliente cliente = buscarCliente(dto.clienteId());
        Categoria categoria = buscarCategoria(dto.categoriaId());
        Chamado chamado = new Chamado(
            dto.titulo(), dto.descricao(), dto.prioridade(), cliente, categoria);
        return ChamadoResponse.de(repository.save(chamado));
    }

    @Transactional(readOnly = true)
    public List<ChamadoResponse> listar() {
        return repository.findAll().stream().map(ChamadoResponse::de).toList();
    }

    @Transactional(readOnly = true)
    public ChamadoResponse buscar(Long id) {
        return ChamadoResponse.de(buscarEntity(id));
    }

     @Transactional
    public ChamadoResponse atualizar(Long id, ChamadoRequest dto) {
        Chamado chamado = buscarEntity(id);
        validarNaoFechado(chamado);
        chamado.setTitulo(dto.titulo());
        chamado.setDescricao(dto.descricao());
        chamado.setPrioridade(dto.prioridade());
        chamado.setCliente(buscarCliente(dto.clienteId()));
        chamado.setCategoria(buscarCategoria(dto.categoriaId()));
        return ChamadoResponse.de(chamado);
    }

    @Transactional
    public void excluir(Long id) {
        repository.delete(buscarEntity(id));
    }

        @Transactional
    public ChamadoResponse atribuirTecnico(Long id, AtribuirTecnicoRequest dto) {
        Chamado chamado = buscarEntity(id);
        validarNaoFechado(chamado);                                   // R1
        Tecnico tecnico = buscarTecnico(dto.tecnicoId());
        chamado.setTecnico(tecnico);
        if (chamado.getStatus() == StatusChamado.ABERTO) {            // R2
            chamado.setStatus(StatusChamado.EM_ATENDIMENTO);
        }
        return ChamadoResponse.de(chamado);
    }

    @Transactional
    public ChamadoResponse alterarStatus(Long id, AlterarStatusRequest dto) {
        Chamado chamado = buscarEntity(id);
        StatusChamado novo = dto.status();

        validarNaoFechado(chamado);                                   // R1
        if (novo == chamado.getStatus()) {                            // R5
            throw new RegraNegocioException(
                "Chamado " + id + " já está com status " + novo);
        }
        if (novo == StatusChamado.ABERTO) {                           // R4
            throw new RegraNegocioException(
                "Chamado " + id + " não pode voltar para ABERTO");
        }
        if (novo == StatusChamado.EM_ATENDIMENTO && chamado.getTecnico() == null) { // R3
            throw new RegraNegocioException(
                "Chamado " + id + " precisa de técnico atribuído para entrar em atendimento");
        }

        chamado.setStatus(novo);
        if (novo == StatusChamado.FECHADO) {                          // R6
            chamado.setDataFechamento(LocalDateTime.now());
        }
        return ChamadoResponse.de(chamado);
    }

        private void validarNaoFechado(Chamado chamado) {
        if (chamado.getStatus() == StatusChamado.FECHADO) {
            throw new RegraNegocioException(
                "Chamado " + chamado.getId() + " está fechado e não pode ser alterado");
        }
    }

    private Tecnico buscarTecnico(Long id) {
        return tecnicoRepository.findById(id)
            .orElseThrow(() -> new RecursoNaoEncontradoException(
                "Técnico " + id + " não encontrado"));
    }

    private Chamado buscarEntity(Long id) {
        return repository.findById(id)
            .orElseThrow(() -> new RecursoNaoEncontradoException(
                "Chamado " + id + " não encontrado"));
    }

    private Cliente buscarCliente(Long id) {
        return clienteRepository.findById(id)
            .orElseThrow(() -> new RecursoNaoEncontradoException(
                "Cliente " + id + " não encontrado"));
    }

    private Categoria buscarCategoria(Long id) {
        return categoriaRepository.findById(id)
            .orElseThrow(() -> new RecursoNaoEncontradoException(
                "Categoria " + id + " não encontrada"));
    }
}