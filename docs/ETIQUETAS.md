# Etiquetas

Como um modelo de etiqueta é descrito, renderizado e editado.

## O conceito

Uma etiqueta é uma folha com medidas em **milímetros** (padrão: 50 × 25 mm) e uma lista de
**elementos posicionados livremente**. Cada elemento tem `x`/`y` em mm contados do canto superior
esquerdo da etiqueta.

```ts
interface LabelTemplate {
  id: string
  name: string
  widthMm: number
  heightMm: number
  elements: LabelElement[]
}
```

Os modelos ficam dentro de `settings.json` (`templates` + `activeTemplateId`), ou seja, em
`%APPDATA%\print-id`. Um deles é o **ativo** — é o usado na impressão.

## Os quatro tipos de elemento

| Tipo    | Para quê                         | Campos principais                                                                                                                 |
| ------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `field` | Valor que vem da matriz          | `autos` / `columns`, `prefix`, `separator`, `fontSizeMm`, `bold`, `align`, `rotation`, `boxed`, `borderMm`, `widthMm`, `heightMm` |
| `text`  | Texto fixo (ex.: `"B"`, `"ID-"`) | `text`, `fontSizeMm`, `bold`, `align`, `rotation`                                                                                 |
| `box`   | Retângulo só com borda           | `widthMm`, `heightMm`, `borderMm`                                                                                                 |
| `qr`    | QR code                          | `sizeMm`, `columns`, `separator`                                                                                                  |

Todos têm `id`, `x`, `y` e `visible`.

Exemplo de elemento `field` que imprime o ID em negrito:

```json
{
  "id": "id-value",
  "type": "field",
  "x": 35.6,
  "y": 20.6,
  "visible": true,
  "autos": ["id"],
  "columns": [],
  "separator": " - ",
  "prefix": "",
  "fontSizeMm": 3,
  "bold": true,
  "align": "left",
  "rotation": 0,
  "boxed": false,
  "borderMm": 0.45,
  "widthMm": null,
  "heightMm": null
}
```

`widthMm: null` significa "do tamanho do conteúdo". Com `widthMm` definido, o `align` passa a valer;
com `heightMm` definido, o elemento vira flex e centraliza verticalmente.

## Campos semânticos: por que não usar o nome da coluna

O cabeçalho da matriz muda a cada safra: `ID 25-25` vira `ID 26-26`, `Serpentine 25-26` vira
`Serpentine 26-27`. Se o modelo de etiqueta guardasse o nome literal, ele quebraria em toda
importação nova.

Por isso existe o **campo semântico** (`LabelField`): um apelido estável que é resolvido para a
coluna real na hora de imprimir.

```ts
// src/main/labels.ts
export const LABEL_MAP: Record<LabelField, { exact: string; pattern: RegExp }> = {
  id: { exact: 'ID 25-25', pattern: /^id\b/i },
  serpentine: { exact: 'Serpentine 25-26', pattern: /^serpentine\b/i }
  // ...
}

// resolveField(headers, 'id') devolve o nome da coluna que existe na matriz atual:
// 1º tenta o nome exato de referência, 2º tenta o padrão (regex)
```

Campos disponíveis: `boxB` (Range), `boxL` (Row), `serpentine`, `trait`, `entryPrefix`,
`entrySuffix`, `boxLetter`, `id`, `seedPac`, `quadra`, `local`.

Se precisar de uma coluna que não tem campo semântico, use `columns: ['Nome Exato Da Coluna']` no
elemento — quando `columns` não está vazio, ele tem prioridade sobre `autos`. É mais frágil, mas
resolve casos pontuais sem alterar o código.

### Adicionar um campo semântico novo

1. `src/shared/types.ts` — acrescente o nome na união `LabelField`.
2. `src/shared/labelTemplate.ts` — acrescente o rótulo em `LABEL_FIELD_NAMES` (é o que aparece no
   editor).
3. `src/main/labels.ts` — acrescente a entrada em `LABEL_MAP` (`exact` + `pattern`).
4. `src/renderer/src/views/etiqueta-editor/labelRender.ts` — acrescente a **mesma** entrada no
   `LABEL_MAP` espelhado.

## As duas renderizações (a regra de ouro)

O mesmo modelo é desenhado em dois lugares, com código duplicado de propósito:

| Onde      | Arquivo                                                 | Saída                         |
| --------- | ------------------------------------------------------- | ----------------------------- |
| Impressão | `src/main/labels.ts`                                    | string de CSS inline + HTML   |
| Editor    | `src/renderer/src/views/etiqueta-editor/labelRender.ts` | objeto `CSSProperties` do Vue |

As funções são irmãs: `elementStyle`, `fieldValue`, `qrValue`, `resolveField`, `LABEL_MAP`,
`sampleHeaders`.

> **Mudou uma, mude a outra.** O editor é WYSIWYG só enquanto as duas receitas forem idênticas. O
> renderer não pode importar de `src/main/` (processos diferentes) — é por isso que existe a
> duplicação, e os dois arquivos trazem comentário avisando.

### Por que o HTML sai assim

```html
<style>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  @page {
    size: 100mm 50mm;
    margin: 0;
  }
  .sheet {
    display: grid;
    grid-template-columns: repeat(2, 50mm);
    grid-template-rows: repeat(2, 25mm);
  }
  .label {
    position: relative;
    width: 50mm;
    height: 25mm;
    overflow: hidden;
  }
</style>
<div class="sheet">
  <div class="label">...</div>
  <div class="label">...</div>
  <div class="label">...</div>
  <div class="label">...</div>
</div>
```

- `box-sizing: border-box` para que a borda não empurre as medidas (o editor herda o mesmo
  comportamento do preflight do Tailwind).
- Quando há mais de uma etiqueta, a página usa grade de 2 colunas por padrão para caber melhor
  em folhas térmicas com 2 x N registros.
- Medidas em mm com 3 decimais — o driver converte para pontos, e arredondar antes causa deriva.
- A página impressa usa uma grade de 2 colunas e repete as linhas conforme a quantidade de
  etiquetas, mantendo cada unidade no mesmo tamanho do modelo.
- QR vai como `data:image/png` embutido (`qrcode` no main), com `image-rendering: pixelated` para não
  borrar na térmica.

## Editor visual

Rota `/etiquetas/:id/editar` (Configurações → Modelos → ícone de edição).

Estrutura:

| Arquivo                  | Papel                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `EtiquetaEditorView.vue` | Casca: header, histórico de desfazer/refazer, salvar/descartar, diálogo de escala, aviso ao sair sem salvar. |
| `EditorCanvas.vue`       | A etiqueta na tela: arrastar, redimensionar, zoom, atalhos de teclado.                                       |
| `ElementNode.vue`        | Um elemento desenhado + alças de redimensionamento.                                                          |
| `ElementsList.vue`       | Lista/empilhamento dos elementos (ordem, visibilidade, excluir).                                             |
| `PropertiesPanel.vue`    | Painel da direita com as propriedades do elemento selecionado.                                               |
| `ColumnsComposer.vue`    | Montador de `autos`/`columns` de um elemento `field`.                                                        |
| `MmField.vue`            | Input numérico em mm (formato pt-BR).                                                                        |
| `context.ts`             | Estado compartilhado do editor via `provide`/`inject`.                                                       |
| `editorUtils.ts`         | `PX_PER_MM`, `snap`, `clamp`, `round2`, `createElement`, `describeElement`.                                  |
| `labelRender.ts`         | Espelho da renderização de impressão (ver acima).                                                            |

### Atalhos do editor

| Atalho                         | Ação                                                               |
| ------------------------------ | ------------------------------------------------------------------ |
| Arrastar                       | Move o elemento com snap de **0,5 mm** (segure `Alt` para 0,05 mm) |
| Setas                          | Move 0,1 mm (`Shift` + setas = 1 mm)                               |
| `Ctrl+S`                       | Salvar                                                             |
| `Ctrl+Z` / `Ctrl+Y`            | Desfazer / refazer (até 100 passos)                                |
| `Ctrl+C` / `Ctrl+X` / `Ctrl+V` | Copiar / cortar / colar elemento (via clipboard do sistema)        |
| `Ctrl+D`                       | Duplicar elemento                                                  |
| `Delete`                       | Excluir elemento selecionado                                       |
| `Esc`                          | Desselecionar                                                      |
| `Ctrl` + roda do mouse         | Zoom                                                               |

Ao mudar a largura/altura da etiqueta, o editor pergunta **"Escalar elementos?"** — aceitar
redimensiona proporcionalmente tudo que está dentro.

## Biblioteca de modelos

Em **Configurações → Modelos** dá para criar, duplicar, renomear, ativar, excluir, exportar e
importar modelos. Tudo isso vive em `composables/useTemplates.ts`.

O arquivo exportado é um `.json`:

```json
{
  "bitredLabelTemplate": 1,
  "template": {
    "id": "...",
    "name": "Modelo padrão",
    "widthMm": 50,
    "heightMm": 25,
    "elements": []
  }
}
```

Na importação, `normalizeTemplate()` (em `src/shared/labelTemplate.ts`) valida **cada campo** com
faixa mínima/máxima e descarta o que não reconhece. Isso existe porque o arquivo é editável à mão —
um JSON estranho não pode derrubar o app. Arquivos antigos com o marcador `magnunLabelTemplate: 1`
também são aceitos.

## Adicionar um tipo novo de elemento

Exemplo: um elemento `line` (linha horizontal). São 6 pontos, em ordem:

1. **Tipo** — `src/shared/types.ts`:

   ```ts
   export interface LabelLineElement extends LabelElementBase {
     type: 'line'
     widthMm: number
     thicknessMm: number
   }

   export type LabelElement =
     LabelFieldElement | LabelTextElement | LabelBoxElement | LabelQrElement | LabelLineElement
   ```

2. **Normalização** — `src/shared/labelTemplate.ts`, novo `case 'line'` em `normalizeElement()`,
   usando os helpers `num()`/`str()` para validar faixa.

3. **Impressão** — `src/main/labels.ts`: um ramo em `elementStyle()` e, em `labelBody()`, o HTML do
   elemento (uma `div` com `border-top`, por exemplo).

4. **Editor (espelho)** — `labelRender.ts`: o **mesmo** ramo em `elementStyle()`, como
   `CSSProperties`.

5. **Criação** — `editorUtils.ts`: `ElementKind` em `context.ts`, rótulo em `TYPE_LABELS`, padrão em
   `createElement()` e texto em `describeElement()`.

6. **Propriedades** — `PropertiesPanel.vue`: os controles do novo tipo (largura, espessura).

Depois: `npm run typecheck`. Como `LabelElement` é uma união discriminada, o TypeScript aponta todos
os `switch` que ficaram sem tratar `'line'` — use isso como checklist.

## Modelo de fábrica

`factoryTemplate()` em `src/shared/labelTemplate.ts` é a réplica da etiqueta impressa de referência
(`modelo impressao.png`), com medidas extraídas da foto em 50 × 25 mm. É o modelo criado na primeira
execução e a base de "Nova etiqueta".

Se a etiqueta física mudar, é essa função que precisa ser remedida — e vale exportar o modelo antigo
antes, para não perder o ajuste fino.
