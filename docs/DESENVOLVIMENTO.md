# Desenvolvimento

Guia prático. Se você nunca mexeu em Electron, leia primeiro a seção
[Os três processos](ARQUITETURA.md#os-três-processos-do-electron) da arquitetura — é o conceito que
mais confunde no começo.

## Sumário

- [O ciclo de trabalho](#o-ciclo-de-trabalho)
- [Receita 1: mudar algo só na tela](#receita-1-mudar-algo-só-na-tela)
- [Receita 2: criar uma funcionalidade de ponta a ponta](#receita-2-criar-uma-funcionalidade-de-ponta-a-ponta)
- [Receita 3: adicionar uma configuração nova](#receita-3-adicionar-uma-configuração-nova)
- [Receita 4: mexer nas etiquetas](#receita-4-mexer-nas-etiquetas)
- [Convenções de código](#convenções-de-código)
- [Armadilhas deste projeto](#armadilhas-deste-projeto)
- [Como depurar](#como-depurar)
- [Antes de commitar](#antes-de-commitar)

---

## O ciclo de trabalho

```bash
npm run dev
```

- Mudou algo em `src/renderer/`? A tela atualiza na hora (hot reload).
- Mudou algo em `src/main/` ou `src/preload/`? O Electron **reinicia** sozinho — o app fecha e abre.
- Mudou `src/shared/`? Afeta os dois lados; o reinício acontece.

Atalhos úteis com o app aberto: `Ctrl+Shift+I` abre o DevTools, `Ctrl+R` recarrega a tela.

---

## Receita 1: mudar algo só na tela

Quando a informação já existe no `window.api`, não precisa tocar no main. Exemplo real: mostrar o
nome do arquivo importado no rodapé.

A matriz já está no composable global, então é só consumir:

```vue
<script setup lang="ts">
import { useMatrix } from '@/composables/useMatrix'

const { state: matrix } = useMatrix()
</script>

<template>
  <span v-if="matrix.payload">{{ matrix.payload.meta.fileName }}</span>
</template>
```

Os composables (`useMatrix`, `useSettings`, `useTemplates`) são **singletons**: o `reactive` fica
fora da função, então todas as telas compartilham o mesmo estado. Chamar `useMatrix()` em dois
componentes não cria duas cópias.

Para componentes visuais, use o que já existe em `@/components/ui` (botão, card, tabela, select,
dialog, switch...). Se faltar um componente shadcn-vue:

```bash
npx shadcn-vue@latest add tooltip
```

---

## Receita 2: criar uma funcionalidade de ponta a ponta

Exemplo completo e pequeno: **um botão que abre a pasta de dados do app no Explorer**. Isso precisa
do processo main (só ele acessa o sistema), então passa por todas as camadas.

São 4 arquivos, sempre na mesma ordem.

### 1. O contrato — `src/shared/api.ts`

```ts
export interface BitredApi {
  // ...o que já existe
  /** Abre a pasta de dados do app no Explorer */
  openDataFolder: () => Promise<void>
}
```

### 2. O trabalho — `src/main/ipc.ts`

Dentro de `registerIpc`, junto dos outros handlers `app:*`:

```ts
ipcMain.handle('app:open-data-folder', async (): Promise<void> => {
  await shell.openPath(app.getPath('userData'))
})
```

> `shell` vem de `electron` — confira o import no topo do arquivo.

### 3. A ponte — `src/preload/index.ts`

```ts
const api: BitredApi = {
  // ...o que já existe
  openDataFolder: (): Promise<void> => ipcRenderer.invoke('app:open-data-folder')
}
```

O nome do canal (`'app:open-data-folder'`) precisa ser **idêntico** nos dois arquivos. Se errar uma
letra, o `invoke` fica pendurado para sempre sem erro visível — é o bug mais comum aqui.

### 4. A tela — `src/renderer/src/views/config/SystemCard.vue`

```vue
<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { FolderOpen } from '@lucide/vue'

async function openFolder(): Promise<void> {
  await window.api.openDataFolder()
}
</script>

<template>
  <Button variant="outline" size="sm" @click="openFolder">
    <FolderOpen class="size-4" />
    Abrir pasta de dados
  </Button>
</template>
```

### 5. Validar

```bash
npm run typecheck
```

Se o contrato, o preload e o handler não baterem, o typecheck acusa. Depois teste no app rodando.

### Quando a função devolve algo que pode falhar

Siga a convenção de erros do projeto: devolva um objeto, não lance exceção.

```ts
// main/ipc.ts
ipcMain.handle('exemplo:fazer', async (): Promise<ExportResult> => {
  try {
    // ...
    return { ok: true, filePath }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
})
```

```ts
// na tela
const result = await window.api.fazerExemplo()
if (result.ok) toast.success('Pronto!')
else if (!result.canceled) toast.error(result.error ?? 'Falha inesperada.')
```

---

## Receita 3: adicionar uma configuração nova

Exemplo: um atraso entre impressões (`printDelayMs`).

**1. O tipo** — `src/shared/types.ts`:

```ts
export interface AppSettings {
  printerName: string | null
  scanColumn: string | null
  copies: number
  printDelayMs: number // novo
  templates: LabelTemplate[]
  activeTemplateId: string | null
}
```

**2. O valor padrão e a leitura segura** — `src/main/settings.ts`. O `settings.json` dos usuários
antigos não tem o campo novo, então a leitura precisa tolerar a ausência:

```ts
function defaults(): AppSettings {
  // ...
  return { printerName: null, scanColumn: null, copies: 1, printDelayMs: 0, /* ... */ }
}

// no construtor, junto dos outros campos:
printDelayMs:
  typeof parsed.printDelayMs === 'number' && Number.isFinite(parsed.printDelayMs)
    ? Math.max(0, Math.min(5000, parsed.printDelayMs))
    : 0,
```

Sempre valide tipo e faixa: o arquivo é editável à mão e um valor absurdo não pode quebrar o app.

**3. A tela** — um card em `views/config/`. O `setSettings` aceita patch parcial:

```vue
<script setup lang="ts">
import { useSettings } from '@/composables/useSettings'

const { state, save } = useSettings()

async function setDelay(value: number): Promise<void> {
  await save({ printDelayMs: value })
}
</script>
```

**4. Usar o valor** onde importa (`main/ipc.ts` ou `main/print.ts`), lendo de `settings.get()`.

---

## Receita 4: mexer nas etiquetas

Modelo de etiqueta, elementos, campos semânticos e editor visual estão documentados em
[ETIQUETAS.md](ETIQUETAS.md) — inclusive o passo a passo para criar um **tipo novo de elemento**.

A regra que não pode ser esquecida: **a etiqueta é renderizada em dois lugares** —
`src/main/labels.ts` (o que vai para a impressora) e `src/renderer/src/views/etiqueta-editor/`
(o que o usuário vê no editor). Mudou o estilo em um, replique no outro, senão o editor deixa de ser
WYSIWYG.

---

## Convenções de código

| Assunto          | Regra                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Formatação       | Prettier: sem ponto e vírgula, aspas simples, linha de até 100 colunas. Rode `npm run format`.                                  |
| Idioma           | **Código em inglês** (variáveis, funções, arquivos). **Textos de interface e comentários em português.**                        |
| Tipos de retorno | Sempre explícitos: `function x(): void`, `async function y(): Promise<void>`. O ESLint cobra.                                   |
| Vue              | Sempre `<script setup lang="ts">`. Composition API, nunca Options API.                                                          |
| Imports          | `@/` para o renderer, `@shared/` para tipos compartilhados, caminho relativo dentro do main.                                    |
| Estilo           | Tailwind v4 (classes utilitárias no template). Sem CSS solto, sem `<style>` por componente.                                     |
| Nomes de arquivo | Views em `PascalCase.vue`; composables em `camelCase.ts` começando com `use`.                                                   |
| Commits          | `tipo: descrição` em inglês — `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`. Ex.: `fix: keep scan input focused after print`. |

Comentários: explique **por que**, não o que. O código já diz o que faz. Veja os comentários de
`print.ts` e `importer.ts` como referência — eles registram decisões que não são óbvias.

---

## Armadilhas deste projeto

1. **Nunca use `structuredClone` em objeto reativo do Vue.** Dá `DataCloneError`. Use o helper
   `clone()` dos composables (`JSON.parse(JSON.stringify(x))`). No main, onde os objetos são puros,
   `structuredClone` é seguro (é o que `settings.ts` faz).

2. **A matriz tem duas implementações de store.** Adicionou método em `MatrixStore`? Implemente em
   `SqliteStore` **e** em `JsonStore`.

3. **A etiqueta é renderizada em dois lugares** (ver Receita 4).

4. **O leitor de código de barras é um teclado.** Ele digita rápido e manda `Enter`. Não tente
   interceptar porta serial nem adicionar `debounce` no input — a tela depende de `@keyup.enter` e de
   manter o foco. Se adicionar um modal na tela de bipagem, devolva o foco ao input ao fechar.

5. **Nomes de coluna mudam por safra.** Nunca escreva `row.data['ID 25-25']` fora do `LABEL_MAP`.
   Use `resolveField(headers, 'id')` ou a `scanColumn` das configurações.

6. **`KeepAlive`**: as telas não remontam ao trocar de aba. Lógica de `onMounted` que deveria rodar
   toda vez que a tela aparece vai em `onActivated`.

7. **Impressão silenciosa falha calada.** Se nada sair na impressora, confira o `failureReason` que
   `printHtml` devolve — ele vira o `error` do `PrintResult`.

8. **Dados do usuário não estão no projeto.** Eles ficam em `%APPDATA%\print-id`. Apagar a pasta
   `dist/` ou reinstalar o app não limpa nada; use o Reset de fábrica.

---

## Como depurar

**Tela (renderer):** `Ctrl+Shift+I` abre o DevTools do Chromium. `console.log` do renderer aparece
ali.

**Processo main:** `console.log` do main aparece **no terminal** onde você rodou `npm run dev`, não
no DevTools.

**Com breakpoints no VSCode:** use a configuração "Debug All" (`.vscode/launch.json`) — ela sobe o
main com debugger e anexa no renderer.

**Ver o HTML da etiqueta sem imprimir:** `window.api.previewLabels([])` devolve o HTML da etiqueta
de exemplo; é o que o card de preview das Configurações usa. Para inspecionar, cole o retorno num
arquivo `.html` e abra no navegador.

---

## Antes de commitar

```bash
npm run typecheck   # obrigatório
npm run lint
npm run format
```

Não existe suíte de testes automatizados ainda. Então teste à mão o que encostou na sua mudança:

- [ ] Importar uma matriz (`docs/exemplos/matriz-exemplo.csv`).
- [ ] Bipar um ID e ver as 5 linhas aparecerem.
- [ ] Imprimir etiqueta de teste (Configurações → Impressora → Imprimir teste).
- [ ] Editar uma célula na tela Dados e exportar.
- [ ] Abrir o editor de etiquetas, mover um elemento e salvar.
