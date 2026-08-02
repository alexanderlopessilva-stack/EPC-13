import Link from 'next/link';

export default function Home() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px',
      background: 'radial-gradient(circle at 30% 20%, #0d6b38 0%, #00341a 65%, #001f10 100%)',
      textAlign: 'center', fontFamily: 'Arial, sans-serif',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: 820 }}>
        <div style={{ fontSize: 12, letterSpacing: 4, color: '#ffd54f', fontWeight: 'bold', marginBottom: 16, textTransform: 'uppercase' }}>
          Sistema de Gestão
        </div>
        <div style={{ fontSize: 72, fontWeight: 900, color: '#fff', letterSpacing: 3, marginBottom: 16, textShadow: '0 6px 30px rgba(0,0,0,.35)' }}>
          EPC<span style={{ color: '#ffd54f' }}>13</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 'bold', letterSpacing: 3, color: '#a5d6a7', marginBottom: 20, textTransform: 'uppercase' }}>
          TR/BOAVENTURA/TEU/UT
        </div>
        <div style={{ fontSize: 15, color: 'rgba(255,255,255,.82)', maxWidth: 520, marginBottom: 48, lineHeight: 1.7 }}>
          Gestão integrada da programação semanal de engenharia e do controle de revisões de Drafts.
        </div>

        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 700 }}>
          <Link href="/aderencia" style={{ textDecoration: 'none' }}>
            <div style={cardEstilo(true)}>
              <div style={{ fontSize: 36, marginBottom: 14 }}>📅</div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#1b5e20', marginBottom: 6 }}>Aderência Semanal</div>
              <div style={{ fontSize: 13, color: '#777', lineHeight: 1.55 }}>
                Programação da semana, execução diária por item, TAGs e devolutiva de engenharia.
              </div>
              <div style={{ marginTop: 16, fontSize: 13, fontWeight: 'bold', color: '#007a33' }}>Entrar →</div>
            </div>
          </Link>

          <div style={{ ...cardEstilo(false) }}>
            <div style={{ fontSize: 36, marginBottom: 14, opacity: 0.5 }}>📄</div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: '#999', marginBottom: 6 }}>Controle de Drafts</div>
            <div style={{ fontSize: 13, color: '#aaa', lineHeight: 1.55 }}>
              Revisões de documentos PDF/Excel, comentários e histórico de avaliação.
            </div>
            <div style={{ marginTop: 16, fontSize: 13, fontWeight: 'bold', color: '#bbb' }}>Em construção</div>
          </div>
        </div>

        <div style={{ marginTop: 44, fontSize: 11, color: 'rgba(255,255,255,.45)', letterSpacing: .5 }}>
          EPC13 Online — v2
        </div>
      </div>
    </div>
  );
}

function cardEstilo(ativo) {
  return {
    background: '#fff', borderRadius: 20, padding: '30px 28px', width: 280,
    cursor: ativo ? 'pointer' : 'default', transition: '.2s',
    boxShadow: '0 10px 34px rgba(0,0,0,.25)', textAlign: 'left',
    opacity: ativo ? 1 : 0.85,
  };
}
