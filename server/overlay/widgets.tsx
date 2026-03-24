// JSX handled by react-jsx transform — no React import needed

// ─── Sample data ──────────────────────────────────────────────────────────────

const AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%236b3fa0'/%3E%3Ccircle cx='20' cy='15' r='7' fill='white' fill-opacity='.6'/%3E%3Cpath d='M6 36q2-10 14-10 12 0 14 10z' fill='white' fill-opacity='.6'/%3E%3C/svg%3E";

const SAMPLE_BIDS = [
  { id: '1', username: 'StreamerXX',  amount: 15000 },
  { id: '2', username: 'Viewer_42',   amount: 9500  },
  { id: '3', username: 'NightOwl99',  amount: 7200  },
];

function fmt(n: number) { return n.toLocaleString('ru-RU'); }

// ─── Shared font ──────────────────────────────────────────────────────────────

const FONT = {
  fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
  color: '#fff',
};

// ─── Lot widget — 420 × 420 ───────────────────────────────────────────────────

export function LotWidget() {
  return (
    <div style={{ ...FONT, width: 420, height: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      {/* card */}
      <div style={{ flex: 1, width: '100%', background: 'rgba(28,20,38,0.92)', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="rgba(169,112,255,0.35)" strokeWidth="1.2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <path d="M21 15l-5-5L5 21"/>
        </svg>
      </div>
      {/* title */}
      <p style={{ fontSize: 22, fontWeight: 700, textAlign: 'center', color: '#d4d4e8', textShadow: '0 1px 6px rgba(0,0,0,0.7)', lineHeight: 1.3, margin: 0 }}>
        Винтажная Nikon F3
      </p>
    </div>
  );
}

// ─── Price widget — 460 × 180 ─────────────────────────────────────────────────

export function PriceWidget() {
  return (
    <div style={{ ...FONT, width: 460, height: 180, background: '#b87060', borderRadius: 18, padding: '20px 34px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
      <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.09em', opacity: 0.85 }}>
        Начальная цена
      </span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, lineHeight: 1 }}>
        <span style={{ fontSize: 80, fontWeight: 900, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>5 000</span>
        <span style={{ fontSize: 32, fontWeight: 700, opacity: 0.9 }}>₽</span>
      </div>
    </div>
  );
}

// ─── Timer widget — 380 × 110 ─────────────────────────────────────────────────

export function TimerWidget() {
  return (
    <div style={{ ...FONT, width: 380, height: 110, display: 'flex', alignItems: 'center', gap: 20, padding: '0 10px' }}>
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, color: '#fff', opacity: 0.9 }}>
        <path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17a1 1 0 001 1h6a1 1 0 001-1v-2.26C17.81 13.47 19 11.38 19 9c0-3.87-3.13-7-7-7z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
        <path d="M9 22h6M10 2h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M9 17c0-1.5.67-2 3-2s3 .5 3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <span style={{ fontSize: 72, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em', lineHeight: 1 }}>
        02:30
      </span>
    </div>
  );
}

// ─── Bids widget — 560 × 600 ──────────────────────────────────────────────────

function BidCard({ username, amount }: { username: string; amount: number }) {
  return (
    <li style={{ background: '#6b3fa0', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, position: 'relative', overflow: 'visible', listStyle: 'none' }}>
      <img src={AVATAR} alt="" style={{ width: 34, height: 34, minWidth: 34, borderRadius: '50%', flexShrink: 0, background: 'rgba(255,255,255,0.1)' }} />
      <span style={{ fontSize: 20, fontStyle: 'italic', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 110 }}>
        {username}
      </span>
      <span style={{ background: 'rgba(255,255,255,0.96)', color: '#1a0a2e', borderRadius: 8, padding: '6px 14px', fontSize: 18, fontWeight: 900, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', position: 'absolute', bottom: -10, right: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.4)' }}>
        {fmt(amount)}
      </span>
    </li>
  );
}

export function BidsWidget() {
  return (
    <div style={{ ...FONT, width: 560, height: 600, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 32 }}>
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 24, padding: 0, margin: 0 }}>
        {SAMPLE_BIDS.map(b => <BidCard key={b.id} username={b.username} amount={b.amount} />)}
      </ul>
    </div>
  );
}

// ─── Top-bid widget — 460 × 220 ───────────────────────────────────────────────

export function TopBidWidget() {
  const top = SAMPLE_BIDS[0];
  return (
    <div style={{ ...FONT, position: 'relative', overflow: 'visible', width: 460, height: 220, background: '#6b3fa0', borderRadius: 18, padding: '30px 34px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
      {/* User mini-block — protrudes from top-left by 50% */}
      <div style={{ position: 'absolute', top: 0, left: 24, transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(85,45,130,0.95)', borderRadius: 10, padding: '5px 12px 5px 5px' }}>
        <img src={AVATAR} alt="" style={{ width: 36, height: 36, minWidth: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: 'rgba(255,255,255,0.15)' }} />
        <span style={{ fontSize: 16, fontWeight: 700, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200, opacity: 0.95 }}>
          {top.username}
        </span>
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.09em', opacity: 0.85 }}>
        Самая высокая ставка
      </span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, lineHeight: 1 }}>
        <span style={{ fontSize: 64, fontWeight: 900, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
          {fmt(top.amount)}
        </span>
        <span style={{ fontSize: 26, fontWeight: 700, opacity: 0.9 }}>₽</span>
      </div>
    </div>
  );
}

// ─── Full scene — 1920 × 500 ──────────────────────────────────────────────────

export function FullWidget() {
  return (
    <div style={{ ...FONT, width: 1920, height: 500, display: 'flex', flexDirection: 'row', alignItems: 'stretch', gap: 24, padding: '30px 40px 40px' }}>
      {/* Lot column */}
      <div style={{ width: 400, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 1, width: '100%', background: 'rgba(28,20,38,0.92)', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="rgba(169,112,255,0.35)" strokeWidth="1.2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="M21 15l-5-5L5 21"/>
          </svg>
        </div>
        <p style={{ fontSize: 20, fontWeight: 700, textAlign: 'center', color: '#d4d4e8', margin: 0 }}>Винтажная Nikon F3</p>
      </div>
      {/* Info column */}
      <div style={{ width: 400, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 24, alignSelf: 'stretch' }}>
        <div style={{ background: '#b87060', borderRadius: 18, padding: '20px 28px 24px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.09em', opacity: 0.85 }}>Начальная цена</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 70, fontWeight: 900, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>5 000</span>
            <span style={{ fontSize: 28, fontWeight: 700, opacity: 0.9 }}>₽</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, paddingLeft: 4 }}>
          <svg width="54" height="54" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.9 }}>
            <path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17a1 1 0 001 1h6a1 1 0 001-1v-2.26C17.81 13.47 19 11.38 19 9c0-3.87-3.13-7-7-7z" stroke="white" strokeWidth="1.8" strokeLinejoin="round"/>
            <path d="M9 22h6M10 2h4" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M9 17c0-1.5.67-2 3-2s3 .5 3 2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize: 60, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em', lineHeight: 1 }}>02:30</span>
        </div>
        {/* Inline top-bid */}
        <div style={{ position: 'relative', overflow: 'visible', flex: 1, background: '#6b3fa0', borderRadius: 18, padding: '26px 22px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, minHeight: 0 }}>
          <div style={{ position: 'absolute', top: 0, left: 18, transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(85,45,130,0.95)', borderRadius: 9, padding: '4px 10px 4px 4px' }}>
            <img src={AVATAR} alt="" style={{ width: 30, height: 30, minWidth: 30, borderRadius: 7, objectFit: 'cover', flexShrink: 0, background: 'rgba(255,255,255,0.15)' }} />
            <span style={{ fontSize: 14, fontWeight: 700, fontStyle: 'italic', whiteSpace: 'nowrap', opacity: 0.95 }}>{SAMPLE_BIDS[0].username}</span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.09em', opacity: 0.75 }}>Самая высокая ставка</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, lineHeight: 1 }}>
            <span style={{ fontSize: 52, fontWeight: 900, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{fmt(SAMPLE_BIDS[0].amount)}</span>
            <span style={{ fontSize: 22, fontWeight: 700, opacity: 0.9 }}>₽</span>
          </div>
        </div>
      </div>
      {/* Bids column */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 22, padding: 0, margin: 0 }}>
          {SAMPLE_BIDS.map(b => <BidCard key={b.id} username={b.username} amount={b.amount} />)}
        </ul>
      </div>
    </div>
  );
}

// ─── Winner widget — 560 × 130 ───────────────────────────────────────────────

export function WinnerWidget() {
  const top = SAMPLE_BIDS[0];
  return (
    <div style={{ ...FONT, width: 560, height: 130, display: 'flex', flexDirection: 'column', gap: 14, padding: '18px 22px', background: 'rgba(20,10,30,0.95)', border: '2px solid #f59e0b', borderRadius: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#f59e0b' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
        Победитель
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
        <img src={AVATAR} alt="" style={{ width: 40, height: 40, minWidth: 40, borderRadius: '50%', flexShrink: 0, background: 'rgba(245,158,11,0.15)', border: '1.5px solid rgba(245,158,11,0.35)' }} />
        <span style={{ fontSize: 26, fontWeight: 800, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 140 }}>
          {top.username}
        </span>
        <span style={{ background: '#f59e0b', color: '#1c0a00', borderRadius: 8, padding: '7px 16px', fontSize: 19, fontWeight: 900, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', position: 'absolute', right: 0, boxShadow: '0 2px 14px rgba(245,158,11,0.35)' }}>
          {fmt(top.amount)}
        </span>
      </div>
    </div>
  );
}

// ─── Re-export natural dimensions for each widget ─────────────────────────────

export const WIDGET_DIMENSIONS = {
  overlay:  { w: 1920, h: 500 },
  lot:      { w: 420,  h: 420 },
  price:    { w: 460,  h: 180 },
  timer:    { w: 380,  h: 110 },
  bids:     { w: 560,  h: 600, extraPadBottom: 16 },
  'top-bid':{ w: 460,  h: 220 },
  winner:   { w: 560,  h: 130 },
} as const;

export type WidgetId = keyof typeof WIDGET_DIMENSIONS;

