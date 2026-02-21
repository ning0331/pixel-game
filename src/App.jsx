import { useState, useRef, useCallback, useEffect } from 'react'

// ── IndexedDB helpers ──────────────────────────────────────────────
const DB_NAME = 'pixel-game-db'
const STORE = 'photos'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('order', 'order', { unique: false })
      }
    }
    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror = (e) => reject(e.target.error)
  })
}

function dbPut(db, record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(record)
    tx.oncomplete = resolve
    tx.onerror = (e) => reject(e.target.error)
  })
}

function dbDelete(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = resolve
    tx.onerror = (e) => reject(e.target.error)
  })
}

function dbGetAll(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror = (e) => reject(e.target.error)
  })
}

const itinerary = [
  {
    day: 1,
    title: '桃園 → 曼谷 → 芭達雅',
    emoji: '✈️',
    color: '#FF6B6B',
    meals: { lunch: '機上餐', dinner: '咖哩螃蟹套餐' },
    hotel: 'A-one New Wing / Manhattan Pattaya / Hotel J / Centre Point Prime（同級）',
    activities: [
      '抵達曼谷後前往芭達雅',
      '泰式傳統按摩 2 小時',
      'Runway Street Food Pattaya 飛機主題夜市',
    ],
  },
  {
    day: 2,
    title: '芭達雅・文化 × 海天派對',
    emoji: '🛳️',
    color: '#FFA94D',
    meals: { breakfast: '飯店早餐', lunch: '泰式特色午餐', dinner: 'Ocean Sky 國際自助晚餐（暢飲）' },
    hotel: '同 Day 1',
    activities: [
      '爽泰度假莊園 Suan Thai —— 泰裝體驗、水果吃到飽、騎大象、馬車、潑水節 & 水燈祭體驗',
      '佛山 Khao Chi Chan（山壁佛像）',
      '芭達雅水上市場（手划船）',
      'Terminal 21 Pattaya 購物',
      'Ocean Sky 海天派對豪華遊輪晚宴 + 人妖秀 + 男模表演',
    ],
  },
  {
    day: 3,
    title: '曼谷・網紅打卡日',
    emoji: '📸',
    color: '#51CF66',
    meals: { breakfast: '飯店早餐', lunch: '斧頭豬排 BBQ 吃到飽', dinner: '夜市自費' },
    hotel: 'ibis Styles Bangkok Ratchada / Modena by Fraser / Graph Hotel / Hyatt Place Sukhumvit（同級）',
    activities: [
      '747 飛機主題咖啡廳（含一杯飲料）',
      '四面佛祈福 & Central World / Big C 購物',
      'JODD FAIRS Ratchada 最新版網紅夜市',
    ],
  },
  {
    day: 4,
    title: '大城・世界遺產巡禮',
    emoji: '🦒',
    color: '#339AF0',
    meals: { breakfast: '飯店早餐', lunch: '大城自費', dinner: '砂鍋飯特色晚餐' },
    hotel: '同 Day 3',
    activities: [
      'Sriayuthaya Lion Park —— 吉普車餵長頸鹿拍照 + 動物表演',
      '大城棉花糖春捲甜點體驗',
      'La Loubere 歐式網紅咖啡廳（含一杯飲料）',
      '瑪哈泰寺 Wat Mahathat（樹根佛頭世界遺產）',
    ],
  },
  {
    day: 5,
    title: '返程 · 曼谷 → 桃園',
    emoji: '🏡',
    color: '#CC5DE8',
    meals: { breakfast: '飯店早餐', lunch: '機上餐' },
    hotel: '',
    activities: ['機場 Check-in，依依不捨回台灣'],
  },
]

const highlights = [
  { icon: '🦒', label: '長頸鹿餵食', value: 'Day 4' },
  { icon: '🛳️', label: '海天派對', value: 'Day 2' },
  { icon: '💆', label: '泰式按摩', value: '2 小時' },
  { icon: '☕', label: '網紅咖啡廳', value: '2 間' },
  { icon: '🌙', label: '夜市', value: '3 個' },
  { icon: '🕌', label: '世界遺產', value: 'Day 4' },
]

const MAX_PHOTOS = 120

function MealBadge({ label, value }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: 'rgba(255,255,255,0.08)', borderRadius: 8,
      padding: '3px 10px', fontSize: 12, color: 'rgba(255,255,255,0.7)',
      marginRight: 6, marginBottom: 4,
    }}>
      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{label}</span>
      {value}
    </span>
  )
}

function Lightbox({ photos, index, onClose, onPrev, onNext }) {
  const item = photos[index]
  const isVideo = item.type === 'video'
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* Prev */}
      <button
        onClick={(e) => { e.stopPropagation(); onPrev() }}
        style={{
          position: 'absolute', left: 16, background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%',
          width: 48, height: 48, color: '#fff', fontSize: 22, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >‹</button>

      {/* Media */}
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '88vw', maxHeight: '88vh', position: 'relative' }}>
        {isVideo ? (
          <video
            src={item.url}
            controls
            autoPlay
            style={{ maxWidth: '88vw', maxHeight: '82vh', borderRadius: 12, display: 'block', background: '#000' }}
          />
        ) : (
          <img
            src={item.url}
            alt={item.name}
            style={{ maxWidth: '88vw', maxHeight: '88vh', borderRadius: 12, objectFit: 'contain', display: 'block' }}
          />
        )}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
          borderRadius: '0 0 12px 12px', padding: '20px 16px 12px',
          color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center',
        }}>
          {isVideo && <span style={{ marginRight: 6 }}>🎬</span>}
          {item.name} &nbsp;·&nbsp; {index + 1} / {photos.length}
        </div>
      </div>

      {/* Next */}
      <button
        onClick={(e) => { e.stopPropagation(); onNext() }}
        style={{
          position: 'absolute', right: 16, background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%',
          width: 48, height: 48, color: '#fff', fontSize: 22, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >›</button>

      {/* Close */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 16, right: 16,
          background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '50%', width: 40, height: 40, color: '#fff',
          fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >✕</button>
    </div>
  )
}

export default function App() {
  const [activeDay, setActiveDay] = useState(null)
  const [photos, setPhotos] = useState([])
  const [lightbox, setLightbox] = useState(null) // index
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(true)
  const fileInputRef = useRef()
  const dbRef = useRef(null)

  // 啟動時從 IndexedDB 載入已存的照片
  useEffect(() => {
    openDB().then(async (db) => {
      dbRef.current = db
      const rows = await dbGetAll(db)
      rows.sort((a, b) => a.order - b.order)
      const loaded = rows.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        url: URL.createObjectURL(r.blob),
      }))
      setPhotos(loaded)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const addFiles = useCallback(async (files) => {
    const remaining = MAX_PHOTOS - photos.length
    if (remaining <= 0) return
    const accepted = Array.from(files)
      .filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/') || f.name.toLowerCase().endsWith('.mov'))
      .slice(0, remaining)
    const now = Date.now()
    const newPhotos = accepted.map((f, idx) => ({
      url: URL.createObjectURL(f),
      name: f.name,
      id: `${f.name}-${f.lastModified}-${f.size}`,
      type: f.type.startsWith('video/') || f.name.toLowerCase().endsWith('.mov') ? 'video' : 'image',
      _file: f,
      _order: now + idx,
    }))
    setPhotos((prev) => {
      const merged = [...prev, ...newPhotos]
      // 存到 IndexedDB（非同步，不 block UI）
      if (dbRef.current) {
        newPhotos.forEach((p) =>
          dbPut(dbRef.current, { id: p.id, name: p.name, type: p.type, blob: p._file, order: p._order })
        )
      }
      return merged
    })
  }, [photos.length])

  const handleFiles = (e) => addFiles(e.target.files)

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    addFiles(e.dataTransfer.files)
  }

  const removePhoto = (id, e) => {
    e.stopPropagation()
    setPhotos((prev) => prev.filter((p) => p.id !== id))
    if (dbRef.current) dbDelete(dbRef.current, id)
  }

  const openLightbox = (i) => setLightbox(i)
  const closeLightbox = () => setLightbox(null)
  const prevPhoto = () => setLightbox((i) => (i - 1 + photos.length) % photos.length)
  const nextPhoto = () => setLightbox((i) => (i + 1) % photos.length)

  // keyboard
  const handleKey = useCallback((e) => {
    if (lightbox === null) return
    if (e.key === 'ArrowRight') nextPhoto()
    if (e.key === 'ArrowLeft') prevPhoto()
    if (e.key === 'Escape') closeLightbox()
  }, [lightbox])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 15 }}>
      載入相簿中…
    </div>
  )

  return (
    <div
      onKeyDown={handleKey}
      tabIndex={-1}
      style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0d1117 0%, #161b22 60%, #1a1f2e 100%)', fontFamily: "'Segoe UI', system-ui, sans-serif", color: '#fff', outline: 'none' }}
    >
      {/* ── Hero ── */}
      <div style={{ textAlign: 'center', padding: '56px 20px 36px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(255,107,107,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ fontSize: 56, marginBottom: 14, display: 'inline-block', animation: 'float 3s ease-in-out infinite' }}>🇹🇭</div>
        <h1 style={{ fontSize: 'clamp(1.4rem, 4vw, 2.6rem)', fontWeight: 900, margin: '0 0 8px', lineHeight: 1.3, background: 'linear-gradient(90deg, #FF6B6B, #FFA94D, #FFD43B, #51CF66)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          泰愛曼芭
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', margin: '0 0 4px', maxWidth: 480, marginInline: 'auto' }}>
          大城長頸鹿・暹羅海天派對・爽泰度假莊園・雙網紅咖啡廳
        </p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: '6px 0 0' }}>
          5 天 4 夜 ✦ 曼谷 × 芭達雅 × 大城 ✦ 桃園出發
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 32, flexWrap: 'wrap', maxWidth: 600, marginInline: 'auto' }}>
          {highlights.map((h) => (
            <div key={h.label} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14, padding: '12px 18px', backdropFilter: 'blur(8px)', minWidth: 90, flex: '1 1 90px', maxWidth: 140 }}>
              <div style={{ fontSize: 24 }}>{h.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{h.value}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{h.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Itinerary ── */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 16px 48px' }}>
        <h2 style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, marginBottom: 20, color: 'rgba(255,255,255,0.4)', letterSpacing: 4, textTransform: 'uppercase' }}>日 程 安 排</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {itinerary.map((item) => {
            const isActive = activeDay === item.day
            return (
              <div
                key={item.day}
                onClick={() => setActiveDay(isActive ? null : item.day)}
                style={{
                  background: isActive ? `linear-gradient(135deg, ${item.color}1a, ${item.color}0a)` : 'rgba(255,255,255,0.035)',
                  border: `1px solid ${isActive ? item.color + '55' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: 18, padding: '18px 20px', cursor: 'pointer',
                  transition: 'all 0.28s cubic-bezier(.4,0,.2,1)',
                  transform: isActive ? 'translateY(-2px)' : 'translateY(0)',
                  boxShadow: isActive ? `0 12px 40px ${item.color}22` : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ background: item.color + '28', border: `1.5px solid ${item.color}88`, borderRadius: 12, width: 46, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                    {item.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: item.color, fontWeight: 700, letterSpacing: 1, marginBottom: 2 }}>DAY {item.day}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                  </div>
                  <div style={{ fontSize: 18, opacity: 0.5, transition: 'transform 0.28s', transform: isActive ? 'rotate(180deg)' : 'rotate(0)', flexShrink: 0 }}>⌄</div>
                </div>

                {isActive && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${item.color}2a` }}>
                    <div style={{ marginBottom: 14 }}>
                      {item.activities.map((act, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', alignItems: 'flex-start' }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: item.color, marginTop: 6, flexShrink: 0 }} />
                          <span style={{ color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 1.5 }}>{act}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginBottom: item.hotel ? 10 : 0 }}>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6, letterSpacing: 1 }}>餐食</div>
                      <div>
                        {item.meals.breakfast && <MealBadge label="早" value={item.meals.breakfast} />}
                        {item.meals.lunch && <MealBadge label="午" value={item.meals.lunch} />}
                        {item.meals.dinner && <MealBadge label="晚" value={item.meals.dinner} />}
                      </div>
                    </div>
                    {item.hotel && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4, letterSpacing: 1 }}>住宿</div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{item.hotel}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Photo Gallery ── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px 72px' }}>
        <h2 style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'rgba(255,255,255,0.4)', letterSpacing: 4, textTransform: 'uppercase' }}>旅 遊 相 簿</h2>
        <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.25)', marginBottom: 24 }}>
          {photos.length} / {MAX_PHOTOS} 張
        </p>

        {/* Drop zone */}
        {photos.length < MAX_PHOTOS && (
          <div
            onClick={() => fileInputRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${dragOver ? '#FFA94D' : 'rgba(255,255,255,0.15)'}`,
              borderRadius: 20, padding: '40px 20px',
              textAlign: 'center', cursor: 'pointer',
              background: dragOver ? 'rgba(255,169,77,0.06)' : 'rgba(255,255,255,0.02)',
              transition: 'all 0.2s', marginBottom: 24,
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 10 }}>📷</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
              拖曳或點擊上傳照片
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
              最多 {MAX_PHOTOS} 張 · 支援 JPG / PNG / HEIC 等格式 · 還可再上傳 {MAX_PHOTOS - photos.length} 張
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,.mov"
          multiple
          style={{ display: 'none' }}
          onChange={handleFiles}
        />

        {/* Grid */}
        {photos.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 8,
          }}>
            {photos.map((photo, i) => (
              <div
                key={photo.id}
                onClick={() => openLightbox(i)}
                style={{
                  position: 'relative', aspectRatio: '1', borderRadius: 12,
                  overflow: 'hidden', cursor: 'pointer',
                  background: 'rgba(255,255,255,0.05)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none' }}
              >
                {photo.type === 'video' ? (
                  <video
                    src={photo.url}
                    muted
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <img
                    src={photo.url}
                    alt={photo.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                )}
                {/* Video badge */}
                {photo.type === 'video' && (
                  <div style={{
                    position: 'absolute', top: 6, left: 6,
                    background: 'rgba(0,0,0,0.65)', borderRadius: 6,
                    padding: '2px 7px', fontSize: 11, color: '#fff',
                  }}>🎬</div>
                )}
                {/* Delete btn */}
                <button
                  onClick={(e) => removePhoto(photo.id, e)}
                  style={{
                    position: 'absolute', top: 6, right: 6,
                    background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%',
                    width: 26, height: 26, color: '#fff', fontSize: 13,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: 0, transition: 'opacity 0.15s',
                  }}
                  className="del-btn"
                >✕</button>
                {/* Index badge */}
                <div style={{
                  position: 'absolute', bottom: 6, left: 6,
                  background: 'rgba(0,0,0,0.55)', borderRadius: 6,
                  padding: '2px 6px', fontSize: 10, color: 'rgba(255,255,255,0.7)',
                }}>
                  {i + 1}
                </div>
              </div>
            ))}
          </div>
        )}

        {photos.length === 0 && (
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 13, marginTop: 8 }}>
            還沒有照片，快來上傳旅途回憶！🌺
          </p>
        )}
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <Lightbox
          photos={photos}
          index={lightbox}
          onClose={closeLightbox}
          onPrev={prevPhoto}
          onNext={nextPhoto}
        />
      )}

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        div:hover .del-btn { opacity: 1 !important; }
      `}</style>
    </div>
  )
}
