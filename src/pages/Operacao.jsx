import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { conferir, mensagemErro } from '../lib/operacoes'
import { PageHeader, Card, Campo, Input, Button, Select } from '../components/ui'
import ErroCarga from '../components/ErroCarga'
import { useToast } from '../components/toastContexto'
export default function Operacao() {
  const toast = useToast(),
    [dados, setDados] = useState(null),
    [perfil, setPerfil] = useState(null),
    [arquivados, setArquivados] = useState([]),
    [usuarios, setUsuarios] = useState([]),
    [premissas, setPremissas] = useState([]),
    [lotes, setLotes] = useState([]),
    [erro, setErro] = useState(null),
    [ocupado, setOcupado] = useState(false)
  const [novoUsuario, setNovoUsuario] = useState('')
  const [auditoria, setAuditoria] = useState([])
  const carregar = useCallback(async () => {
    setErro(null)
    try {
      const papel = await supabase.rpc('fn_hub_papel')
      conferir(papel)
      setPerfil(papel.data)
      const [s, p, l] = await Promise.all([
        supabase.rpc('fn_hub_status_operacao'),
        supabase.from('premissas_revisoes').select('*').order('assunto'),
        supabase
          .from('importacoes_lotes')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20),
      ])
      conferir(s, p, l)
      setDados(s.data)
      setPremissas(p.data || [])
      setLotes(l.data || [])
      if (papel.data === 'admin') {
        const [a, u, h] = await Promise.all([
          supabase.rpc('fn_hub_arquivados'),
          supabase.from('hub_perfis').select('*').order('created_at'),
          supabase
            .from('eventos_auditoria')
            .select('id,tabela,registro,acao,autor,created_at')
            .order('created_at', { ascending: false })
            .limit(30),
        ])
        conferir(a, u, h)
        setArquivados(a.data || [])
        setUsuarios(u.data || [])
        setAuditoria(h.data || [])
      }
    } catch (e) {
      setErro(mensagemErro(e))
    }
  }, [])
  useEffect(() => {
    carregar()
  }, [carregar])
  async function executar(fn, msg) {
    if (ocupado) return
    setOcupado(true)
    try {
      conferir(await fn())
      toast.ok(msg)
      await carregar()
    } catch (e) {
      toast.erro(mensagemErro(e))
    } finally {
      setOcupado(false)
    }
  }
  const quando = (v) => (v ? new Date(v).toLocaleString('pt-BR') : 'Sem registro')
  return (
    <div>
      <PageHeader
        titulo="Operação e qualidade"
        subtitulo="Integrações, premissas e recuperação dos cadastros"
      >
        <Button variant="secondary" onClick={carregar}>
          Verificar agora
        </Button>
      </PageHeader>
      {erro ? (
        <ErroCarga erro={erro} tentar={carregar} />
      ) : !dados ? (
        <p role="status">Verificando...</p>
      ) : (
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="font-semibold">Integrações</h2>
            <p className="mt-2 text-sm">
              Verificado em {quando(dados.verificado_em)}. Seu perfil: {perfil || 'sem acesso'}.
            </p>
            <p className="mt-2">
              Outlook: {dados.outlook?.ativo ? 'habilitado' : 'desabilitado'} · última sincronização{' '}
              {quando(dados.outlook?.ultima_sync)}
            </p>
            <p>
              Fila de mensagens: {dados.mensagens?.pendentes ?? '—'} pendentes · registro mais
              recente {quando(dados.mensagens?.ultima_geracao)}
            </p>
            <p>
              Execução diária:{' '}
              {dados.rotina_diaria
                ? `${dados.rotina_diaria.status} · ${quando(dados.rotina_diaria.fim || dados.rotina_diaria.inicio)}`
                : 'Sem execução comprovada. Confira o agendamento com a administração.'}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Uma fila vazia não comprova execução. O monitor externo deve testar site e
              autenticação continuamente.
            </p>
          </Card>
          <Card className="p-5">
            <h2 className="font-semibold">Premissas e fontes</h2>
            <p className="my-2 text-sm">
              As contas do motor são estimativas. Este registro documenta a revisão; ele não
              substitui as regras e a análise da seguradora nem altera taxas automaticamente.
            </p>
            {premissas.map((p, i) => (
              <form
                key={p.assunto}
                className="my-4 space-y-2 border-t pt-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  executar(
                    () =>
                      supabase
                        .from('premissas_revisoes')
                        .update({
                          fonte_url: p.fonte_url || null,
                          revisado_em: p.revisado_em || null,
                          responsavel: p.responsavel || null,
                          observacao: p.observacao || null,
                        })
                        .eq('assunto', p.assunto),
                    'Revisão documentada.',
                  )
                }}
              >
                <h3 className="font-medium">
                  {p.assunto} ·{' '}
                  {p.revisado_em
                    ? 'Revisada em ' + p.revisado_em
                    : 'Pendente de validação profissional'}
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    ['fonte_url', 'Fonte oficial (HTTPS)', 'url'],
                    ['revisado_em', 'Data de revisão', 'date'],
                    ['responsavel', 'Responsável', 'text'],
                    ['observacao', 'O que foi conferido', 'text'],
                  ].map(([k, l, t]) => (
                    <Campo key={k} label={l}>
                      <Input
                        type={t}
                        required={perfil === 'admin'}
                        disabled={perfil !== 'admin'}
                        value={p[k] || ''}
                        onChange={(e) =>
                          setPremissas((rows) =>
                            rows.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)),
                          )
                        }
                      />
                    </Campo>
                  ))}
                </div>
                {perfil === 'admin' && (
                  <Button type="submit" disabled={ocupado}>
                    Salvar revisão
                  </Button>
                )}
              </form>
            ))}
          </Card>
          <Card className="p-5">
            <h2 className="font-semibold">Importações recentes</h2>
            {lotes.length ? (
              lotes.map((l) => (
                <p key={l.id} className="my-2 text-sm">
                  {quando(l.created_at)} · {l.quantidade} linhas · {l.substituidos} substituídas ·{' '}
                  {(l.fontes || []).join(', ')} · lote {l.id}
                </p>
              ))
            ) : (
              <p className="mt-2 text-sm">Nenhum lote registrado nesta versão.</p>
            )}
          </Card>
          {perfil === 'admin' && (
            <>
              <Card className="p-5">
                <h2 className="font-semibold">Cadastros arquivados</h2>
                <p className="my-2 text-sm">
                  Restaurar preserva o histórico. Links revogados não são reativados.
                </p>
                {arquivados.length ? (
                  arquivados.map((c) => (
                    <div key={c.id} className="my-2 flex flex-wrap gap-3">
                      <span>
                        {c.nome} · {quando(c.arquivado_em)}
                      </span>
                      <Button
                        disabled={ocupado}
                        variant="secondary"
                        onClick={() =>
                          executar(
                            () => supabase.rpc('fn_hub_restaurar_cliente', { p_id: c.id }),
                            'Cadastro restaurado.',
                          )
                        }
                      >
                        Restaurar cadastro
                      </Button>
                    </div>
                  ))
                ) : (
                  <p>Nenhum cadastro arquivado.</p>
                )}
              </Card>
              <Card className="p-5">
                <h2 className="font-semibold">Perfis da equipe</h2>
                <form
                  className="my-3 flex flex-wrap gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    executar(
                      () =>
                        supabase.rpc('fn_hub_atribuir_perfil', {
                          p_usuario: novoUsuario,
                          p_papel: 'leitura',
                        }),
                      'Perfil de leitura atribuído.',
                    )
                  }}
                >
                  <Campo label="Identificador do novo usuário (UUID do Supabase)">
                    <Input
                      required
                      pattern="[0-9a-fA-F-]{36}"
                      value={novoUsuario}
                      onChange={(e) => setNovoUsuario(e.target.value)}
                    />
                  </Campo>
                  <Button type="submit" disabled={ocupado}>
                    Autorizar inicialmente como leitura
                  </Button>
                </form>
                <p className="my-2 text-sm">
                  Cadastre novos usuários pelo administrador do Supabase e atribua o perfil.
                  Usuários sem perfil não recebem acesso aos dados.
                </p>
                {usuarios.map((u) => (
                  <div className="my-2 flex flex-wrap items-center gap-3" key={u.user_id}>
                    <span className="break-all text-xs">{u.user_id}</span>
                    <Select
                      style={{ width: 'auto' }}
                      aria-label={`Perfil ${u.user_id}`}
                      disabled={ocupado}
                      value={u.papel}
                      onChange={(e) => {
                        if (window.confirm('Alterar as permissões desta conta?'))
                          executar(
                            () =>
                              supabase.rpc('fn_hub_atribuir_perfil', {
                                p_usuario: u.user_id,
                                p_papel: e.target.value,
                              }),
                            'Perfil atualizado.',
                          )
                      }}
                    >
                      {['admin', 'consultora', 'leitura'].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </Select>
                  </div>
                ))}
              </Card>
              <Card className="p-5">
                <h2 className="font-semibold">Auditoria recente</h2>
                <p className="my-2 text-sm">
                  Metadados de alterações, sem exibir aqui o conteúdo dos documentos ou notas
                  clínicas.
                </p>
                {auditoria.map((a) => (
                  <p className="my-1 break-all text-xs" key={a.id}>
                    {quando(a.created_at)} · {a.tabela} · {a.acao} · registro {a.registro} · autor{' '}
                    {a.autor || 'rotina do banco'}
                  </p>
                ))}
              </Card>
            </>
          )}
          <Card className="p-5">
            <h2 className="font-semibold">Recuperação e suporte</h2>
            <p className="mt-2 text-sm">
              Arquivar cadastros não substitui backup do banco e dos arquivos. A administração deve
              manter cópia externa protegida e testar restauração em ambiente separado. O estado do
              backup não é verificado por esta tela.
            </p>
            <p className="mt-2 text-sm">
              Ao pedir suporte, informe tela, horário e operação. Não envie senha, chave de acesso
              ou dados médicos em mensagens.
            </p>
          </Card>
        </div>
      )}
    </div>
  )
}
