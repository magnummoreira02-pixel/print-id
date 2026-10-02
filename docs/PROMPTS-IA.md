# Usando IA para desenvolver neste projeto

Prompts prontos para pedir ajuda a uma IA (Claude Code, Cursor, Copilot Chat) sem receber código que
não encaixa no projeto. Copie, troque o que está `ENTRE_MAIÚSCULAS` e cole.

## Antes de tudo: as 3 regras de um bom prompt aqui

1. **Diga em qual processo a mudança vive.** "No processo main" ou "só na tela". Sem isso a IA
   escreve `fs.readFileSync` dentro de um componente Vue — e isso não funciona no renderer.
2. **Peça para ela ler os arquivos antes de escrever.** Em ferramentas com acesso ao repositório
   (Claude Code, Cursor), isso muda tudo: ela segue o padrão existente em vez de inventar outro.
3. **Exija o typecheck no fim.** `npm run typecheck` é a rede de segurança deste projeto (não há
   testes automatizados).

> Se a ferramenta tiver acesso ao repositório, o arquivo `CLAUDE.md` na raiz já carrega as
> convenções automaticamente — você não precisa repetir tudo em cada prompt.

---

## 1. Entender o código antes de mexer

```
Leia o README.md e docs/ARQUITETURA.md deste repositório e me explique, em português e de forma
simples, como o fluxo de IMPRESSÃO funciona de ponta a ponta: do clique do usuário até a impressora.
Cite os arquivos e as funções envolvidas, na ordem em que são chamados. Não altere nada.
```

Variações úteis:

```
Me explique o que o arquivo src/main/importer.ts faz, função por função, e por que ele tem tanto
tratamento de encoding. Não altere nada.
```

```
Quero entender como o estado da matriz é compartilhado entre as telas. Explique o padrão usado em
src/renderer/src/composables/useMatrix.ts e por que o reactive fica fora da função.
```

---

## 2. Criar uma funcionalidade de ponta a ponta

Este é o prompt mais importante. O segredo é listar as camadas — a IA tende a esquecer o preload.

```
Quero adicionar uma funcionalidade neste app Electron + Vue 3 + TypeScript.

O QUE: DESCREVA_A_FUNCIONALIDADE
(ex.: um botão em Configurações → Sistema que exporta o histórico de bipagens da sessão em CSV)

Antes de escrever código, leia: docs/ARQUITETURA.md, src/shared/api.ts, src/preload/index.ts e
src/main/ipc.ts para seguir o padrão existente.

Requisitos:
- Se precisar de disco/banco/impressora/diálogo, a lógica vai em src/main/ (o renderer não acessa
  o sistema).
- Passe pelas 4 camadas, nesta ordem: tipo em src/shared/types.ts (se precisar) → contrato em
  src/shared/api.ts → handler em src/main/ipc.ts → ponte em src/preload/index.ts → tela.
- Handlers IPC NÃO lançam exceção: devolvem { ok: true, ... } ou { ok: false, error } /
  { ok: false, canceled: true }.
- Vue com <script setup lang="ts">, Tailwind v4 e componentes de @/components/ui.
- Tipos de retorno explícitos em todas as funções.
- Textos de interface em português; nomes de código em inglês.
- Mensagens de erro/sucesso na tela via toast do vue-sonner.

No fim, rode `npm run typecheck` e corrija o que aparecer. Me diga o que testar manualmente.
```

## 3. Mudar apenas a interface

```
Na tela ARQUIVO.vue, quero DESCREVA_A_MUDANÇA.

Use só o que já existe no projeto: componentes de @/components/ui (shadcn-vue), ícones de
@lucide/vue e classes do Tailwind v4. Não instale dependência nova, não crie CSS próprio e não
mude a lógica de IPC. Mantenha <script setup lang="ts"> e tipos de retorno explícitos.
```

## 4. Mexer nas etiquetas (o pedido com mais risco)

```
Leia docs/ETIQUETAS.md antes de começar.

Quero DESCREVA_A_MUDANÇA_NA_ETIQUETA
(ex.: um tipo novo de elemento "linha"; ou girar texto em 180 graus)

ATENÇÃO: a etiqueta é renderizada em DOIS lugares que precisam ficar idênticos —
src/main/labels.ts (impressão) e src/renderer/src/views/etiqueta-editor/labelRender.ts (editor).
Replique a mudança nos dois, senão o editor deixa de ser WYSIWYG.

Se for um tipo novo de elemento, siga o passo a passo da seção "Adicionar um tipo novo de elemento"
do docs/ETIQUETAS.md (tipo, normalizeElement, labels.ts, labelRender.ts, editorUtils/context,
PropertiesPanel) e rode `npm run typecheck` para achar os switch que faltam.
```

## 5. Investigar um bug

```
Estou com este problema no app: DESCREVA_O_SINTOMA
(ex.: ao bipar um ID, a impressora não recebe nada e nenhuma mensagem aparece na tela)

O que eu já sei: DETALHES_QUE_VOCÊ_OBSERVOU

Investigue no código antes de propor correção: me diga as 2 ou 3 causas mais prováveis, onde cada
uma estaria (arquivo e função) e como eu confirmo qual é — lembrando que log do processo main
aparece no terminal do `npm run dev` e log do renderer aparece no DevTools.
Só depois disso, proponha a correção mínima.
```

## 6. Revisar o que você mesmo escreveu

```
Revise as mudanças que eu fiz (git diff) procurando problemas reais, não estilo:
- O canal IPC está igual no preload e no main?
- Métodos novos de MatrixStore foram implementados em SqliteStore E em JsonStore?
- Tem structuredClone em objeto reativo do Vue? (causa DataCloneError — usar
  JSON.parse(JSON.stringify(x)))
- A renderização da etiqueta foi replicada nos dois arquivos?
- Valor novo em settings.json é validado na leitura (tipo e faixa), para não quebrar com arquivo
  antigo ou editado à mão?
- Alguma coluna da matriz está escrita literalmente ("ID 25-25") fora do LABEL_MAP?

Liste o que achou em ordem de gravidade. Não altere nada ainda.
```

## 7. Entender uma biblioteca

```
Consulte a documentação ATUAL da BIBLIOTECA (versão que está no package.json) e me mostre como
FAZER_X. Prefiro a documentação oficial à sua memória — as versões aqui são recentes
(Electron 39, Vue 3.5, Tailwind 4, Vue Router 5).
```

No Claude Code, esse tipo de pedido já usa o MCP do Context7 automaticamente para buscar a
documentação da versão certa.

## 8. Preparar uma release

```
Quero publicar a versão VERSÃO.
Siga a seção "Gerar o instalador" do README: atualize a version no package.json, rode
`npm run build:win`, e me mostre os comandos de git tag e de `gh release create` com o .exe gerado.
Antes, me diga o que mudou desde a última tag (git log) em formato de notas de release em português.
```

---

## O que NÃO pedir para a IA fazer sozinha

| Situação                                     | Por quê                                                                                              |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| "Troque o SQLite por X" / "migre para Y"     | Reescrita grande em código que já roda em produção, com dados de usuário no disco. Discuta antes.    |
| "Melhore o projeto" / "refatore tudo"        | Pedido vago gera mudança grande e difícil de revisar. Peça uma coisa por vez.                        |
| Mexer em `src/renderer/src/components/ui/**` | São arquivos gerados pelo shadcn-vue. Para um componente novo, use `npx shadcn-vue@latest add NOME`. |
| Impressão real                               | A IA não tem a impressora térmica. Ela ajuda no código; o teste de papel é sempre manual.            |
| Tocar em dados reais (`Matriz.xlsx`)         | Use `docs/exemplos/matriz-exemplo.csv` nos testes.                                                   |

## Checklist depois de aceitar código de IA

- [ ] `npm run typecheck` passa.
- [ ] `npm run lint` passa.
- [ ] O canal IPC tem os três lados (`api.ts`, `preload`, `ipc.ts`) com o nome **idêntico**.
- [ ] Nenhuma dependência nova entrou no `package.json` sem você querer.
- [ ] Você rodou `npm run dev` e exercitou a tela afetada.
- [ ] Os textos que aparecem para o operador estão em português e sem jargão.
