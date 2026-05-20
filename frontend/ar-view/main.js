// SupermarketAR — Customer AR Interface
// main.js

const WORKER_URL = import.meta.env.VITE_WORKER_URL ||
    'https://supermarket-ar-worker.webar-football.workers.dev'

let allOffers    = []
let currentOffer = null
let activeFilter = 'all'
let markerVisible = false

// ── Load all offers on startup ─────────────────────────────────────────────
async function loadOffers() {
    try {
        const r = await fetch(`${WORKER_URL}/api/offers`)
        allOffers = await r.json()
        console.log(`[SupermarketAR] ${allOffers.length} offers loaded`)
    } catch (err) {
        console.error('[SupermarketAR] Failed to load offers:', err)
    } finally {
        document.getElementById('loading').style.display = 'none'
    }
}

// ── Get offer for detected marker ──────────────────────────────────────────
function getOfferForMarker(markerId) {
    const offer = allOffers.find(o => {
        if (o.markerId !== markerId) return false
        if (!o.active) return false
        if (o.validUntil && new Date(o.validUntil) < new Date()) return false
        if (activeFilter !== 'all' && o.category !== activeFilter) return false
        return true
    })
    return offer || null
}

// ── Update AR overlay with offer data ─────────────────────────────────────
function updateAROverlay(offer) {
    if (!offer) {
        document.getElementById('ar-product').setAttribute('value', 'NO OFFER')
        document.getElementById('ar-price').setAttribute('value', '')
        document.getElementById('ar-discount').setAttribute('value', '')
        document.getElementById('ar-category').setAttribute('value', '')
        return
    }

    const product  = offer.product.toUpperCase()
    const price    = `€${parseFloat(offer.price).toFixed(2)}`
    const discount = offer.discount ? `-${offer.discount}` : ''
    const category = offer.category.toUpperCase()

    document.getElementById('ar-product').setAttribute('value', product)
    document.getElementById('ar-price').setAttribute('value', price)
    document.getElementById('ar-discount').setAttribute('value', discount)
    document.getElementById('ar-category').setAttribute('value', category)
}

// ── Show offer popup ───────────────────────────────────────────────────────
function showPopup(offer) {
    if (!offer) return
    currentOffer = offer

    document.getElementById('offer-product').textContent  =
        offer.product
    document.getElementById('offer-price-now').textContent =
        `€${parseFloat(offer.price).toFixed(2)}`
    document.getElementById('offer-price-was').textContent =
        offer.original ? `€${parseFloat(offer.original).toFixed(2)}` : ''
    document.getElementById('offer-discount').textContent  =
        offer.discount ? `-${offer.discount}` : ''
    document.getElementById('offer-category').textContent  =
        offer.category
    document.getElementById('offer-valid').textContent     =
        offer.validUntil ? `Valid until ${offer.validUntil}` : ''
    document.getElementById('offer-marker').textContent    =
        `Marker: ${offer.markerId}`

    document.getElementById('offer-popup').classList.add('show')
}

function closePopup() {
    document.getElementById('offer-popup').classList.remove('show')
}

// ── Category filter ────────────────────────────────────────────────────────
window.setFilter = function(cat) {
    activeFilter = cat
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'))
    event.target.classList.add('active')

    if (markerVisible && currentOffer) {
        const offer = getOfferForMarker(currentOffer.markerId)
        updateAROverlay(offer)
    }
}

// ── Marker tracking ────────────────────────────────────────────────────────
window.addEventListener('load', () => {
    setTimeout(() => {
        const marker = document.getElementById('main-marker')
        if (!marker) return

        marker.addEventListener('markerFound', () => {
            markerVisible = true
            document.getElementById('scan-hint').style.display = 'none'

            // For demo — use M001 as default marker
            // In production this would read the actual marker ID
            const params   = new URLSearchParams(window.location.search)
            const markerId = params.get('marker') || 'M001'
            const offer    = getOfferForMarker(markerId)
            currentOffer   = offer

            updateAROverlay(offer)

            if (offer) {
                setTimeout(() => showPopup(offer), 500)
            }
        })

        marker.addEventListener('markerLost', () => {
            markerVisible = false
            document.getElementById('scan-hint').style.display = 'block'
            closePopup()
        })

    }, 800)
})

//  Start
loadOffers()