# ZapOrçamento - versão Android para testes

Este pacote continua o projeto original e mantém a estrutura visual do PDF.

## Colocar no GitHub

1. Extraia o ZIP em uma pasta separada.
2. Copie o conteúdo da pasta extraída para a pasta local do repositório ZapOrçamento. Não apague a pasta .git.
3. No GitHub Desktop, revise as alterações, faça Commit to main e Push origin.
4. No navegador, abra Actions > Gerar APK Android.
5. Quando concluir, baixe ZapOrcamento-APK-TESTE-v1.0.0 e extraia o instalador.

O pacote contém código-fonte; o APK será gerado pelo GitHub Actions. O APK de teste não é a versão de distribuição comercial. A assinatura permanente será configurada após os testes.

## Alterações

- Início, Novo, Orçamentos e Ajustes no topo.
- Formulário sem empresa, serviço, preço ou garantia fictícios preenchidos.
- Orçamentos salvos antes da visualização do PDF ou envio por WhatsApp.
- Numeração sequencial, busca por nome/serviço/número, edição, exclusão e status manual.
- Dados da empresa preservados em cada orçamento.
- Cálculos monetários com arredondamento em centavos.
- Recursos empacotados no APK para operação offline.
- PDF com o mesmo modelo visual e QR Code Pix opcional junto da chave escrita.
- Backup JSON com validação, escolha do local de salvamento e conferência da gravação no Android.
- Retorno do Android fecha a visualização ou volta ao início.

## Conferência no celular antes da venda

1. Cadastre empresa, logotipo, cidade, telefone e chave Pix que realmente esteja cadastrada no banco.
2. Crie um orçamento com vários itens e desconto. Salve e volte a Orçamentos.
3. Feche e reabra o aplicativo: o orçamento deve continuar listado.
4. Busque, edite e altere o status; confira os totais.
5. Abra o PDF, salve em Downloads e compartilhe com seu próprio WhatsApp.
6. Leia o QR Code pelo banco e confira recebedor e valor. Não é necessário concluir o pagamento.
7. Exporte backup para Downloads, confira se o JSON tem conteúdo e restaure no app; confira empresa e orçamentos.
8. Teste em modo avião. WhatsApp e transferências bancárias precisam de internet; cadastrar e consultar dados, gerar PDF e QR Code não precisam.

O aplicativo não verifica se a chave Pix existe no banco e não confirma pagamentos nem aprovação de orçamentos automaticamente. O status é atualizado pelo usuário. A mensagem de WhatsApp não anexa um PDF automaticamente; use Compartilhar PDF.

Não desinstale um aplicativo com dados importantes antes de confirmar um backup restaurável.

## Verificações locais

npm ci
npm test
npm run build

Testes de regras e fluxos de tela executados. A compilação Android e a interação com seletores de arquivo devem ser verificadas no GitHub Actions e no aparelho. Não há SDK Android neste ambiente de revisão.
