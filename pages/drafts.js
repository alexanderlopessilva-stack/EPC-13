import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import DraftModal from '../components/DraftModal';

const SITUACAO_CONFIG = {
  AGUARD_AVAL: { label: '⏳ Aguardando avaliação', cor: '#7B68EE' },
  AGUARD_DEV:  { label: '📬 Aguardando devolutiva', cor: '#0057B8' },
  EM_EXEC:     { label: '⚙️ Em execução', cor: '#b8860b' },
  FINALIZADO:  { label: '✅ Draft finalizado', cor: '#008542' },
  CANCELADO:   { label: '🚫 Draft cancelado', cor: '#c0392b' },
};
const BUCKET = 'drafts-arquivos';

export default function Drafts() {
  const [drafts, setDrafts] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [draftAberto, setDraftAberto] = useState(null);
  const [importando, setImportando] = useState(false);
  const [progresso, setProgresso] = useState('');

  useEffect(() => { carregarDrafts(); }, []);

  async function carregarDrafts() {
    setCarregando(true);
    const { data: listaDrafts, error } = await supabase.from('drafts').select('*').order('codigo', { ascending: true });
    if (error) { setErro('Erro ao carregar drafts: ' + error.message); setCarregando(false); return; }
    const { data: listaRevisoes } = await supabase.from('revisoes').select('*').order('letra', { ascending: true });
    const porDraft = {};
    (listaRevisoes || []).forEach(r => {
      if (!porDraft[r.draft_id]) porDraft[r.draft_id] = [];
      porDraft[r.draft_id].push(r);
    });
    const combinados = (listaDrafts || []).map(d => ({ ...d, revisoes: porDraft[d.id] || [] }));
    setDrafts(combinados);
    setCarregando(false);
  }

  async function excluirDraft(id) {
    if (!confirm('Excluir este Draft permanentemente? Isso apaga todas as revisões e arquivos dele.')) return;
    await supabase.from('revisoes').delete().eq('draft_id', id);
    await supabase.from('drafts').delete().eq('id', id);
    setDraftAberto(null);
    carregarDrafts();
  }

  async function salvarDraft(dadosAtualizados) {
    const { id, revisoes, ...resto } = dadosAtualizados;
    await supabase.from('drafts').update({ ...resto, atualizado_em: new Date().toISOString() }).eq('id', id);
    setDraftAberto(null);
    carregarDrafts();
  }

  function base64ParaBlob(base64, tipoArquivo) {
    const mime = tipoArquivo === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf';
    const partes = base64.split(',');
    const bin = atob(partes.length > 1 ? partes[1] : partes[0]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  async function importarJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('Importar esse arquivo pode demorar bastante se tiver muitos PDFs/Excel grandes (cada arquivo precisa ser enviado um por um pro armazenamento). Continuar?')) { e.target.value = ''; return; }

    setImportando(true);
    setProgresso('Lendo o arquivo...');
    try {
      const texto = await file.text();
      const data = JSON.parse(texto);
      if (!data.drafts || !Array.isArray(data.drafts)) {
        alert('Esse arquivo não parece ser uma sessão de Drafts válida (não encontrei a lista "drafts").');
        setImportando(false); e.target.value = ''; return;
      }

      const codigosExistentes = new Set(drafts.map(d => d.codigo));
      let totalDrafts = 0, totalRevisoes = 0, totalArquivos = 0, totalPulados = 0;

      for (let di = 0; di < data.drafts.length; di++) {
        const d = data.drafts[di];
        if (codigosExistentes.has(d.codigo)) { totalPulados++; continue; }

        setProgresso('Draft ' + (di + 1) + ' de ' + data.drafts.length + ' — ' + d.codigo);

        const { data: novoDraft, error: errDraft } = await supabase.from('drafts').insert({
          codigo: d.codigo, assunto: d.assunto || '', situacao: d.situacao || 'AGUARD_AVAL',
          situacao_data: d.situacaoData || null, data_recebimento: d.dataRecebimento || null,
        }).select().single();
        if (errDraft) { console.error(errDraft); continue; }
        totalDrafts++;

        for (const r of (d.revisoes || [])) {
          const arquivosProntos = [];
          for (const a of (r.arquivos || [])) {
            if (!a.base64) continue;
            setProgresso('Draft ' + d.codigo + ' — Rev. ' + r.letra + ' — enviando ' + a.nome + '...');
            try {
              const blob = base64ParaBlob(a.base64, a.tipo);
              const caminho = novoDraft.id + '/' + r.letra + '/' + Date.now() + '_' + a.nome;
              const { error: errUpload } = await supabase.storage.from(BUCKET).upload(caminho, blob, {
                contentType: blob.type, upsert: true,
              });
              if (errUpload) { console.error(errUpload); continue; }
              const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(caminho);
              arquivosProntos.push({ nome: a.nome, tipo: a.tipo, url: urlData.publicUrl });
              totalArquivos++;
            } catch (err) { console.error(err); }
          }

          const { error: errRev } = await supabase.from('revisoes').insert({
            draft_id: novoDraft.id, letra: r.letra, status: r.status || 'NENHUM',
            status_data: r.statusData || null, status_pend_data: r.statusPendData || null,
            ciclos: r.ciclos || [], comentarios: r.comentarios || [],
            arquivos: arquivosProntos, origem_excel: r.origemExcel || false, criado_em: r.criadoEm || '',
          });
          if (!errRev) totalRevisoes++;
        }
      }

      await carregarDrafts();
      alert('✅ Importação concluída!\n\n' + totalDrafts + ' Draft(s) novo(s)\n' + totalRevisoes + ' revisão(ões)\n' + totalArquivos + ' arquivo(s) enviado(s)'
        + (totalPulados ? '\n\n⚠️ ' + totalPulados + ' Draft(s) já existiam (código repetido) e foram pulados.' : ''));
    } catch (err) {
      alert('❌ Erro ao importar: ' + err.message);
    }
    setImportando(false);
    setProgresso('');
    e.target.value = '';
  }

  const draftsFiltrados = drafts.filter(d => {
    if (!busca.trim()) return true;
    const t = busca.toLowerCase();
    return (d.codigo || '').toLowerCase().includes(t) || (d.assunto || '').toLowerCase().includes(t);
  });

  return (
    <div>
      <header style={{ background: 'linear-gradient(135deg,#0B5FA8,#08427a)', color: '#fff', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <Link href="/" style={{ position: 'absolute', left: 20, color: '#fff', textDecoration: 'none', fontSize: 13 }}>← EPC13</Link>
        <h1 style={{ margin: 0, fontSize: 20 }}>Controle de Drafts</h1>
      </header>

      <div style={{ background: '#eaf1fb', padding: '14px 20px', display: 'flex', justifyContent: 'center', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por código ou assunto..."
          style={{ padding: '8px 14px', borderRadius: 20, border: '1px solid #c9dcf5', width: 300 }} />
        <label style={{ background: importando ? '#aaa' : '#0B5FA8', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 16px', fontSize: 13, fontWeight: 'bold', cursor: importando ? 'default' : 'pointer' }}>
          📥 Importar JSON (sessão do Drafts)
          <input type="file" accept=".json" onChange={importarJSON} disabled={importando} style={{ display: 'none' }} />
        </label>
      </div>

      {importando && (
        <div style={{ background: '#fff3e0', color: '#8a4b00', padding: '10px 20px', textAlign: 'center', fontSize: 13, fontWeight: 'bold' }}>
          ⏳ Importando... {progresso}
          <div style={{ fontSize: 11, fontWeight: 'normal', marginTop: 4 }}>Não feche essa aba enquanto isso — pode levar alguns minutos se houver muitos arquivos.</div>
        </div>
      )}

      {erro && <div style={{ background: '#fdecea', color: '#c0392b', padding: 12, textAlign: 'center' }}>{erro}</div>}

      <div style={{ maxWidth: 1000, margin: '20px auto', padding: '0 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {carregando && <div style={{ textAlign: 'center', color: '#888', gridColumn: '1/-1' }}>Carregando...</div>}
        {!carregando && draftsFiltrados.length === 0 && (
          <div style={{ textAlign: 'center', color: '#888', gridColumn: '1/-1', padding: 30 }}>
            Nenhum Draft encontrado. Use o botão "📥 Importar JSON" pra trazer os dados do módulo Drafts do HTML.
          </div>
        )}
        {draftsFiltrados.map(d => {
          const cfg = SITUACAO_CONFIG[d.situacao] || SITUACAO_CONFIG.AGUARD_AVAL;
          const temPdf = d.revisoes.some(r => (r.arquivos || []).some(a => a.tipo === 'pdf'));
          const temXlsx = d.revisoes.some(r => (r.arquivos || []).some(a => a.tipo === 'xlsx'));
          return (
            <div key={d.id} onClick={() => setDraftAberto(d)}
              style={{ background: '#fff', borderRadius: 12, padding: '20px 16px', cursor: 'pointer', textAlign: 'center',
                boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderTop: '4px solid ' + cfg.cor }}>
              <div style={{ fontWeight: 'bold', color: '#0B5FA8', fontSize: 20, borderBottom: '2px solid #0B5FA833', paddingBottom: 6, marginBottom: 8 }}>
                {d.codigo}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
                {temPdf && <span title="Tem PDF">📄</span>}
                {temXlsx && <span title="Tem Excel">📊</span>}
                <span style={{ background: '#eef4fb', color: '#0B5FA8', borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 'bold' }}>
                  🗂 {d.revisoes.length} versõe{d.revisoes.length === 1 ? '' : 's'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#2e4a6b', marginBottom: 10, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {d.assunto}
              </div>
              <span style={{ background: cfg.cor + '22', color: cfg.cor, borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 'bold' }}>
                {cfg.label}
              </span>
            </div>
          );
        })}
      </div>

      {draftAberto && (
        <DraftModal draft={draftAberto} onClose={() => setDraftAberto(null)} onSave={salvarDraft} onDelete={excluirDraft} />
      )}
    </div>
  );
}
