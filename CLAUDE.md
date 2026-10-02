# Print ID — instruções do projeto

App Electron (Windows) que importa uma matriz de ensaios agrícolas de planilha, busca linhas por
código bipado e imprime etiquetas térmicas. Stack: Electron 39 (electron-vite), Vue 3, TypeScript,
Tailwind v4, shadcn-vue e better-sqlite3 com fallback JSON.

Leia `docs/ARQUITETURA.md` antes de mudanças estruturais e `docs/ETIQUETAS.md` antes de qualquer
coisa relacionada a etiquetas.

## Comandos

```bash
npm run dev         # desenvolvimento
npm run typecheck   # obrigatório depois de qualquer mudança (não há testes automatizados)
npm run lint
npm run build:win   # instalador em dist/
```

## Onde cada coisa mora

- `src/main/` — Node: banco (`store.ts`), configurações (`settings.ts`), planilhas
  (`importer.ts`/`exporter.ts`), HTML da etiqueta (`labels.ts`), impressão (`print.ts`), canais IPC
  (`ipc.ts`).
- `src/preload/index.ts` — ponte `window.api`.
- `src/renderer/src/` — Vue (views, composables, `components/ui` gerado pelo shadcn-vue).
- `src/shared/` — tipos (`types.ts`), contrato da API (`api.ts`), modelo de etiqueta
  (`labelTemplate.ts`).

Acesso a disco/banco/impressora/diálogo **só** no main. O renderer fala com o main exclusivamente
por `window.api`.

## Regras obrigatórias

1. **Canal IPC novo passa por 3 arquivos** com o mesmo nome de canal: `src/shared/api.ts`,
   `src/preload/index.ts`, `src/main/ipc.ts`.
2. **Handlers IPC não lançam exceção**: devolvem `{ ok: true, ... }`, `{ ok: false, error }` ou
   `{ ok: false, canceled: true }`. A tela mostra o resultado com `toast` (vue-sonner).
3. **Nunca `structuredClone` em objeto reativo do Vue** (dá `DataCloneError`) — use
   `JSON.parse(JSON.stringify(x))`. No main, com objetos puros, `structuredClone` é aceitável.
4. **A etiqueta é renderizada em dois arquivos espelhados**: `src/main/labels.ts` (impressão) e
   `src/renderer/src/views/etiqueta-editor/labelRender.ts` (editor). Mudou um, mude o outro.
5. **`MatrixStore` tem duas implementações** (`SqliteStore` e `JsonStore`): método novo entra nas
   duas.
6. **Nomes de coluna da matriz mudam por safra.** Nunca escreva `'ID 25-25'` fora do `LABEL_MAP`;
   use `resolveField(headers, campo)` ou a `scanColumn` das configurações.
7. **Campo novo em `AppSettings`** precisa de default e validação de tipo/faixa na leitura de
   `settings.json` (arquivos antigos não têm o campo).
8. **O leitor de código de barras é um teclado** que digita e manda `Enter`. A tela de bipagem
   depende de manter o foco no input — ao adicionar modal ali, devolva o foco ao fechar.
9. Não editar `src/renderer/src/components/ui/**` à mão; usar `npx shadcn-vue@latest add NOME`.

## Estilo

- Prettier: sem ponto e vírgula, aspas simples, 100 colunas. Rode `npm run format`.
- Vue sempre com `<script setup lang="ts">`; Composition API.
- Tipos de retorno explícitos em todas as funções.
- Tailwind v4 no template; sem CSS avulso.
- Imports: `@/` (renderer), `@shared/` (compartilhado), relativo dentro do main.
- Código e commits em inglês; interface, comentários e documentação em português.
- Comentário explica **por que**, não o que.

## Dados

- Dados do usuário: `%APPDATA%\print-id` (`bitred.db`, `bitred-data.json`, `settings.json`).
- `Matriz.xlsx` (dados reais) está fora do repositório. Para testes use
  `docs/exemplos/matriz-exemplo.csv`.
