const W = 'https://supermarket-ar-worker.webar-football.workers.dev'
const KEY_STORAGE = 'supermarketar.dashboardKey'

function getKey() {
    return localStorage.getItem(KEY_STORAGE) ||
        document.getElementById('dashKey')?.value ||
        ''
}

function saveKey() {
    const key = document.getElementById('dashKey').value.trim()
    if (!key) return toast('Enter a key first', true)
    localStorage.setItem(KEY_STORAGE, key)
    toast('Key saved to this browser ✅')
}

let all = [], activeCat = 'all', chosenMarker = ''

// ── Days left until expiry
function daysLeft(date) {
    if (!date) return 999
    return Math.ceil(
        (new Date(date + 'T23:59:59') - Date.now()) / 86400000
    )
}

function selectMarker(id) {
    chosenMarker = id
    document.getElementById('markerId').value = id
    document.querySelectorAll('.shelf').forEach(s =>
        s.classList.remove('selected'))
    const shelf = document.getElementById(`shelf-${id}`)
    if (shelf) shelf.classList.add('selected')
}

async function load() {
    try {
        const r = await fetch(`${W}/api/offers`)
        all = await r.json()
        render(activeCat)
        stats()
        updateStoreMap()
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

    // ── Auto-compute discount if not provided
    const wasVal = parseFloat(original)
    const nowVal = parseFloat(price)
    let discountVal = discount
    if (!discountVal && wasVal > 0 && nowVal >= 0) {
        discountVal = Math.round((1 - nowVal / wasVal) * 100) + '%'
    }

    const btn = document.getElementById('addbtn')
    btn.disabled = true
    btn.textContent = 'SAVING...'

    try {
        const r = await fetch(`${W}/api/offers`, {
            method: 'POST',
            headers: {
                'Content-Type':    'application/json',
                'X-Dashboard-Key': getKey()
            },
            body: JSON.stringify({
                markerId, product, category,
                original:   original   ? parseFloat(original) : null,
                price:      parseFloat(price),
                discount:   discountVal || null,
                validUntil: validUntil  || null,
                active:     true
            })
        })
        if (!r.ok) throw new Error('Failed')
        toast('Offer added ✅')
        clear()
        load()
    } catch { toast('Could not save — try again', true) }
    finally {
        btn.disabled = false
        btn.textContent = 'ADD OFFER'
    }
}

// ── Edit offer — pre-fills form with existing data
async function editOffer(markerId) {
    const offer = all.find(o => o.markerId === markerId)
    if (!offer) return
    document.getElementById('product').value    = offer.product
    document.getElementById('category').value   = offer.category
    document.getElementById('original').value   = offer.original || ''
    document.getElementById('price').value      = offer.price
    document.getElementById('discount').value   = offer.discount || ''
    document.getElementById('validUntil').value = offer.validUntil || ''
    selectMarker(markerId)
    document.getElementById('addbtn').textContent = 'UPDATE OFFER'
    window.scrollTo({ top: 0, behavior: 'smooth' })
    toast('Editing ' + offer.product + ' — make changes and click UPDATE OFFER')
}

async function deleteOffer(markerId) {
    if (!confirm(`Remove offer for ${markerId}?`)) return
    try {
        await fetch(`${W}/api/offers/${markerId}`, {
            method: 'DELETE',
            headers: { 'X-Dashboard-Key': getKey() }
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
        const d   = daysLeft(o.validUntil)
        const status = d < 0
            ? '⛔ expired'
            : d <= 3
                ? `⏳ ${d}d left`
                : `✅ ${d}d left`
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
                               ${status}</span>`
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
            <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
                <button class="btn-edit" onclick="editOffer('${o.markerId}')">edit</button>
                <button class="btn-delete" onclick="deleteOffer('${o.markerId}')">delete</button>
            </div>
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

function updateStoreMap() {
    document.querySelectorAll('.shelf-offer-tag').forEach(t =>
        t.textContent = '')
    document.querySelectorAll('.shelf').forEach(s =>
        s.classList.remove('has-offer'))
    all.forEach(o => {
        const shelf = document.getElementById(`shelf-${o.markerId}`)
        const tag   = document.getElementById(`tag-${o.markerId}`)
        if (shelf) shelf.classList.add('has-offer')
        if (tag)   tag.textContent = o.product
    })
}

function clear() {
    ['product','category','original','price','discount','validUntil','markerId']
        .forEach(id => document.getElementById(id).value = '')
    chosenMarker = ''
    document.querySelectorAll('.shelf').forEach(s =>
        s.classList.remove('selected'))
    document.getElementById('addbtn').textContent = 'ADD OFFER'
}

function toast(msg, err = false) {
    const t = document.getElementById('toast')
    t.textContent = msg
    t.className = `toast ${err ? 'error' : ''} show`
    setTimeout(() => t.classList.remove('show'), 3000)
}

window.selectMarker   = selectMarker
window.addOffer       = addOffer
window.editOffer      = editOffer
window.deleteOffer    = deleteOffer
window.filterOffers   = filterOffers
window.updateStoreMap = updateStoreMap
window.saveKey        = saveKey

document.addEventListener('DOMContentLoaded', () => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    document.getElementById('validUntil').value = d.toISOString().split('T')[0]

    // ── Load saved key into input field
    const saved = localStorage.getItem(KEY_STORAGE)
    if (saved) document.getElementById('dashKey').value = saved

    load()
    setInterval(load, 30000)
})