# Arquitetura

Documento de referência: como o código está organizado, quem fala com quem e por que.

## Os três processos do Electron

Um app Electron é dividido em processos que não compartilham memória. Entender essa divisão é
**o pré-requisito** para mexer em qualquer coisa aqui.

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  MAIN (Node.js)             │        │  RENDERER (Chromium + Vue)   │
│  src/main/                  │        │  src/renderer/               │
│                             │        │                              │
│  • lê/escreve arquivos      │ ◄────► │  • telas, botões, tabelas    │
│  • banco SQLite             │  IPC   │  • NÃO acessa disco          │
│  • diálogos do Windows      │        │  • NÃO usa módulos do Node   │
│  • impressão                │        │                              │
└─────────────────────────────┘        └──────────────────────────────┘
                 ▲                                    ▲
                 └────────── src/preload/ ────────────┘
                     expõe window.api (lista fixa
                     de funções permitidas)
```

Regra prática:

- Precisa de **arquivo, banco, impressora ou diálogo**? Vai em `src/main/`.
- É **tela**? Vai em `src/renderer/`.
- É **tipo ou cálculo puro usado pelos dois**? Vai em `src/shared/`.

O renderer **nunca** chama o main diretamente: ele chama `window.api.algumaCoisa()`, que é a ponte
definida em `src/preload/index.ts`.

## Mapa de arquivos

### `src/main/` — processo principal

| Arquivo       | Responsabilidade                                                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`    | Cria a janela, garante instância única, migra dados da pasta antiga, inicializa store/settings e registra o IPC.                          |
| `ipc.ts`      | **Todos** os canais IPC. É a "API do backend" — cada `ipcMain.handle` tem um par no preload.                                              |
| `store.ts`    | Persistência da matriz. Duas implementações da mesma interface: `SqliteStore` (padrão) e `JsonStore` (fallback).                          |
| `settings.ts` | `settings.json` (impressora, cópias, coluna de bipagem, modelos) + migração do formato v1.                                                |
| `importer.ts` | Lê `.xlsx`/`.csv` e devolve `{ headers, rows }`. Trata encoding (UTF-8/UTF-16/latin1), cabeçalhos duplicados e conversão numérica segura. |
| `exporter.ts` | Escreve a matriz editada de volta em `.xlsx`/`.csv`.                                                                                      |
| `labels.ts`   | Monta o **HTML das etiquetas** a partir do modelo + linhas da matriz. Também resolve os campos semânticos (`LABEL_MAP`).                  |
| `print.ts`    | Lista impressoras e imprime o HTML numa janela oculta (`webContents.print`, modo silencioso).                                             |

### `src/renderer/src/` — interface

| Caminho                        | Responsabilidade                                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `App.vue`                      | Trilho lateral, atalhos `F1`/`F2`/`F3`, tema claro/escuro, rodapé com contagem de linhas e versão.              |
| `router/index.ts`              | Rotas (`/bipagem`, `/dados`, `/configuracoes`, `/etiquetas/:id/editar`).                                        |
| `views/BipagemView.vue`        | Tela de bipagem: foco permanente no input, busca, impressão automática, histórico da sessão.                    |
| `views/DadosView.vue`          | Tabela da matriz com filtro, paginação e edição de célula (`dados/EditableCell.vue`).                           |
| `views/ConfigView.vue`         | Agrupa os cards de `views/config/` (impressora, bipagem, etiqueta, modelos, preview, sistema).                  |
| `views/EtiquetaEditorView.vue` | Editor visual de etiquetas (arrastar, redimensionar, snap, desfazer/refazer). Ver [ETIQUETAS.md](ETIQUETAS.md). |
| `composables/useMatrix.ts`     | Estado global da matriz (singleton `reactive`), import/export, update de célula.                                |
| `composables/useSettings.ts`   | Estado global das configurações.                                                                                |
| `composables/useTemplates.ts`  | Biblioteca de modelos: criar, duplicar, renomear, ativar, importar/exportar.                                    |
| `components/ui/`               | Componentes shadcn-vue gerados pelo CLI. Evite editar à mão sem necessidade.                                    |

### `src/shared/` — compartilhado

| Arquivo            | Conteúdo                                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| `types.ts`         | Todos os tipos do domínio (`MatrixRow`, `AppSettings`, `LabelTemplate`, `LabelElement`, resultados de IPC...). |
| `api.ts`           | A interface `BitredApi` — o contrato do `window.api`.                                                          |
| `labelTemplate.ts` | Modelo de fábrica, criação/normalização de elementos, migração de modelos v1.                                  |

## A API entre renderer e main

Todo canal IPC aparece em **três lugares** e precisa estar consistente nos três:

1. `src/shared/api.ts` — a assinatura (contrato).
2. `src/preload/index.ts` — o `ipcRenderer.invoke('canal', ...)`.
3. `src/main/ipc.ts` — o `ipcMain.handle('canal', ...)` que faz o trabalho.

Canais existentes hoje:

| Canal                                   | `window.api`                              | O que faz                                                           |
| --------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------- |
| `matrix:import`                         | `importMatrix()`                          | Abre diálogo, lê planilha, substitui a matriz do banco.             |
| `matrix:get`                            | `getMatrix()`                             | Devolve meta + todas as linhas.                                     |
| `matrix:update-cell`                    | `updateCell(id, col, val)`                | Atualiza uma célula (e reindexa se for a coluna de bipagem).        |
| `matrix:export`                         | `exportMatrix(fmt)`                       | Salva a matriz editada em `.xlsx`/`.csv`.                           |
| `scan:lookup`                           | `lookup(code)`                            | Busca as linhas de um código bipado.                                |
| `print:labels`                          | `printLabels(ids)`                        | Imprime as etiquetas das linhas informadas.                         |
| `print:test`                            | `printTest()`                             | Imprime uma etiqueta de exemplo (dados fictícios, 1 cópia).         |
| `print:preview`                         | `previewLabels(ids)`                      | Devolve o HTML das etiquetas (usado no card de preview).            |
| `printers:list`                         | `listPrinters()`                          | Impressoras instaladas no Windows.                                  |
| `settings:get` / `settings:set`         | `getSettings()` / `setSettings(patch)`    | Lê/grava configurações (patch parcial).                             |
| `templates:export` / `templates:import` | `exportTemplate(id)` / `importTemplate()` | Modelo de etiqueta em `.json`.                                      |
| `app:info`                              | `appInfo()`                               | Versão, backend de storage, pasta de dados, se dá para desinstalar. |
| `app:reset`                             | `resetApp()`                              | Apaga dados e reinicia.                                             |
| `app:uninstall`                         | `uninstallApp()`                          | Abre o desinstalador NSIS.                                          |

### Convenção de erros

Handlers IPC **não lançam exceção para o renderer**. Eles devolvem um objeto com `ok`:

```ts
// main/ipc.ts
return { ok: false, error: 'Nenhuma matriz importada.' }
// ou, quando o usuário fechou o diálogo:
return { ok: false, canceled: true }
```

A tela decide o que mostrar (normalmente um `toast` do `vue-sonner`). Isso evita stack trace na
interface e permite distinguir "deu erro" de "o usuário desistiu".

## Persistência

`createStore(dataDir)` tenta SQLite e cai para JSON se o binário nativo não carregar:

```ts
export function createStore(dataDir: string): MatrixStore {
  try {
    return new SqliteStore(dataDir) // bitred.db
  } catch (error) {
    return new JsonStore(dataDir) // bitred-data.json
  }
}
```

As duas implementam a mesma interface `MatrixStore`, então **se você adicionar um método, precisa
implementar nas duas** — o TypeScript avisa se esquecer.

Tabelas do SQLite:

```sql
meta (key TEXT PRIMARY KEY, value TEXT)  -- headers, fileName, importedAt, scanColumn
rows (id INTEGER PRIMARY KEY,
      scan_key TEXT,                     -- valor normalizado da coluna de bipagem (indexado)
      data TEXT)                         -- a linha inteira em JSON
```

A linha fica serializada em JSON porque as colunas da matriz mudam a cada safra — criar uma coluna
no banco para cada cabeçalho exigiria migração em todo import.

## Impressão

```
rows + template  ->  buildLabelsHtml()  ->  HTML (1 div.label por etiqueta)
                                              |
                            arquivo .html na pasta temp do sistema
                                              |
                        BrowserWindow oculta + webContents.print({ silent: true })
```

Duas particularidades que já custaram tempo:

1. **Tamanho de página**: a primeira tentativa usa `pageSize` em microns (mm × 1000). Alguns drivers
   térmicos rejeitam isso e o app **tenta de novo sem `pageSize`**, usando o papel configurado no
   driver.
2. **Uma etiqueta por página**: cada `.label` tem `page-break-after: always`.

> Pendência conhecida: a impressão só foi exercitada via driver do Windows. Se a térmica da operação
> exigir, a evolução natural é gerar **ZPL** cru em vez de HTML — nesse caso `labels.ts` ganharia um
> irmão (`labelsZpl.ts`) e `print.ts` passaria a enviar bytes para a porta da impressora.

## Decisões que parecem estranhas mas são intencionais

| Decisão                                                          | Motivo                                                                                                |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Instância única (`requestSingleInstanceLock`)                    | Duas cópias compartilhariam banco e fila de impressão.                                                |
| `KeepAlive` no `RouterView`, exceto o editor                     | Preserva histórico de bipagem e filtros da tabela ao trocar de tela; o editor precisa remontar limpo. |
| Campos semânticos (`LabelField`) em vez de nomes de coluna fixos | O cabeçalho muda por safra (`ID 25-25` para `ID 26-26`) e o modelo de etiqueta continua funcionando.  |
| Migração de `%APPDATA%/magnun-etiquetas`                         | O app se chamava "Magnun Etiquetas"; usuários antigos não podem perder os dados.                      |
| Fontes via `@fontsource` em vez de CDN                           | O app roda em campo, às vezes sem internet.                                                           |
| Nomes internos com "bitred" (`BitredApi`, `bitred.db`)           | Rebrand depois da primeira versão; os renames têm migração automática.                                |
