import { ApiError } from "./api";

const MESSAGES: Record<string, string> = {
  duplicate_document: "Já existe um cliente com este CPF/CNPJ",
  duplicate_rig_name: "Já existe uma perfuratriz com este nome",
  duplicate_email: "E-mail já cadastrado",
  last_admin: "É preciso manter ao menos um administrador ativo",
  forbidden: "Você não tem acesso a esta página",
  invalid_credentials: "E-mail ou senha inválidos",
  validation_error: "Verifique os campos informados",
  not_found: "Registro não encontrado",
  job_not_ready: "Aloque ao menos uma perfuratriz e um operador antes de iniciar a obra",
  mobilization_pending: "Feche a negociação da mobilização antes de iniciar a obra",
  job_locked: "A tabela de uma obra concluída ou cancelada não pode mudar",
  invalid_status_transition: "Esta mudança de status não é permitida",
  rig_unavailable: "A perfuratriz selecionada não está disponível",
  invalid_operator: "O operador selecionado não é válido",
  invalid_dates: "A data de término não pode ser anterior à de início",
  pending_measurements: "Aprove ou rejeite as medições enviadas antes de concluir a obra",
  measurement_locked: "Esta medição não pode mais ser alterada",
  duplicate_pile: "Estaca já lançada nesta obra",
  duplicate_client_key: "Esta medição já foi enviada",
  diameter_not_contracted: "Há diâmetros fora da tabela contratada da obra",
  line_exceeds_rig: "Há linhas acima da capacidade da perfuratriz",
  job_not_in_progress: "A obra precisa estar em execução para lançar medições",
  rig_not_allocated: "A perfuratriz não está alocada a esta obra",
  future_date: "A data não pode ser futura",
  file_too_large: "A foto é grande demais",
  unsupported_media_type: "Formato de arquivo não suportado. Envie uma foto JPEG ou PNG.",
  extraction_failed: "Não foi possível ler a foto. Digite as linhas.",
  extraction_unavailable: "A leitura de fotos está indisponível. Digite as linhas.",
};

export function messageFor(err: unknown): string {
  if (err instanceof ApiError) return MESSAGES[err.code] ?? err.message;
  return "Erro inesperado. Tente novamente.";
}

/** Mensagem para um código que veio no corpo de uma resposta de sucesso (ex.: `extraction_error`). */
export function messageForCode(code: string): string {
  return MESSAGES[code] ?? "Erro inesperado. Tente novamente.";
}

export function isForbidden(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403;
}
