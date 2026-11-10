export function loginErrorMessage(error: unknown): string {
  const response = (error as { response?: { status?: number; data?: { error?: unknown } } })?.response
  if (!response) return 'Não foi possível conectar ao sistema. Confira a internet e tente novamente.'
  if (response.status === 401) return 'E-mail ou senha não conferem, ou o usuário está inativo. Confira o e-mail cadastrado e a senha mais recente com o administrador da empresa.'
  if (response.status === 400) return 'Informe um e-mail válido e preencha a senha.'
  if (response.status === 429) return 'Muitas tentativas de login. Aguarde 15 minutos antes de tentar novamente.'
  if (response.status === 403) return typeof response.data?.error === 'string' ? response.data.error : 'Este acesso não está autorizado. Contate o administrador da empresa.'
  if (response.status === 404) return 'O endereço não encontrou o serviço de login. Confira o endereço do sistema.'
  return 'O servidor não conseguiu concluir o login. Tente novamente em instantes.'
}
