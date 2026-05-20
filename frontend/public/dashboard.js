const W   = 'https://supermarket-ar-worker.webar-football.workers.dev'
const KEY = 'supermarket2026'

let all = [], activeCat = 'all', chosenMarker = ''

function selectMarker(id) {
    chosenMarker = id
    document.getElementById('markerId').value = id
    document.querySelectorAll('.marker-btn').forEach(b =>
        b.classList.toggle('selected', b.textContent.trim() === id))
}

async function load() {
    try {
        const r = await fetch(`${W}/api/offers`)
        all = await r.json()
        render(activeCat)
        stats()
    } catch { toast('Cannot load offers', true) }
}

async function addOffer() {
    const product    = document.getElementById('product').value.trim()
    const category   = document.getElementById('category').value
    const original   = document.getElementById('original').value
    const price      = document.getElementById('price').value
    const discount   = document.getElementById('discount').value.trim()
    const validUntil = document.getElementById('validUntil').value
    const markerId   = document.getElementById('markerId').value

    if (!product)  return toast('Enter a product name', true)
    if (!category) return toast('Select a category', true)
    if (!price)    return toast('Enter the offer price', true)
    if (!markerId) return toast('Select a shelf marker', true)

    const btn = document.getElementById('addbtn')
    btn.disabled = true
    btn.textContent = 'SAVING...'

    try {
        const r = await fetch(`${W}/api/offers`, {
            method: 'POST',
            headers: {
                'Content-Type':    'application/json',
                'X-Dashboard-Key': KEY
            },
            body: JSON.stringify({
                markerId, product, category,
                original:   original   ? parseFloat(original) : null,
                price:      parseFloat(price),
                discount:   discount   || null,
                validUntil: validUntil || null,
                active:     true
            })
        })
        if (!r.ok) throw new Error('Failed')
        toast('✅ Offer added')
        clear()
        load()
    } catch { toast('Could not save — try again', true) }
    finally {
        btn.disabled = false
        btn.textContent = 'ADD OFFER'
    }
}

async function deleteOffer(markerId) {
    if (!confirm(`Remove offer for ${markerId}?`)) return
    try {
        await fetch(`${W}/api/offers/${markerId}`, {
            method: 'DELETE',
            headers: { 'X-Dashboard-Key': KEY }
        })
        toast('🗑 Removed')
        load()
    } catch { toast('Could not remove — try again', true) }
}

function filterOffers(cat, btn) {
    activeCat = cat
    document.querySelectorAll('.filter-btn').forEach(b =>
        b.classList.remove('active'))
    if (btn) btn.classList.add('active')
    render(cat)
}

function render(cat) {
    const list = document.getElementById('offer-list')
    const data = cat === 'all' ? all : all.filter(o => o.category === cat)

    if (!data.length) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="icon">🏷</div>
                <p>${cat === 'all'
            ? 'No offers yet — add one on the left'
            : 'No offers in this category'}</p>
            </div>`
        return
    }

    list.innerHTML = data.map(o => {
        const exp = o.validUntil && new Date(o.validUntil) < new Date()
        return `
        <div class="offer-item ${exp ? 'expired' : ''}">
            <div class="offer-info">
                <h3>${o.product}</h3>
                <div class="offer-meta">
                    <span class="tag tag-category">${o.category}</span>
                    <span class="tag tag-marker">${o.markerId}</span>
                    ${exp ? '<span class="tag tag-expired">Expired</span>' : ''}
                    ${o.validUntil
            ? `<span style="font-size:11px;color:rgba(255,255,255,0.4)">
                           Until ${o.validUntil}</span>`
            : ''}
                </div>
            </div>
            <div class="offer-price">
                ${o.original
            ? `<div class="price-was">€${parseFloat(o.original).toFixed(2)}</div>`
            : ''}
                <div class="price-now">€${parseFloat(o.price).toFixed(2)}</div>
                ${o.discount
            ? `<div class="price-discount">-${o.discount}</div>`
            : ''}
            </div>
            <button class="btn-delete" onclick="deleteOffer('${o.markerId}')">🗑</button>
        </div>`
    }).join('')
}

function stats() {
    const exp = all.filter(o =>
        o.validUntil && new Date(o.validUntil) < new Date()
    ).length
    document.getElementById('stat-total').textContent   = all.length
    document.getElementById('stat-active').textContent  = all.length - exp
    document.getElementById('stat-expired').textContent = exp
    document.getElementById('stat-markers').textContent =
        new Set(all.map(o => o.markerId)).size
}

function clear() {
    ['product','category','original','price','discount','validUntil','markerId']
        .forEach(id => document.getElementById(id).value = '')
    chosenMarker = ''
    document.querySelectorAll('.marker-btn').forEach(b =>
        b.classList.remove('selected'))
}

function toast(msg, err = false) {
    const t = document.getElementById('toast')
    t.textContent = msg
    t.className = `toast ${err ? 'error' : ''} show`
    setTimeout(() => t.classList.remove('show'), 3000)
}

const d = new Date()
d.setDate(d.getDate() + 7)
document.getElementById('validUntil').value = d.toISOString().split('T')[0]

load()

window.selectMarker = selectMarker
window.addOffer     = addOffer
window.deleteOffer  = deleteOffer
window.filterOffers = filterOffers