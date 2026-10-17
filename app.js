import {createFinanceUI} from './finance-ui.js';
import {ATIVOS,temPagamentos,migrarPagamentosUnicos} from './finance.js';
let financeUI;
import {createStorage} from './storage.js';
import QRCode from 'qrcode';
import {gerarPix,chavePix} from './pix.js';
import './styles.css';
import {createIcons as renderIcons, icons as iconSet} from 'lucide';
const lucide = {createIcons: () => renderIcons({icons: iconSet})};
import html2pdf from 'html2pdf.js';
import {escapeHtml,normalizarTelefone,centavos,totais,validarEmpresa,validarBackup} from './core.js';

    let dadosEmpresa = {
      nome: '',
      documento: '',
      whatsapp: '',
      cidade: '',
      pix: '',
      termos: '',
      logo: ''
    };

    let itensOrcamento = [
      { id: 1, descricao: '', qtd: 1, valor: 0 }
    ];

    let historicoOrcamentos = [];
    let orcamentoAtualVisualizado = null;



    function switchTab(tabId) {
      document.getElementById('tab-novo').classList.add('hidden');
      document.getElementById('tab-historico').classList.add('hidden');
      document.getElementById('tab-empresa').classList.add('hidden');

      const btnNovo = document.getElementById('nav-btn-novo');
      const btnHist = document.getElementById('nav-btn-historico');
      const btnEmp = document.getElementById('nav-btn-empresa');

      [btnNovo, btnHist, btnEmp].forEach(btn => {
        btn.classList.remove('text-blue-600', 'font-bold');
        btn.classList.add('text-slate-400', 'font-medium');
      });

      if (tabId === 'novo') {
        document.getElementById('tab-novo').classList.remove('hidden');
        btnNovo.classList.add('text-blue-600', 'font-bold');
      } else if (tabId === 'historico') {
        document.getElementById('tab-historico').classList.remove('hidden');
        btnHist.classList.add('text-blue-600', 'font-bold');
        renderizarHistorico();
      } else if (tabId === 'empresa') {
        document.getElementById('tab-empresa').classList.remove('hidden');
        btnEmp.classList.add('text-blue-600', 'font-bold');
      }
      lucide.createIcons();
    }

    function adicionarItem() {
      itensOrcamento.push({ id: Math.max(Date.now(),...itensOrcamento.map(i=>i.id+1)), descricao: '', qtd: 1, valor: 0 });
      renderizarItens();
      lucide.createIcons();
    }

    function removerItem(id) {
      if (itensOrcamento.length <= 1) return alert('Mantenha pelo menos 1 item.');
      itensOrcamento = itensOrcamento.filter(i => i.id !== id);
      renderizarItens();
      calcularTotal();
      lucide.createIcons();
    }

    function atualizarItem(id, campo, valor) {
      const item = itensOrcamento.find(i => i.id === id);
      if (!item) return;
      if (campo === 'descricao') item.descricao = valor;
      if (campo === 'qtd') item.qtd = parseFloat(valor);
      if (campo === 'valor') item.valor = parseFloat(valor) || 0;
      calcularTotal();
    }

    function renderizarItens() {
      const container = document.getElementById('lista-itens');
      container.innerHTML = '';
      itensOrcamento.forEach((item, index) => {
        const el = document.createElement('div');
        el.className = 'p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2';
        el.innerHTML = `
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold text-slate-500">Item #${index + 1}</span>
            <button onclick="removerItem(${item.id})" class="text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
          </div>
          <input type="text" placeholder="Descrição do serviço" value="${escapeHtml(item.descricao)}" oninput="atualizarItem(${item.id}, 'descricao', this.value)" class="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-[10px] text-slate-500">Qtd</label>
              <input type="number" min="0.001" step="0.001" value="${item.qtd}" oninput="atualizarItem(${item.id}, 'qtd', this.value)" class="w-full text-xs bg-white border border-slate-200 rounded-lg px-2 py-1">
            </div>
            <div>
              <label class="block text-[10px] text-slate-500">Valor Unitário (R$)</label>
              <input type="number" min="0" step="0.01" value="${item.valor || ''}" oninput="atualizarItem(${item.id}, 'valor', this.value)" class="w-full text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 font-semibold">
            </div>
          </div>
        `;
        container.appendChild(el);
      });
    }

    function calcularTotal() {
      let subtotal = 0;
      itensOrcamento.forEach(i => subtotal += (i.qtd * i.valor));
      const desconto = parseFloat(document.getElementById('valor-desconto').value) || 0;
      const total = Math.max(0, subtotal - desconto);

      document.getElementById('valor-subtotal').textContent = formatarMoeda(subtotal);
      document.getElementById('valor-total-destaque').textContent = formatarMoeda(total);
      return { subtotal, desconto, total };
    }

    function formatarMoeda(v) {
      return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function coletarDados() {
      const { subtotal, desconto, total } = calcularTotal();
      return {
        id: 'ORC-' + Math.floor(1000 + Math.random() * 9000),
        data: new Date().toLocaleDateString('pt-BR'),
        cliente: {
          nome: document.getElementById('cliente-nome').value.trim() || 'Cliente',
          whatsapp: document.getElementById('cliente-whatsapp').value.trim(),
          endereco: document.getElementById('cliente-endereco').value.trim()
        },
        titulo: document.getElementById('orcamento-titulo').value.trim() || 'Serviços Especializados',
        itens: JSON.parse(JSON.stringify(itensOrcamento)),
        subtotal, desconto, total,
        validade: document.getElementById('orcamento-validade').value,
        pagamento: document.getElementById('orcamento-pagamento').value.trim() || 'À vista ou Cartão',
        garantia: document.getElementById('orcamento-garantia').value.trim() || dadosEmpresa.termos,
        status: 'Pendente'
      };
    }

    function preencherTemplatePDF(orc) {
      const empresaPDF = orc.empresa || dadosEmpresa;
      orcamentoAtualVisualizado = orc;
      document.getElementById('pdf-empresa-nome').textContent = empresaPDF.nome;
      document.getElementById('pdf-empresa-doc').textContent = empresaPDF.documento ? 'CNPJ/CPF: ' + empresaPDF.documento : '';
      document.getElementById('pdf-empresa-contato').textContent = `WhatsApp: ${empresaPDF.whatsapp} | ${empresaPDF.cidade}`;
      
      const logoImg = document.getElementById('pdf-empresa-logo');
      if (empresaPDF.logo) {
        logoImg.src = empresaPDF.logo;
        logoImg.classList.remove('hidden');
      } else {
        logoImg.classList.add('hidden');
      }

      document.getElementById('pdf-orcamento-numero').textContent = '#' + orc.id;
      document.getElementById('pdf-orcamento-data').textContent = 'Data: ' + orc.data;
      document.getElementById('pdf-cliente-nome').textContent = orc.cliente.nome;
      document.getElementById('pdf-cliente-fone').textContent = orc.cliente.whatsapp ? 'WhatsApp: ' + orc.cliente.whatsapp : '';
      document.getElementById('pdf-servico-titulo').textContent = orc.titulo;
      document.getElementById('pdf-cliente-end').textContent = orc.cliente.endereco ? 'Local: ' + orc.cliente.endereco : '';

      const corpo = document.getElementById('pdf-tabela-corpo');
      corpo.innerHTML = '';
      orc.itens.forEach((it, idx) => {
        const tr = document.createElement('tr');
        tr.className = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50';
        tr.innerHTML = `
          <td class="py-2 px-3">${escapeHtml(it.descricao || 'Serviço')}</td>
          <td class="py-2 px-2 text-center">${it.qtd}</td>
          <td class="py-2 px-2 text-right">${formatarMoeda(it.valor)}</td>
          <td class="py-2 px-3 text-right font-bold">${formatarMoeda(it.qtd * it.valor)}</td>
        `;
        corpo.appendChild(tr);
      });

      document.getElementById('pdf-resumo-subtotal').textContent = formatarMoeda(orc.subtotal);
      const linhaDesc = document.getElementById('pdf-linha-desconto');
      if (orc.desconto > 0) {
        linhaDesc.classList.remove('hidden');
        document.getElementById('pdf-resumo-desconto').textContent = '- ' + formatarMoeda(orc.desconto);
      } else {
        linhaDesc.classList.add('hidden');
      }
      document.getElementById('pdf-resumo-total').textContent = formatarMoeda(orc.total);
      document.getElementById('pdf-resumo-pagamento').textContent = orc.pagamento;
      
      const boxPix = document.getElementById('pdf-box-pix');
      if (empresaPDF.pix || empresaPDF.pixQr) {
        boxPix.classList.remove('hidden');
        document.getElementById('pdf-chave-pix').textContent = empresaPDF.pix || '';
      } else {
        boxPix.classList.add('hidden');
      }

      document.getElementById('pdf-resumo-validade').textContent = 'Validade: ' + orc.validade;
      document.getElementById('pdf-resumo-garantia').textContent = 'Garantia: ' + orc.garantia;
      document.getElementById('pdf-resumo-termos').textContent = empresaPDF.termos;

      const foneLimpo = (empresaPDF.whatsapp || '').replace(/\D/g, '');
      const btnAprovar = document.getElementById('pdf-btn-aprovar');
      btnAprovar.removeAttribute('href');
      btnAprovar.style.display = foneLimpo ? '' : 'none';
      if (foneLimpo) {
        const texto = encodeURIComponent(`Olá ${empresaPDF.nome}! Aprovei o Orçamento #${orc.id} no valor de ${formatarMoeda(orc.total)}.`);
        btnAprovar.href = `https://wa.me/${normalizarTelefone(empresaPDF.whatsapp)}?text=${texto}`;
      }
      lucide.createIcons();
    }

    function visualizarPDF(orc = null) {
      preencherTemplatePDF(orc || coletarDados());
      document.getElementById('modal-preview').classList.remove('hidden');
    }

    function fecharModalPreview() {
      document.getElementById('modal-preview').classList.add('hidden');
    }

    function baixarPDF() {
      const el = document.getElementById('pdf-printable');
      const nome = `Orcamento_${orcamentoAtualVisualizado.id}.pdf`;
      html2pdf().set({ margin: [8,8,8,8], filename: nome, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4' } }).from(el).save();
    }

    function salvarOrcamentoManual() {
      const orc = coletarDados();
      salvarNoHistorico(orc);
      alert('Orçamento salvo com sucesso!');
      switchTab('historico');
    }

    function salvarNoHistorico(orc) {
      historicoOrcamentos.unshift(orc);
      localStorage.setItem('zaporcamento_historico', JSON.stringify(historicoOrcamentos));
      renderizarHistorico();
    }

    function salvarEEnviarWhatsApp() {
      const orc = coletarDados();
      salvarNoHistorico(orc);
      abrirWhatsApp(orc);
    }

    function enviarWhatsAppModal() {
      if (orcamentoAtualVisualizado) abrirWhatsApp(orcamentoAtualVisualizado);
    }

    function abrirWhatsApp(orc) {
      let fone = (orc.cliente.whatsapp || '').replace(/\D/g, '');
      if (fone.length === 10 || fone.length === 11) fone = '55' + fone;
      let msg = `*Olá ${orc.cliente.nome}! Tudo bem?*\n\n`;
      msg += `Aqui é da *${dadosEmpresa.nome}*. Segue o seu orçamento detalhado:\n\n`;
      msg += `📄 *Orçamento:* #${orc.id}\n`;
      msg += `🔧 *Serviço:* ${orc.titulo}\n`;
      msg += `💰 *Valor Total:* ${formatarMoeda(orc.total)}\n`;
      msg += `💳 *Pagamento:* ${orc.pagamento}\n\n`;
      msg += `Fico à disposição para agendarmos a realização do serviço! 🙏`;
      window.open(`https://api.whatsapp.com/send?phone=${fone}&text=${encodeURIComponent(msg)}`, '_blank');
    }

    function renderizarHistorico() {
      const lista = document.getElementById('lista-historico');
      let total = 0, aprovados = 0;
      historicoOrcamentos.forEach(o => {
        total += o.total;
        if (o.status === 'Aprovado') aprovados += o.total;
      });
      document.getElementById('metric-total-orcado').textContent = formatarMoeda(total);
      document.getElementById('metric-qtd-orcamentos').textContent = `${historicoOrcamentos.length} orçamentos`;
      document.getElementById('metric-total-aprovado').textContent = formatarMoeda(aprovados);

      lista.innerHTML = '';
      if (historicoOrcamentos.length === 0) {
        lista.innerHTML = '<p class="text-xs text-center text-slate-400 py-6">Nenhum orçamento salvo ainda.</p>';
        return;
      }

      historicoOrcamentos.forEach(orc => {
        const item = document.createElement('div');
        item.className = 'bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between';
        item.innerHTML = `
          <div>
            <span class="text-[10px] text-slate-400 font-bold">#${orc.id} • ${orc.data}</span>
            <h4 class="font-bold text-xs text-slate-800">${orc.cliente.nome}</h4>
            <span class="text-xs font-black text-blue-600">${formatarMoeda(orc.total)}</span>
          </div>
          <div class="flex items-center gap-1">
            <button onclick='visualizarOrcamentoSalvo("${orc.id}")' class="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><i data-lucide="eye" class="w-4 h-4"></i></button>
            <button onclick='abrirWhatsApp(historicoOrcamentos.find(o=>o.id==="${orc.id}"))' class="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><i data-lucide="send" class="w-4 h-4"></i></button>
          </div>
        `;
        lista.appendChild(item);
      });
      lucide.createIcons();
    }

    function visualizarOrcamentoSalvo(id) {
      const orc = historicoOrcamentos.find(o => o.id === id);
      if (orc) visualizarPDF(orc);
    }

    function tratarUploadLogo(e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        dadosEmpresa.logo = ev.target.result;
        atualizarLogo();
      };
      reader.readAsDataURL(file);
    }

    function atualizarLogo() {
      const img = document.getElementById('logo-preview-img');
      const icon = document.getElementById('logo-preview-icon');
      const btn = document.getElementById('btn-remover-logo');
      if (dadosEmpresa.logo) {
        img.src = dadosEmpresa.logo;
        img.classList.remove('hidden');
        icon.classList.add('hidden');
        btn.classList.remove('hidden');
      } else {
        img.classList.add('hidden');
        icon.classList.remove('hidden');
        btn.classList.add('hidden');
      }
    }

    function removerLogo() {
      dadosEmpresa.logo = '';
      atualizarLogo();
    }

    function salvarConfiguracoesEmpresa() {
      dadosEmpresa.nome = document.getElementById('empresa-nome').value.trim() || 'Minha Empresa';
      dadosEmpresa.documento = document.getElementById('empresa-documento').value.trim();
      dadosEmpresa.whatsapp = document.getElementById('empresa-whatsapp').value.trim();
      dadosEmpresa.cidade = document.getElementById('empresa-cidade').value.trim();
      dadosEmpresa.pix = document.getElementById('empresa-pix').value.trim();
      dadosEmpresa.termos = document.getElementById('empresa-termos').value.trim();
      localStorage.setItem('zaporcamento_empresa', JSON.stringify(dadosEmpresa));
      document.getElementById('banner-empresa-incompleta').classList.add('hidden');
      alert('Dados da empresa salvos com sucesso!');
      switchTab('novo');
    }

    function carregarDadosLocalStorage() {
      const emp = localStorage.getItem('zaporcamento_empresa');
      if (emp) {
        dadosEmpresa = JSON.parse(emp);
        document.getElementById('empresa-nome').value = dadosEmpresa.nome || '';
        document.getElementById('empresa-documento').value = dadosEmpresa.documento || '';
        document.getElementById('empresa-whatsapp').value = dadosEmpresa.whatsapp || '';
        document.getElementById('empresa-cidade').value = dadosEmpresa.cidade || '';
        document.getElementById('empresa-pix').value = dadosEmpresa.pix || '';
        document.getElementById('empresa-termos').value = dadosEmpresa.termos || '';
        atualizarLogo();
        document.getElementById('banner-empresa-incompleta').classList.add('hidden');
      }
      const hist = localStorage.getItem('zaporcamento_historico');
      if (hist) historicoOrcamentos = JSON.parse(hist);
    }
  let pixReady=Promise.resolve(), pdfBusy=false;
let estado, editId=null, activeTab='inicio', toastTimer,historyLimit=40,lastQuery='';
const $=id=>document.getElementById(id);
function avisar(msg){$('status-aviso').textContent=msg;$('status-aviso').classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('status-aviso').classList.add('hidden'),6500);}
const storage=createStorage();let writeQueue=Promise.resolve();
async function persistir(next){await storage.put(next);estado=next;dadosEmpresa=structuredClone(next.empresa);historicoOrcamentos=next.orcamentos;}
function guardar(mutacao){const action=async()=>{try{const next=structuredClone(estado);mutacao(next);await persistir(next);return true;}catch(e){avisar('Não foi possível salvar. '+e.message+' Faça backup e confira o espaço disponível.');return false;}};const result=writeQueue.then(action,action);writeQueue=result.then(()=>{},()=>{});return result;}
switchTab=function(tab,history=true){if(!['inicio','novo','historico','financeiro','empresa'].includes(tab))tab='inicio';activeTab=tab;for(const k of ['inicio','novo','historico','financeiro','empresa']){$('tab-'+k).classList.toggle('hidden',k!==tab);$('nav-btn-'+k).setAttribute('aria-current',k===tab?'page':'false');}$('titulo-historico').classList.toggle('hidden',tab!=='historico');if(history&&location.hash!=='#'+tab)location.hash=tab;renderizarHistorico();lucide.createIcons();window.scrollTo(0,0);};
window.addEventListener('hashchange',()=>switchTab(location.hash.slice(1),false));
window.voltarAndroid=()=>{if(financeUI?.closeTop())return true;if(!$('modal-preview').classList.contains('hidden')){fecharModalPreview();return true;}if(activeTab!=='inicio'){switchTab('inicio');return true;}return false;};
function novoOrcamento(){if(!estado)return;const old=historicoOrcamentos.find(o=>o.id===editId);let dirty=!!($('cliente-nome').value.trim()||itensOrcamento.some(i=>i.descricao.trim()));if(old){try{const current=coletarDados();dirty=['cliente','titulo','itens','desconto','total','validade','pagamento','garantia','financeiro'].some(k=>JSON.stringify(current[k])!==JSON.stringify(old[k]));}catch{dirty=true;}}if(dirty&&!confirm('Começar outro orçamento? O preenchimento ainda não salvo será descartado.'))return;editId=null;financeUI?.resetPlan();orcamentoAtualVisualizado=null;fecharModalPreview();for(const id of ['cliente-nome','cliente-whatsapp','cliente-endereco','orcamento-titulo','valor-desconto','orcamento-pagamento','orcamento-garantia','orcamento-validade'])$(id).value='';itensOrcamento=[{id:Date.now(),descricao:'',qtd:1,valor:0}];renderizarItens();calcularTotal();switchTab('novo');}
coletarDados=function(){if(!dadosEmpresa.nome.trim())throw Error('Cadastre o nome da sua empresa em Ajustes.');const nome=$('cliente-nome').value.trim();if(!nome)throw Error('Informe o nome do cliente.');if(!itensOrcamento.every(i=>i.descricao.trim()))throw Error('Preencha a descrição de todos os itens.');if(!$('orcamento-validade').value)throw Error('Selecione a validade do orçamento.');const anterior=historicoOrcamentos.find(o=>o.id===editId);return {id:editId||'ORC-'+String(estado.nextNumber).padStart(5,'0'),data:anterior?.data||new Date().toLocaleDateString('pt-BR'),cliente:{nome,whatsapp:$('cliente-whatsapp').value.trim(),endereco:$('cliente-endereco').value.trim()},titulo:$('orcamento-titulo').value.trim(),itens:structuredClone(itensOrcamento),...totais(itensOrcamento,$('valor-desconto').value),validade:$('orcamento-validade').value,pagamento:$('orcamento-pagamento').value.trim(),garantia:$('orcamento-garantia').value.trim(),status:anterior?.status||'Pendente',empresa:structuredClone(anterior?.empresa||dadosEmpresa),financeiro:financeUI?.readPlan(centavos(totais(itensOrcamento,$('valor-desconto').value).total))||null};};
calcularTotal=function(){try{const t=totais(itensOrcamento,$('valor-desconto').value);$('valor-subtotal').textContent=formatarMoeda(t.subtotal);$('valor-total-destaque').textContent=formatarMoeda(t.total);return t;}catch(e){$('valor-total-destaque').textContent='Confira os valores';return null;}};
async function salvarFormulario(){const o=coletarDados();if(!await guardar(s=>{const i=s.orcamentos.findIndex(x=>x.id===o.id);if(i<0){s.orcamentos.unshift(o);s.nextNumber++;}else s.orcamentos[i]=o;}))throw Error('O orçamento não foi salvo.');editId=o.id;renderizarHistorico();return o;}
salvarOrcamentoManual=async function(){try{await salvarFormulario();avisar('Orçamento salvo em Orçamentos criados.');switchTab('historico');}catch(e){avisar(e.message);}};
visualizarPDF=function(o=null){try{const doc=o||coletarDados();preencherTemplatePDF(doc);financeUI?.quoteSchedule(doc);pixReady=prepararPix(doc);$('modal-preview').classList.remove('hidden');}catch(e){avisar(e.message);}};
salvarEEnviarWhatsApp=async function(){try{const doc=await salvarFormulario();visualizarPDF(doc);await baixarPDF('share');}catch(e){avisar(e.message);}};
abrirWhatsApp=function(o){try{if(!o)throw Error('Orçamento não encontrado.');const fone=normalizarTelefone(o.cliente.whatsapp);const empresa=o.empresa||dadosEmpresa;const msg=`Olá ${o.cliente.nome}! Segue o orçamento ${o.id} de ${empresa.nome}.\n${o.titulo}\n`+o.itens.map(i=>`${i.descricao}: ${i.qtd} x ${formatarMoeda(i.valor)}`).join('\n')+`\nTotal: ${formatarMoeda(o.total)}\nPagamento: ${o.pagamento}\nValidade: ${o.validade}${financeUI?.messageSchedule(o)||''}\nNo PDF tem o botão para você aprovar o serviço.`;const url=`https://wa.me/${fone}?text=${encodeURIComponent(msg)}`;if(window.Android)Android.openWhatsApp(url);else window.open(url,'_blank','noopener');}catch(e){avisar(e.message);}};
function editarOrcamento(id){const o=historicoOrcamentos.find(x=>x.id===id);if(!o)return;editId=id;financeUI?.loadPlan(o);for(const [key,value] of Object.entries({'cliente-nome':o.cliente.nome,'cliente-whatsapp':o.cliente.whatsapp,'cliente-endereco':o.cliente.endereco,'orcamento-titulo':o.titulo,'valor-desconto':o.desconto,'orcamento-validade':o.validade,'orcamento-pagamento':o.pagamento,'orcamento-garantia':o.garantia}))$(key).value=value;itensOrcamento=structuredClone(o.itens);renderizarItens();calcularTotal();switchTab('novo');avisar('Editando '+id+'. Salve para confirmar as alterações.');}
async function excluirOrcamento(id){const alvo=historicoOrcamentos.find(o=>o.id===id);if(alvo?.financeiro&&!confirm('Excluir este serviço também apagará todas as parcelas e os recebimentos dele, alterando os totais financeiros. Faça backup antes. Continuar?'))return;if(!confirm('Excluir este orçamento? Esta ação não pode ser desfeita.'))return;if(await guardar(s=>s.orcamentos=s.orcamentos.filter(o=>o.id!==id))){if(editId===id){editId=null;financeUI?.resetPlan();for(const key of ['cliente-nome','cliente-whatsapp','cliente-endereco','orcamento-titulo','valor-desconto','orcamento-pagamento','orcamento-garantia','orcamento-validade'])$(key).value='';itensOrcamento=[{id:Date.now(),descricao:'',qtd:1,valor:0}];renderizarItens();calcularTotal();}renderizarHistorico();avisar('Orçamento excluído.');}}
async function mudarStatus(id,status){const o=historicoOrcamentos.find(o=>o.id===id);if(temPagamentos(o)&&!ATIVOS.includes(status)){avisar('Desfaça os pagamentos antes de retirar este serviço do financeiro.');renderizarHistorico();return;}if(await guardar(s=>{s.orcamentos.find(o=>o.id===id).status=status;}))renderizarHistorico();}
renderizarHistorico=function(){if(!estado)return;financeUI?.render();const total=historicoOrcamentos.reduce((s,o)=>s+centavos(o.total),0)/100;const approved=historicoOrcamentos.filter(o=>['Aprovado','Concluído'].includes(o.status));$('metric-total-orcado').textContent=formatarMoeda(total);$('metric-qtd-orcamentos').textContent=historicoOrcamentos.length+' orçamentos';$('metric-total-aprovado').textContent=formatarMoeda(approved.reduce((s,o)=>s+centavos(o.total),0)/100);$('metric-taxa-conversao').textContent=(historicoOrcamentos.length?Math.round(approved.length/historicoOrcamentos.length*100):0)+'% aprovados';$('resumo-inicio').textContent=`${historicoOrcamentos.length} orçamentos criados • ${formatarMoeda(total)} em orçamentos • ${approved.length} aprovados ou concluídos`;$('ultimo-backup').textContent=estado.lastBackup?'Última exportação: '+new Date(estado.lastBackup).toLocaleString('pt-BR'):'Ainda não foi exportado um backup.';const q=$('filtro-busca').value.toLocaleLowerCase('pt-BR');if(q!==lastQuery){historyLimit=40;lastQuery=q;}const lista=$('lista-historico');lista.replaceChildren();const selected=historicoOrcamentos.filter(o=>(o.cliente.nome+' '+o.titulo+' '+o.id).toLocaleLowerCase('pt-BR').includes(q));if(!selected.length){lista.textContent=q?'Nenhum orçamento encontrado.':'Seus orçamentos salvos aparecerão aqui.';return;}for(const o of selected.slice(0,historyLimit)){const card=document.createElement('article');card.className='bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3';const title=document.createElement('h3');title.className='font-bold';title.textContent=o.id+' • '+o.cliente.nome;card.append(title);const details=document.createElement('p');details.className='text-sm';details.textContent=o.titulo+' • '+o.data+' • '+formatarMoeda(o.total);card.append(details);const status=document.createElement('select');status.className='w-full p-2 bg-slate-50 rounded-xl';status.setAttribute('aria-label','Situação de '+o.id);for(const value of ['Pendente','Aprovado','Recusado','Concluído']){const opt=new Option(value,value,value===o.status,value===o.status);status.add(opt);}status.onchange=()=>mudarStatus(o.id,status.value);card.append(status);const actions=document.createElement('div');actions.className='grid grid-cols-2 gap-2';for(const [label,fn] of [['Ver / PDF',()=>visualizarPDF(o)],['Enviar PDF',async()=>{visualizarPDF(o);await baixarPDF('share');}],['WhatsApp do cliente',()=>abrirWhatsApp(o)],['Editar',()=>editarOrcamento(o.id)],['Excluir',()=>excluirOrcamento(o.id)]]){const btn=document.createElement('button');btn.className='p-2 rounded-xl bg-blue-50 text-blue-700 font-bold text-sm';btn.textContent=label;btn.onclick=fn;actions.append(btn);}card.append(actions);lista.append(card);}if(selected.length>historyLimit){const more=document.createElement('button');more.className='w-full p-3 bg-blue-50 text-blue-700 rounded-xl font-bold';more.textContent='Mostrar mais orçamentos';more.onclick=()=>{historyLimit+=40;renderizarHistorico();};lista.append(more);}};
salvarConfiguracoesEmpresa=async function(){const empresa=Object.fromEntries(['nome','documento','whatsapp','cidade','pix','termos'].map(k=>[k,$('empresa-'+k).value.trim()]));empresa.logo=dadosEmpresa.logo;empresa.pixQr=dadosEmpresa.pixQr||'';empresa.pixMode=$('empresa-pix-modo').value;empresa.pixType=$('empresa-pix-tipo').value;if(empresa.pix && empresa.pixMode!=='imagem'){try{empresa.pix=chavePix(empresa.pix,empresa.pixType);}catch(e){avisar(e.message);return;}}if(!empresa.nome){avisar('Informe o nome da empresa.');return;}try{if(empresa.whatsapp)normalizarTelefone(empresa.whatsapp);if(!validarEmpresa(empresa))throw Error('Confira os dados e o tamanho do logotipo.');if(await guardar(s=>s.empresa=empresa)){$('banner-empresa-incompleta').classList.add('hidden');avisar('Dados da empresa salvos.');switchTab('inicio');}}catch(e){avisar(e.message);}};
tratarUploadLogo=function(e){const file=e.target.files[0];if(!file)return;if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>8000000){avisar('Escolha uma imagem PNG, JPEG ou WebP de até 8 MB.');return;}const image=new Image();const url=URL.createObjectURL(file);image.onload=()=>{const canvas=document.createElement('canvas');const scale=Math.min(1,600/Math.max(image.width,image.height));canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);dadosEmpresa.logo=canvas.toDataURL('image/png');atualizarLogo();URL.revokeObjectURL(url);};image.onerror=()=>{URL.revokeObjectURL(url);avisar('Não foi possível abrir essa imagem.');};image.src=url;};
const nativeRequests=new Map();let requestCounter=0;
window.nativeResult=(id,ok,message)=>{const req=nativeRequests.get(id);if(!req)return;nativeRequests.delete(id);ok?req.resolve(message):req.reject(Error(message));};
function nativeRequest(action,data,name,mime){return new Promise((resolve,reject)=>{const id=String(++requestCounter);nativeRequests.set(id,{resolve,reject});Android.exportFile(JSON.stringify({id,action,data,name,mime}));});}
async function exportarArquivo(blob,name,action='save'){if(!blob.size)throw Error('O arquivo está vazio.');if(window.Android){const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));await nativeRequest(action,btoa(binary),name,blob.type);}else{const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}}
function objetoBackup(){return {app:'zaporcamento',version:2,exportedAt:new Date().toISOString(),...structuredClone(estado)};}
async function exportarBackup(){try{await writeQueue;const b=objetoBackup();if(!validarBackup(b))throw Error('Os dados precisam ser conferidos antes de exportar.');await exportarArquivo(new Blob([JSON.stringify(b,null,2)],{type:'application/json'}),'ZapOrcamento-Backup-'+new Date().toISOString().slice(0,10)+'.json');await guardar(s=>s.lastBackup=new Date().toISOString());renderizarHistorico();avisar(window.Android?'Backup gravado e conferido. Guarde o arquivo em local seguro.':'Download solicitado. Confira o arquivo na pasta Downloads.');}catch(e){avisar('Backup não concluído: '+e.message);}}
async function restaurarBackup(event){const file=event.target.files[0];try{if(!file)return;const b=JSON.parse(await file.text());if(!validarBackup(b))throw Error('Este arquivo não é um backup válido do ZapOrçamento.');if(!confirm(`Restaurar ${b.orcamentos.length} orçamentos? Os dados atuais serão substituídos. Exporte um backup antes se precisar guardá-los.`))return;const nextNumber=b.orcamentos.reduce((n,o)=>Math.max(n,Number(o.id.slice(4))+1),b.nextNumber);await writeQueue;await persistir(migrarPagamentosUnicos({empresa:b.empresa,orcamentos:b.orcamentos,nextNumber,lastBackup:b.lastBackup||null}).estado);preencherEmpresa();editId=null;financeUI?.resetPlan();renderizarHistorico();switchTab('historico');avisar('Backup restaurado. Confira seus orçamentos.');}catch(e){avisar('Restauração não concluída: '+e.message);}finally{event.target.value='';}}
function preencherEmpresa(){$('empresa-pix-modo').value=dadosEmpresa.pixMode||'gerado';atualizarQrPreview();$('empresa-pix-tipo').value=dadosEmpresa.pixType||'auto';for(const k of ['nome','documento','whatsapp','cidade','pix','termos'])$('empresa-'+k).value=dadosEmpresa[k]||'';atualizarLogo();$('banner-empresa-incompleta').classList.toggle('hidden',!!dadosEmpresa.nome);}
carregarDadosLocalStorage=async function(){try{const stored=await storage.get();const raw=stored?JSON.stringify(stored):localStorage.getItem('zaporcamento_estado_v1');if(raw){const next=JSON.parse(raw);if(!validarBackup({app:'zaporcamento',version:1,...next}))throw Error('Dados locais não reconhecidos. Não limpe os dados; procure o suporte.');estado=next;}else{const emp=JSON.parse(localStorage.getItem('zaporcamento_empresa')||'null');const hist=JSON.parse(localStorage.getItem('zaporcamento_historico')||'[]');const empresa=emp||dadosEmpresa;const ids=new Set();const migrated=hist.map((o,i)=>{let id=/^ORC-\d+$/.test(o.id)&&!ids.has(o.id)?o.id:'ORC-'+String(100000+i);ids.add(id);return{...o,id,empresa:structuredClone(empresa)};});estado={empresa,orcamentos:migrated,nextNumber:migrated.reduce((n,o)=>Math.max(n,Number(o.id.slice(4))+1),1),lastBackup:null};}const migration=migrarPagamentosUnicos(estado);estado=migration.estado;if(migration.changed||(!stored&&(raw||localStorage.getItem('zaporcamento_empresa')||localStorage.getItem('zaporcamento_historico'))))await storage.put(estado);dadosEmpresa=structuredClone(estado.empresa);historicoOrcamentos=estado.orcamentos;preencherEmpresa();return true;}catch(e){avisar('Não foi possível carregar os dados: '+e.message);return false;}};
baixarPDF=async function(action='save'){try{if(pdfBusy)return;pdfBusy=true;document.querySelectorAll('#modal-preview button[data-export]').forEach(b=>b.disabled=true);if(!orcamentoAtualVisualizado)throw Error('Abra um orçamento primeiro.');await pixReady;await Promise.all([...$('pdf-printable').querySelectorAll('img')].filter(i=>i.src&&!i.classList.contains('hidden')).map(i=>i.decode?.().catch(()=>{})||Promise.resolve()));const blob=await html2pdf().set({margin:[8,8,8,8],html2canvas:{scale:2},jsPDF:{unit:'mm',format:'a4'},pagebreak:{mode:['css','legacy']}}).from($('pdf-printable')).outputPdf('blob');if(!historicoOrcamentos.some(o=>o.id===orcamentoAtualVisualizado.id)){const doc=orcamentoAtualVisualizado;if(!await guardar(s=>{s.orcamentos.unshift(structuredClone(doc));s.nextNumber=Math.max(s.nextNumber,Number(doc.id.slice(4))+1);}))throw Error('Não foi possível guardar o orçamento.');editId=doc.id;renderizarHistorico();}await exportarArquivo(blob,orcamentoAtualVisualizado.id+'.pdf',action);avisar(action==='share'?'PDF preparado para compartilhar.':'PDF salvo.');}catch(e){avisar('Não foi possível exportar o PDF: '+e.message);}finally{pdfBusy=false;document.querySelectorAll('#modal-preview button[data-export]').forEach(b=>b.disabled=false);}};
Object.assign(window,{switchTab,adicionarItem,removerItem,atualizarItem,calcularTotal,visualizarPDF,fecharModalPreview,baixarPDF,salvarOrcamentoManual,salvarEEnviarWhatsApp,enviarWhatsAppModal,abrirWhatsApp,renderizarHistorico,visualizarOrcamentoSalvo,tratarUploadLogo,removerLogo,salvarConfiguracoesEmpresa,novoOrcamento,exportarBackup,restaurarBackup});
window.appReady=(async()=>{document.querySelector('main').inert=true;if(await carregarDadosLocalStorage()){renderizarItens();calcularTotal();renderizarHistorico();switchTab(location.hash.slice(1)||'inicio',false);document.querySelector('main').inert=false;}lucide.createIcons();})();

async function prepararPix(o){const e=o.empresa||dadosEmpresa;$('pdf-pix-qr').style.display='none';if(e.pixMode==='imagem'&&e.pixQr){$('pdf-qr-image').src=e.pixQr;$('pdf-pix-qr').style.display='flex';$('pdf-qr-legenda').textContent='QR Code fornecido pela empresa. Confira recebedor e valor no banco.'+(o.financeiro?' Não é um QR Code específico de parcela.':'');return;}if(!e.pix)return;try{const payload=gerarPix({key:e.pix,type:e.pixType||'auto',name:e.nome,city:e.cidade,total:o.total});const url=await QRCode.toDataURL(payload,{errorCorrectionLevel:'M',margin:4,width:448});$('pdf-qr-image').src=url;$('pdf-pix-qr').style.display='flex';$('pdf-qr-legenda').textContent=o.financeiro?.parcelas.length>1?'QR Code do total do orçamento. Para pagar uma parcela, solicite a cobrança específica. Confira valor e recebedor no banco.':'Pague pelo QR Code Pix. Confira valor e recebedor no banco.';}catch(e){avisar('QR Code não incluído: '+e.message+' A chave escrita foi mantida.');}}
function atualizarQrPreview(){const img=$('empresa-qr-preview');if(!img)return;img.src=dadosEmpresa.pixQr||'';img.classList.toggle('hidden',!dadosEmpresa.pixQr);}
function removerQrPix(){dadosEmpresa.pixQr='';atualizarQrPreview();avisar('Imagem removida. Salve os dados da empresa para confirmar.');}
function uploadQrPix(event){const file=event.target.files[0];if(!file)return;if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>8000000){avisar('Escolha uma imagem PNG, JPEG ou WebP de até 8 MB.');return;}const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{const canvas=document.createElement('canvas');const scale=Math.min(1,900/Math.max(img.width,img.height));canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);dadosEmpresa.pixQr=canvas.toDataURL('image/png');$('empresa-pix-modo').value='imagem';atualizarQrPreview();URL.revokeObjectURL(url);avisar('QR Code carregado. Salve os dados da empresa.');};img.onerror=()=>{URL.revokeObjectURL(url);avisar('Não foi possível abrir a imagem.');};img.src=url;}
Object.assign(window,{uploadQrPix,removerQrPix});
document.addEventListener('focusin',e=>{if(e.target.matches('input,textarea,select')){setTimeout(()=>e.target.scrollIntoView({block:'center',behavior:'smooth'}),350);}});
window.ajustarTeclado=aberto=>{document.documentElement.classList.toggle('keyboard-open',aberto);if(aberto)setTimeout(()=>document.activeElement?.scrollIntoView({block:'center',behavior:'smooth'}),180);};

function abrirConversaFormulario(){try{abrirWhatsApp(coletarDados());}catch(e){avisar(e.message);}}
function abrirConversaPreview(){if(orcamentoAtualVisualizado)abrirWhatsApp(orcamentoAtualVisualizado);}
Object.assign(window,{abrirConversaFormulario,abrirConversaPreview});

financeUI=createFinanceUI({document,getState:()=>estado,guardar,avisar,switchTab:tab=>switchTab(tab),edit:id=>editarOrcamento(id),refresh:()=>renderizarHistorico(),getTotal:()=>{const t=calcularTotal();return t?centavos(t.total):null;},openWhatsApp:url=>{if(window.Android)Android.openWhatsApp(url);else window.open(url,'_blank','noopener');},qr:payload=>QRCode.toDataURL(payload,{errorCorrectionLevel:'M',margin:4,width:448}),exportPdf:async(element,name,action)=>{await Promise.all([...element.querySelectorAll('img')].map(i=>i.decode?.().catch(()=>{})||Promise.resolve()));const blob=await html2pdf().set({margin:[8,8,8,8],html2canvas:{scale:2},jsPDF:{unit:'mm',format:'a4'},pagebreak:{mode:['css','legacy']}}).from(element).outputPdf('blob');await exportarArquivo(blob,name,action);}});
window.appReady=window.appReady.then(()=>{financeUI.render();lucide.createIcons();});
Object.assign(window,{editarOrcamento,mudarStatus,excluirOrcamento});
