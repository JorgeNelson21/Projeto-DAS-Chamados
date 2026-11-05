package br.com.sistemas.chamados.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;

import br.com.sistemas.chamados.entity.Cliente;

@DataJpaTest
class ClienteRepositoryTest {

    @Autowired
    private ClienteRepository repository;

    @Test
    void existsByEmailRetornaTrueSomenteParaEmailCadastrado() {
        repository.save(new Cliente("Ana Souza", "ana@exemplo.com", "47999999999"));

        assertThat(repository.existsByEmail("ana@exemplo.com")).isTrue();
        assertThat(repository.existsByEmail("outro@exemplo.com")).isFalse();
    }

    @Test
    void existsByEmailAndIdNotIgnoraOProprioCliente() {
        Cliente ana = repository.save(new Cliente("Ana Souza", "ana@exemplo.com", null));
        Cliente bruno = repository.save(new Cliente("Bruno Costa", "bruno@exemplo.com", null));

        // Ana pode manter o próprio e-mail
        assertThat(repository.existsByEmailAndIdNot("ana@exemplo.com", ana.getId())).isFalse();
        // Bruno não pode usar o e-mail da Ana
        assertThat(repository.existsByEmailAndIdNot("ana@exemplo.com", bruno.getId())).isTrue();
    }

    @Test
    void bancoRejeitaEmailDuplicado() {
        repository.saveAndFlush(new Cliente("Ana Souza", "ana@exemplo.com", null));

        assertThatThrownBy(() ->
            repository.saveAndFlush(new Cliente("Outra Ana", "ana@exemplo.com", null)))
            .isInstanceOf(DataIntegrityViolationException.class);
    }
}