# Design Spec: Exportação de Guia de Consulta no Painel de Guias

## 1. Contexto e Motivação
No painel da clínica (`/desktop/guias`), os operadores necessitam visualizar, imprimir ou baixar a guia de autorização de consultas confirmadas para fornecer ao paciente ou anexar ao prontuário físico.
Atualmente, as guias são listadas apenas com informações textuais básicas, sem qualquer botão ou mecanismo de exportação, embora o aplicativo mobile já conte com um motor oficial de geração visual de guias ([`createAuthorizationGuide`](file:///c:/Users/alder/maissaude/src/lib/authorization-guide.ts)).

## 2. Requisitos e Escopo
1. **Botão de Ação na Listagem:**
   - Adicionar o botão "Exportar guia" (com ícone de download/visualização) em cada cartão de guia na tela `GuidesView`.
2. **Modal de Pré-visualização (`GuideExportDialog`):**
   - Ao clicar no botão, abrir um diálogo modal elegante com pré-visualização completa do documento oficial da guia.
   - Fornecer duas ações principais:
     - **Imprimir (PDF):** dispara a impressão nativa formatada para tamanho A4, permitindo salvar em PDF ou imprimir diretamente na impressora física sem poluição visual da página.
     - **Baixar imagem (PNG):** realiza o download do arquivo de imagem em alta resolução (`guia-cuidarsaude-<numero>.png`).
3. **Enriquecimento da API `/api/desktop/guides`:**
   - Devolver todos os atributos necessários para compor [`AuthorizationGuideInput`](file:///c:/Users/alder/maissaude/src/lib/authorization-guide.ts):
     - Paciente: `id, name, cpf, birthDate`.
     - Profissional: `id, name, specialty, credentialLabel, credentialCode, location, startHour, endHour`.
     - Procedimento/Serviço: `name, price`.
     - Clínica: `name, phone, address, city` (buscado da tabela `clinics` ou fallback padrão).
     - Objeto de guia pronto para exportação (`guideInput`).

## 3. Arquitetura e Componentes

### 3.1. Utilitário de Impressão (`src/lib/authorization-guide.ts`)
- Adicionar a função auxiliar `printAuthorizationGuide(blob: Blob): void`:
  - Cria um `iframe` oculto temporário ou janela de impressão contendo a imagem da guia centralizada e estilizada com `@media print { @page { size: A4 portrait; margin: 10mm; } img { width: 100%; height: auto; } }`.
  - Dispara `window.print()` e remove o recurso após conclusão ou fechamento.

### 3.2. Rota de API (`src/app/api/desktop/guides/route.ts`)
- Consultar na tabela `patients`: `id, name, cpf, birth_date`.
- Consultar na tabela `professionals`: `id, name, specialty, credential_label, credential_code, location, start_hour, end_hour`.
- Consultar a clínica padrão na tabela `clinics`: `id, name, phone, address, city`.
- Mapear para cada guia o objeto `guideInput: AuthorizationGuideInput` completo.

### 3.3. Componente `GuideExportDialog` (`src/components/desktop/guide-export-dialog.tsx`)
- Props: `{ open: boolean; onOpenChange: (open: boolean) => void; guide: DesktopGuideItem | null }`.
- Efeito de renderização com `createAuthorizationGuide(guide.guideInput)`.
- Exibe spinner/mensagem de carregamento enquanto prepara o canvas.
- Exibe imagem da guia com scroll suave e moldura de alta definição.
- Botões: "Imprimir", "Baixar imagem (PNG)" e "Fechar".

### 3.4. Atualização de `GuidesView` (`src/components/desktop/guides-view.tsx`)
- Integrar estado `exportGuide: DesktopGuideItem | null`.
- Incluir botão `<Button variant="outline" size="sm" onClick={() => setExportGuide(guide)}>` em cada item da lista.
- Renderizar `<GuideExportDialog open={Boolean(exportGuide)} onOpenChange={(open) => !open && setExportGuide(null)} guide={exportGuide} />`.

## 4. Tratamento de Erros e Casos de Borda
- **Guia Inválida / Não Paga:** A modal ainda permite a visualização/exportação se o operador precisar consultar a guia, porém destaca a tarja de status e aviso de não validade.
- **Falha na Geração da Imagem:** Mensagem de erro via `toast.error("Não foi possível gerar a guia para exportação.")`.
- **Limpeza de Memória:** `URL.revokeObjectURL` executado rigorosamente na desmontagem ou atualização da guia.

## 5. Plano de Testes e Validação
1. **Teste Automatizado:**
   - Adicionar teste unitário/integração para validar a resposta enriquecida de `/api/desktop/guides` e a renderização do botão e modal no painel.
2. **Validação de Build:**
   - Executar `npm test` e `npm run build` para garantir conformidade com o Next.js 16 e tipagem estrita do TypeScript.
