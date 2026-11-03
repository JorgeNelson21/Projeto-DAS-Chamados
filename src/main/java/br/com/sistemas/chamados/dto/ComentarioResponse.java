package br.com.sistemas.chamados.dto;

import java.time.LocalDateTime;

import br.com.sistemas.chamados.entity.Comentario;

public record ComentarioResponse(Long id, String texto, LocalDateTime data, String autor) {
    public static ComentarioResponse de(Comentario c) {
        return new ComentarioResponse(c.getId(), c.getTexto(), c.getData(), c.getAutor());
    }
}