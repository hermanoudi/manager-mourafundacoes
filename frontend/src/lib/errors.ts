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
};

export function messageFor(err: unknown): string {
  if (err instanceof ApiError) return MESSAGES[err.code] ?? err.message;
  return "Erro inesperado. Tente novamente.";
}

export function isForbidden(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403;
}
