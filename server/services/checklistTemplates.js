// Checklists dinâmicos por segmento — recurso Pro (Seção 5 do spec).
// No plano Basic, toda OS usa o checklist fixo simples (DEFAULT_CHECKLIST).
const DEFAULT_CHECKLIST = ['Vistoria inicial', 'Execução do serviço', 'Teste final', 'Assinatura do cliente'];

const SEGMENT_TEMPLATES = {
  eletrica: ['Desligar disjuntor geral', 'Verificar aterramento', 'Testar disjuntores', 'Medir isolamento', 'Religar e testar carga'],
  solar: ['Inspecionar módulos', 'Verificar strings e conectores MC4', 'Testar inversor', 'Medir geração', 'Checar aterramento e SPDA'],
  ar_condicionado: ['Limpar filtros e serpentinas', 'Verificar gás refrigerante', 'Testar drenagem', 'Medir temperatura de saída', 'Checar isolamento das tubulações'],
  seguranca: ['Testar câmeras e gravação', 'Verificar sensores', 'Testar central de alarme', 'Checar nobreak/bateria', 'Validar acesso remoto'],
  manutencao: DEFAULT_CHECKLIST,
  outro: DEFAULT_CHECKLIST,
};

function getTemplate(segment) {
  return (SEGMENT_TEMPLATES[segment] || DEFAULT_CHECKLIST).map((item) => ({ item, done: false }));
}

function getDefaultChecklist() {
  return DEFAULT_CHECKLIST.map((item) => ({ item, done: false }));
}

module.exports = { getTemplate, getDefaultChecklist };
