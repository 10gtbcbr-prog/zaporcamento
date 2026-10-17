// Dinheiro financeiro sempre em centavos; datas civis, sem conversão UTC.
export const ATIVOS = ['Aprovado', 'Concluído'];
export const FORMAS = ['Pix', 'Dinheiro', 'Cartão', 'Transferência', 'Outro'];
const LIMITE = 99999999900;
export function hojeLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function dataValida(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y,m,d] = s.split('-').map(Number);
  if(y < 1900 || y > 9999 || m < 1 || m > 12) return false;
  return d > 0 && d <= new Date(y,m,0).getDate();
}
export function dataBR(s) { return dataValida(s) ? s.split('-').reverse().join('/') : ''; }
export function diasEntre(a,b) {
  if(!dataValida(a)||!dataValida(b)) throw Error('Data inválida.');
  const utc=s=>{const [y,m,d]=s.split('-').map(Number);return Date.UTC(y,m-1,d);};
  return Math.round((utc(b)-utc(a))/86400000);
}
export function proximaData(base, indice, intervalo='mensal') {
  if(!dataValida(base)||!Number.isInteger(indice)||indice<0||!['mensal','quinzenal','semanal'].includes(intervalo)) throw Error('Confira data e intervalo das parcelas.');
  const [y,m,d]=base.split('-').map(Number);
  let result;
  if(intervalo==='mensal') { const last=new Date(y,m+indice,0).getDate(); result=new Date(y,m-1+indice,Math.min(d,last)); }
  else result=new Date(y,m-1,d+indice*(intervalo==='semanal'?7:15));
  const s=hojeLocal(result);if(!dataValida(s))throw Error('Vencimento fora do intervalo permitido.');return s;
}
const inteiro=v=>Number.isSafeInteger(v)&&v>0&&v<=LIMITE;
export function pago(p){return p.pagamentos.reduce((s,x)=>s+x.valor,0);}
export function saldo(p){return p.valor-pago(p);}
export function temPagamentos(o){return !!o?.financeiro?.parcelas.some(p=>p.pagamentos.length);}
export function pagamentoUnico(f){return !!f&&f.parcelas.length===1&&f.parcelas[0].tipo==='parcela';}
export function normalizarBusca(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR');}
// Registros antigos não possuem vencimento: incluir a dívida sem inventar mês ou atraso.
export function migrarPagamentosUnicos(estado){
  let changed=false;
  const orcamentos=estado.orcamentos.map(o=>{
    if(o.financeiro||o.total<=0)return o;
    changed=true;
    return {...o,financeiro:{schema:1,modo:'unico',parcelas:[{id:'unico-'+o.id,numero:1,tipo:'parcela',data:null,valor:Math.round(o.total*100),pagamentos:[],ultimaCobranca:null}]}};
  });
  return {estado:changed?{...estado,orcamentos}:estado,changed};
}
export function gerarPlano({total,entrada=0,quantidade=1,primeiraData,dataEntrada=hojeLocal(),intervalo='mensal',idPrefix='p'}) {
  if(!inteiro(total)||!Number.isSafeInteger(entrada)||entrada<0||entrada>total)throw Error('Confira o total e a entrada.');
  if(!Number.isInteger(quantidade)||quantidade<1||quantidade>24)throw Error('Escolha de 1 a 24 parcelas.');
  const restante=total-entrada;
  if((entrada&&!dataValida(dataEntrada))||(restante&&!dataValida(primeiraData)))throw Error('Informe as datas de vencimento.');
  if(restante&&Math.floor(restante/quantidade)<1)throw Error('O valor precisa permitir pelo menos R$ 0,01 por parcela.');
  const parcelas=[];
  if(entrada)parcelas.push({id:idPrefix+'-entrada',numero:0,tipo:'entrada',data:dataEntrada,valor:entrada,pagamentos:[],ultimaCobranca:null});
  for(let i=0;i<(restante?quantidade:0);i++) parcelas.push({id:idPrefix+'-'+(i+1),numero:i+1,tipo:'parcela',data:proximaData(primeiraData,i,intervalo),valor:Math.floor(restante/quantidade)+(i===quantidade-1?restante%quantidade:0),pagamentos:[],ultimaCobranca:null});
  return {schema:1,parcelas};
}
export function validarFinanceiro(f,total) {
  if(f==null)return true;
  if(!f||f.schema!==1||!Array.isArray(f.parcelas)||!f.parcelas.length||f.parcelas.length>25||(f.modo!=null&&!['unico','parcelado'].includes(f.modo)))return false;
  if(f.modo==='unico'&&!pagamentoUnico(f))return false;
  const ids=new Set(),paymentIds=new Set();let sum=0,entries=0,n=0;
  for(const p of f.parcelas){
    const undatedSingle=p?.data===null&&f.modo==='unico'&&pagamentoUnico(f);
    if(!p||typeof p.id!=='string'||!p.id||p.id.length>120||ids.has(p.id)||!inteiro(p.valor)||(!dataValida(p.data)&&!undatedSingle)||!['entrada','parcela'].includes(p.tipo)||!Array.isArray(p.pagamentos)||!Number.isInteger(p.numero)||p.numero!==(p.tipo==='entrada'?0:++n)|| (p.ultimaCobranca!=null&&!dataValida(p.ultimaCobranca)))return false;
    ids.add(p.id);if(p.tipo==='entrada'&&++entries>1)return false;
    let received=0;
    for(const r of p.pagamentos){if(!r||typeof r.id!=='string'||!r.id||r.id.length>120||paymentIds.has(r.id)||!inteiro(r.valor)||!dataValida(r.data)||!FORMAS.includes(r.forma))return false;paymentIds.add(r.id);received+=r.valor;}
    if(received>p.valor)return false;sum+=p.valor;
  }
  return sum===total&&Number.isSafeInteger(sum);
}
export function situacao(p,hoje=hojeLocal()) {
  if(!saldo(p))return 'Pago';
  if(!dataValida(p.data))return 'Vencimento a definir';
  return p.data<hoje?'Atrasada':p.data===hoje?'Vence hoje':'A vencer';
}
export function registrarPagamento(f,parcelaId,{id,data,valor,forma},hoje=hojeLocal()) {
  const next=structuredClone(f),p=next.parcelas.find(p=>p.id===parcelaId);
  if(!p||!inteiro(valor)||valor>saldo(p))throw Error('O pagamento deve ser maior que zero e não pode ultrapassar o saldo.');
  if(!dataValida(data)||data>hoje)throw Error('Informe uma data de recebimento válida, até hoje.');
  if(!FORMAS.includes(forma)||typeof id!=='string'||!id||next.parcelas.some(p=>p.pagamentos.some(r=>r.id===id)))throw Error('Pagamento inválido ou já registrado.');
  p.pagamentos.push({id,data,valor,forma});return next;
}
export function desfazerPagamento(f,parcelaId,pagamentoId) {
  const next=structuredClone(f),p=next.parcelas.find(p=>p.id===parcelaId),i=p?.pagamentos.findIndex(r=>r.id===pagamentoId);
  if(i==null||i<0)throw Error('Pagamento não encontrado.');p.pagamentos.splice(i,1);return next;
}
export function resumoFinanceiro(orcamentos,hoje=hojeLocal()) {
  const mes=hoje.slice(0,7);const r={total:0,atrasados:0,recebidoMes:0,receberMes:0,semPlano:0,quantidadeAtrasada:0};
  for(const o of orcamentos){if(!ATIVOS.includes(o.status))continue;if(!o.financeiro){if(o.total>0){r.semPlano++;r.total+=Math.round(o.total*100);}continue;}
    for(const p of o.financeiro.parcelas){const s=saldo(p);r.total+=s;if(s&&!dataValida(p.data))r.semPlano++;if(s&&dataValida(p.data)&&p.data<hoje){r.atrasados+=s;r.quantidadeAtrasada++;}if(dataValida(p.data)&&p.data.slice(0,7)===mes)r.receberMes+=s;for(const x of p.pagamentos)if(x.data.slice(0,7)===mes)r.recebidoMes+=x.valor;}
  }return r;
}
