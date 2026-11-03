package br.com.sistemas.chamados.repository;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import br.com.sistemas.chamados.entity.Categoria;
import br.com.sistemas.chamados.entity.Chamado;
import br.com.sistemas.chamados.entity.Cliente;
import br.com.sistemas.chamados.entity.Prioridade;
import br.com.sistemas.chamados.entity.StatusChamado;

@DataJpaTest
class ChamadoRepositoryTest {

    @Autowired private ChamadoRepository chamadoRepository;
    @Autowired private ClienteRepository clienteRepository;
    @Autowired private CategoriaRepository categoriaRepository;

    private Cliente ana;
    private Cliente bruno;

    @BeforeEach
    void prepararDados() {
        ana = clienteRepository.save(new Cliente("Ana Souza", "ana@exemplo.com", null));
        bruno = clienteRepository.save(new Cliente("Bruno Costa", "bruno@exemplo.com", null));
        Categoria hardware = categoriaRepository.save(new Categoria("Hardware", null));

        chamadoRepository.save(new Chamado("Impressora", "Não liga", Prioridade.ALTA, ana, hardware));
        chamadoRepository.save(new Chamado("Mouse", "Clique falhando", Prioridade.BAIXA, ana, hardware));

        Chamado fechado = new Chamado("Servidor", "Fora do ar", Prioridade.ALTA, bruno, hardware);
        fechado.setStatus(StatusChamado.FECHADO);
        chamadoRepository.save(fechado);
    }

    @Test
    void filtrarSemParametrosRetornaTodos() {
        Page<Chamado> pagina = chamadoRepository.filtrar(null, null, null, PageRequest.of(0, 10));

        assertThat(pagina.getTotalElements()).isEqualTo(3);
    }

    @Test
    void filtrarCombinandoStatusEPrioridade() {
        Page<Chamado> pagina = chamadoRepository.filtrar(
            StatusChamado.ABERTO, Prioridade.ALTA, null, PageRequest.of(0, 10));

        assertThat(pagina.getContent())
            .extracting(Chamado::getTitulo)
            .containsExactly("Impressora");
    }

    @Test
    void filtrarPorCliente() {
        Page<Chamado> pagina = chamadoRepository.filtrar(null, null, bruno.getId(), PageRequest.of(0, 10));

        assertThat(pagina.getContent())
            .extracting(Chamado::getTitulo)
            .containsExactly("Servidor");
    }

    @Test
    void paginacaoDivideOsResultados() {
        Page<Chamado> pagina = chamadoRepository.filtrar(null, null, null, PageRequest.of(0, 2));

        assertThat(pagina.getContent()).hasSize(2);
        assertThat(pagina.getTotalElements()).isEqualTo(3);
        assertThat(pagina.getTotalPages()).isEqualTo(2);
    }

    @Test
    void existsByClienteIdIndicaSeClientePossuiChamados() {
        Cliente semChamados = clienteRepository.save(new Cliente("Carla", "carla@exemplo.com", null));

        assertThat(chamadoRepository.existsByClienteId(ana.getId())).isTrue();
        assertThat(chamadoRepository.existsByClienteId(semChamados.getId())).isFalse();
    }
}