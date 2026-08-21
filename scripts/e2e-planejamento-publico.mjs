// ─────────────────────────────────────────────────────────────────────────────
// O LINK DO PLANEJAMENTO USADO COMO O CLIENTE USA: sozinho, no celular, sem
// ninguém para explicar nada.
//
// O teste percorre o formulário inteiro de ponta a ponta e depois VOLTA PARA
// DENTRO DO SISTEMA para conferir a única coisa que realmente importa: o que
// ele respondeu virou o planejamento da consultora. Um formulário bonito que
// não alimenta o estudo não serviria para nada.
//
// A navegação é sempre pelo histórico do app, nunca por page.goto: no modo
// demonstração o banco vive na memória da aba, e um recarregamento apagaria
// exatamente o que acabamos de preencher.
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from 'playwright-core'
import { existsSync } from 'node:fs'
import { garantirServidor } from './e2e-servidor.mjs'

await garantirServidor()
const exe = process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
const browser = await chromium.launch({ executablePath: exe })
// celular de verdade: é onde este formulário vai ser preenchido
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const B = process.env.E2E_BASE ?? 'http://localhost:4173'

const erros = []
page.on('pageerror', (e) => erros.push('PAGEERROR: ' + String(e).slice(0, 200)))
page.on('console', (m) => { if (m.type() === 'error') erros.push('CONSOLE: ' + m.text().slice(0, 200)) })

const falhas = []
const ok = (c, m, extra) => {
  console.log(c ? '✓' : '✗', m + (c || extra === undefined ? '' : ` → ${extra}`))
  if (!c) falhas.push(m)
}
const texto = () => page.evaluate(() => document.body.innerText)
// navegação dentro do app (o React Router escuta o popstate)
const irNoApp = async (caminho) => {
  await page.evaluate((c) => {
    window.history.pushState({}, '', c)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, caminho)
  await page.waitForTimeout(700)
}
const continuar = async () => {
  await page.locator('button:has-text("Continuar"), button:has-text("Revisar tudo")').first().click()
  await page.waitForTimeout(450)
}
// Preenche o campo e confere que o cliente está mesmo vendo a pergunta com o
// texto certo — de nada adianta gravar no campo errado com o rótulo certo.
const preencher = async (campo, valor, rotulo) => {
  if (rotulo) {
    const visivel = await page.locator(`[data-campo="${campo}"]`).innerText()
    ok(visivel.includes(rotulo), `a pergunta "${rotulo}" está na tela`, visivel.slice(0, 60))
  }
  await page.locator(`[data-campo="${campo}"] input, [data-campo="${campo}"] textarea`).first().fill(valor)
}
const escolher = async (rotuloCampo, opcao) => {
  await page.locator(`[data-campo="${rotuloCampo}"] select`).first().selectOption({ label: opcao })
}
const marcar = async (campo, rotulo) => {
  await page.locator(`[data-campo="${campo}"] button:has-text("${rotulo}")`).first().click()
  await page.waitForTimeout(150)
}

// ── 1. Login (para depois voltarmos ao sistema com o banco intacto) ─────────
await page.goto(B)
await page.waitForSelector('text=Modo demonstração', { timeout: 20000 })
await page.fill('input[type=email]', 'natalia@demo.com')
await page.fill('input[type=password]', 'demo')
await page.click('button[type=submit]')
await page.waitForTimeout(1200)

// ── 2. O link inválido não pode virar tela quebrada ────────────────────────
console.log('\n══ O link errado ══')
await irNoApp('/pl/token-que-nao-existe')
await page.waitForTimeout(600)
{
  const t = await texto()
  ok(/inválido|expirado/i.test(t), 'link inexistente mostra recado claro, não tela branca')
  ok(!/NaN|undefined|TypeError/.test(t), 'nenhum erro técnico aparece para o cliente')
}

// ── 3. A abertura ──────────────────────────────────────────────────────────
console.log('\n══ O cliente abre o link ══')
await irNoApp('/pl/demo-plano-aberto')
await page.waitForSelector('button:has-text("Começar")', { timeout: 10000 })
{
  const t = await texto()
  ok(t.includes('Olá, Ana'), 'a tela chama o cliente pelo primeiro nome')
  ok(/10 a 12 blocos curtos/.test(t),
    'a abertura promete a faixa real de blocos (dois deles dependem das respostas)',
    t.match(/São[^\n]*/)?.[0])
  ok(/Salva sozinho/.test(t), 'promete o salvamento automático')
}
await page.click('button:has-text("Começar")')
await page.waitForTimeout(700)

// ── 4. Nada segue com erro ─────────────────────────────────────────────────
console.log('\n══ Nada segue com erro ══')
await continuar()
{
  const t = await texto()
  ok(/Precisamos desta resposta|em vermelho/.test(t), 'etapa obrigatória em branco não avança')
  ok(/O que você quer resolver/.test(t), 'e o cliente continua na mesma etapa')
}

// ── 5. Percorrendo o formulário inteiro ────────────────────────────────────
console.log('\n══ Preenchendo, bloco a bloco ══')
// bloco 1: objetivo
await marcar('tipo_planejamento', 'PF + PJ')
await marcar('focos', 'Proteção da renda familiar')
await marcar('focos', 'Sucessão e inventário')
await continuar()

// bloco 2: família
ok((await texto()).includes('Você e sua família'), 'chegou no bloco da família')
await preencher('profissao', 'Arquiteta', 'Sua profissão')
await escolher('estado_civil', 'Casado(a)')
await page.waitForTimeout(250)
ok(await page.locator('[data-campo="conjuge_nome"]').count() > 0,
  'ao marcar "casado", o campo de cônjuge aparece sozinho')
await preencher('conjuge_nome', 'Bruno Lima')
await escolher('uf', 'PR')
await continuar()

// bloco 3: filhos
ok((await texto()).includes('Filhos e dependentes'), 'chegou no bloco dos filhos')
await page.click('button:has-text("Adicionar filho")')
await page.waitForTimeout(250)
await page.locator('[data-campo="dependentes"] input').nth(0).fill('Alice')
await page.locator('[data-campo="dependentes"] input').nth(1).fill('7')
await page.locator('[data-campo="dependentes"] input').nth(2).fill('2500')
await continuar()

// bloco 4: vida financeira
ok((await texto()).includes('Sua vida financeira'), 'chegou no bloco financeiro')
await preencher('renda_mensal', '32.000', 'Sua renda mensal')
await preencher('custo_vida_mensal', '18.000', 'Quanto sua família gasta por mês')
await preencher('dividas_total', '450.000', 'Dívidas e financiamentos em aberto')
await page.waitForTimeout(300)
ok(await page.locator('[data-campo="dividas_prazo_anos"]').count() > 0,
  'com dívida informada, a pergunta do prazo aparece sozinha')
await preencher('dividas_prazo_anos', '12', 'Faltam quantos anos para quitar')
await continuar()

// bloco 5: patrimônio
ok((await texto()).includes('O que você construiu'), 'chegou no bloco do patrimônio')
await preencher('patrimonio_imoveis', '1.200.000', 'Imóveis')
await preencher('patrimonio_investimentos', '350.000', 'Investimentos')
await preencher('previdencia_saldo', '210.000', 'Previdência privada')
await page.waitForTimeout(300)
ok(await page.locator('[data-campo="previdencia_tipo"]').count() > 0,
  'com previdência informada, o tipo do plano aparece')
await escolher('previdencia_tipo', 'PGBL')
await continuar()

// bloco 6: sucessão (só existe porque há patrimônio)
ok((await texto()).includes('Herança e organização'), 'o bloco da sucessão apareceu por haver patrimônio')
await marcar('tem_holding', 'Não')
await marcar('tem_testamento', 'Não')
await marcar('herdeiros_menores', 'Sim')
await continuar()

// bloco 7: empresa (só existe porque o planejamento tem PJ)
ok((await texto()).includes('Sua empresa'), 'o bloco da empresa apareceu por ser PF + PJ')
await preencher('pj_razao_social', 'Lima Arquitetura', 'Nome da empresa')
await preencher('pj_valuation', '4.000.000', 'Quanto vale a empresa hoje')
await preencher('pj_participacao_pct', '40', 'Qual a sua participação')
await preencher('pj_lucro_anual', '900.000', 'Lucro anual')
await continuar()

// bloco 8: aposentadoria
await preencher('renda_desejada_aposentadoria', '20.000', 'Quanto você gostaria de receber por mês')
await preencher('idade_aposentadoria', '60', 'Com que idade pretende parar')
await continuar()

// bloco 9: seguros que já tem
ok((await texto()).includes('O que você já tem'), 'chegou no bloco dos seguros atuais')
await page.click('button:has-text("Adicionar seguro")')
await page.waitForTimeout(250)
await page.locator('[data-campo="seguros_existentes"] select').first().selectOption({ label: 'Da empresa (vida em grupo)' })
await page.locator('[data-campo="seguros_existentes"] input[type=text], [data-campo="seguros_existentes"] input:not([type])').first().fill('Vida em grupo do escritório')
await page.locator('[data-campo="seguros_existentes"] input[inputmode=decimal]').first().fill('500000')
await continuar()

// bloco 10: perfil
ok((await texto()).includes('Seu perfil'), 'chegou no bloco do perfil de risco')
await preencher('altura_cm', '168', 'Altura')
await preencher('peso_kg', '62', 'Peso')
await marcar('fumante', 'Não')
await marcar('atividades_risco', 'Moto no dia a dia')
await continuar()

// bloco 11: beneficiários — a soma tem que fechar 100%
console.log('\n══ Os beneficiários e a soma que precisa fechar ══')
ok((await texto()).includes('Quem você quer proteger'), 'chegou no bloco dos beneficiários')
for (let i = 0; i < 2; i++) {
  await page.click('button:has-text("Adicionar beneficiário")')
  await page.waitForTimeout(200)
}
// cada cartão tem três inputs: nome, percentual e nascimento
const campoBenef = (i, n) => page.locator('[data-campo="beneficiarios"] input').nth(i * 3 + n)
await campoBenef(0, 0).fill('Bruno Lima')
await campoBenef(0, 1).fill('70')
await campoBenef(1, 0).fill('Alice Lima')
await campoBenef(1, 1).fill('20')
await page.waitForTimeout(300)
ok(/precisa fechar 100%/.test(await texto()), 'a soma que não fecha é avisada NA HORA, antes de tentar avançar')
await continuar()
ok(/precisa fechar 100/.test(await texto()), 'e ela impede o avanço')
await page.click('button:has-text("Dividir igualmente")')
await page.waitForTimeout(300)
ok(/Soma:\s*100%/.test(await texto()), '"dividir igualmente" fecha a conta em 100%', (await texto()).match(/Soma:[^\n]*/)?.[0])
await continuar()

// bloco 12: objetivos
await marcar('objetivos_chips', 'Garantir a educação dos filhos')
await preencher('objetivos', 'Quero que a Alice termine a faculdade sem depender de ninguém.')
await continuar()

// ── 6. A revisão final ─────────────────────────────────────────────────────
console.log('\n══ A revisão antes de enviar ══')
await page.waitForSelector('text=Confira antes de enviar', { timeout: 8000 })
{
  const t = await texto()
  ok(!/NaN|Infinity|undefined|\[object/.test(t), 'a revisão sai sem nenhum valor quebrado')
  ok(t.includes('R$ 32.000'), 'a renda aparece formatada em reais', t.match(/Renda mensal[^\n]*\n?[^\n]*/)?.[0])
  ok(t.includes('Lima Arquitetura'), 'a empresa aparece na revisão')
  ok(t.includes('Bruno Lima'), 'os beneficiários aparecem na revisão')
  ok(t.includes('PR'), 'o estado aparece na revisão')
  ok((await page.locator('button:has-text("editar")').count()) > 5,
    'cada bloco tem o botão de editar', await page.locator('button:has-text("editar")').count())
}
// voltar para corrigir e retornar à revisão — o caminho de quem achou um erro
await page.locator('button:has-text("editar")').first().click()
await page.waitForTimeout(600)
ok((await texto()).includes('O que você quer resolver'), 'o "editar" leva ao bloco certo')
for (let i = 0; i < 12; i++) {
  if ((await texto()).includes('Confira antes de enviar')) break
  await continuar()
}
ok((await texto()).includes('Confira antes de enviar'), 'e dá para voltar até a revisão')

// ── 7. O envio ─────────────────────────────────────────────────────────────
console.log('\n══ O envio ══')
await page.click('button:has-text("Enviar para a Natália")')
await page.waitForSelector('text=Recebido', { timeout: 10000 })
{
  const t = await texto()
  ok(/Recebido, Ana/.test(t), 'a tela de agradecimento chama o cliente pelo nome')
  ok(/não precisa marcar nada/.test(t), 'e deixa claro que ele não precisa fazer mais nada')
}
// o link não pode ser reaproveitado depois de enviado
await irNoApp('/pl/demo-plano-aberto')
await page.waitForTimeout(800)
ok(/Recebido|já/i.test(await texto()), 'reabrir o link depois de enviado mostra a tela de concluído')

// ── 8. O QUE IMPORTA: virou planejamento? ──────────────────────────────────
console.log('\n══ Do lado da consultora ══')
await irNoApp('/clientes')
await page.waitForTimeout(900)
await page.locator('text=Ana Clara Boff').first().click()
await page.waitForTimeout(1500)
{
  const t = await texto()
  ok(!/NaN|Infinity|R\$\s*-|undefined/.test(t), 'a aba Planejamento abre sem número inválido')
  ok(t.includes('Preenchido pelo cliente'), 'o painel mostra que o cliente preencheu')
  const valores = await page.evaluate(() => {
    const v = (campo) => document.querySelector(`[data-campo="${campo}"]`)?.value ?? null
    const porRotulo = (rotulo) => {
      for (const el of document.querySelectorAll('label')) {
        if (el.textContent.trim().startsWith(rotulo)) return el.querySelector('input')?.value ?? null
      }
      return null
    }
    return {
      renda: porRotulo('Renda mensal'),
      custo: porRotulo('Custo de vida mensal'),
      imoveis: porRotulo('Imóveis'),
      profissao: porRotulo('Profissão'),
      campo: v('renda_mensal'),
    }
  })
  ok(valores.renda === '32.000', 'a renda do cliente está no formulário da consultora', valores.renda)
  ok(valores.custo === '18.000', 'o custo de vida também', valores.custo)
  ok(valores.imoveis === '1.200.000', 'e o patrimônio por classe', valores.imoveis)
  ok(valores.profissao === 'Arquiteta', 'e a profissão', valores.profissao)
  ok(/Sucessão|inventário/i.test(t), 'com patrimônio informado, o estudo já fala de sucessão')
}

// a proposta monta em cima do que o cliente respondeu — sem reunião nenhuma
await page.locator('a[href^="/proposta/"]').first().click()
await page.waitForTimeout(2500)
{
  const t = await texto()
  ok(!/NaN|Infinity|R\$\s*-|undefined/.test(t), 'a proposta gerada do formulário sai sem número inválido')
  // a proposta trata o cliente pelo primeiro nome, do começo ao fim
  ok(/A vida de Ana hoje/.test(t), 'a proposta é a do cliente certo')
  ok(/Vamos ativar seu plano, Ana/.test(t), 'e vai até o fechamento')
  ok(t.length > 2000, 'a proposta tem conteúdo de verdade', `${t.length} caracteres`)
}

// ── 9. Nenhum erro de console em todo o caminho ────────────────────────────
const relevantes = erros.filter((e) => !/favicon|logo|404 \(Not Found\)|net::ERR_/i.test(e))
ok(relevantes.length === 0, 'nenhum erro de JavaScript no caminho inteiro',
  relevantes.slice(0, 3).join(' | '))

await browser.close()
console.log(falhas.length === 0
  ? '\n✅ Planejamento por link: o cliente preenche e vira estudo.\n'
  : `\n❌ ${falhas.length} falha(s):\n${falhas.map((f) => `  · ${f}`).join('\n')}\n`)
process.exit(falhas.length > 0 ? 1 : 0)
