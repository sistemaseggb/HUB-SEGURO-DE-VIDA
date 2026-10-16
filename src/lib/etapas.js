import { supabase } from './supabase'
import { conferir } from './operacoes'
export async function mudarEtapa(id, etapa, motivo = '') {
  if (etapa === 'perdido' && !motivo.trim()) throw new Error('Informe o motivo da perda.')
  conferir(
    await supabase
      .from('clientes')
      .update({ status_funil: etapa, motivo_perda: etapa === 'perdido' ? motivo.trim() : null })
      .eq('id', id)
      .select('id')
      .single(),
  )
}
