package br.com.sistemas.chamados.dto;

import java.util.List;

import br.com.sistemas.chamados.entity.Chamado;

/** Detalhe do chamado: dados do chamado + comentários em ordem cronológica. */
public record ChamadoDetalheResponse(
    ChamadoResponse chamado,
    List<ComentarioResponse> comentarios
) {
    public static ChamadoDetalheResponse de(Chamado c) {
        return new ChamadoDetalheResponse(
            ChamadoResponse.de(c),
            c.getComentarios().stream().map(ComentarioResponse::de).toList()
        );
    }
}