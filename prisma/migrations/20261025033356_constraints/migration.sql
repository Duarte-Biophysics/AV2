ALTER TABLE "Contrato"
  ADD CONSTRAINT "Contrato_valor_nao_negativo" CHECK ("valor" >= 0),
  ADD CONSTRAINT "Contrato_periodo_valido" CHECK ("dataFim" IS NULL OR "dataFim" >= "dataInicio");

ALTER TABLE "ConfiguracaoGlobal"
  ADD CONSTRAINT "ConfiguracaoGlobal_aliquotas_validas"
    CHECK ("aliquotaImposto" BETWEEN 0 AND 1 AND "coeficienteDepreciacao" BETWEEN 0 AND 1);

ALTER TABLE "Organizacao"
  ADD CONSTRAINT "Organizacao_cnpj_formato" CHECK ("cnpj" ~ '^[A-Z0-9]{12}[0-9]{2}$');

ALTER TABLE "Equipamento"
  ADD CONSTRAINT "Equipamento_codigo_formato" CHECK ("codigoBarrasInterno" ~ '^[A-Z0-9-]{4,40}$');
