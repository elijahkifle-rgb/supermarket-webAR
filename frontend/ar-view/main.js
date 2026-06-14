// SupermarketAR — Customer AR Interface
// main.js

import { initMarkerTracking } from './arsession.js'
import {
    getNavigationText,
    setCustomerPosition,
    resetCustomerPosition,
} from './navigation.js'
import { drawMap, startMapAnimation, stopMapAnimation } from './mapCanvas.js'

const WORKER_URL = import.meta.env.VITE_WORKER_URL ||
    'https://supermarket-ar-worker.webar-football.workers.dev'

// Product image database
const PRODUCT_IMAGES = {

    'heineken':  '/images/heineken2.png',

    'peroni':    '/images/peroni.webp',

    'barilla':   '/images/barilla.png',

    'pasta':     '/images/barilla.png',

    'oil':       '/images/oil.png',

    'tomato':    '/images/tomato.png',

    'salad':     '/images/salad.png',

    'fruit':     '/images/fruit.png',

    'cleaning':  '/images/cleaning.png',

    'tools':     '/images/tools.png',
}
function getProductImage(productName) {
    const name = productName.toLowerCase()
    const match = Object.keys(PRODUCT_IMAGES).find(key =>
        name.includes(key)
    )
    return match ? PRODUCT_IMAGES[match] : null
}

let navTargetId  = null
let allOffers    = []
let currentOffer = null
let activeFilter = 'all'
let markerVisible = false

const params   = new URLSearchParams(window.location.search)
const markerId = params.get('marker') || 'M001'

//  Load all offers on startup
async function loadOffers() {
    setTimeout(() => {
        document.getElementById('loading').style.display = 'none'
    }, 3000)
    try {
        const start = Date.now()
        const r     = await fetch(`${WORKER_URL}/api/offers`)
        const ms    = Date.now() - start
        allOffers   = await r.json()

        // ── Log performance evidence
        console.log(`[SupermarketAR] ${allOffers.length} offers loaded in ${ms}ms`)
        console.log(`[SupermarketAR] X-KV-Latency: ${r.headers.get('X-KV-Latency')}ms`)
        console.log(`[SupermarketAR] X-Total-Latency: ${r.headers.get('X-Total-Latency')}ms`)
        console.log(`[SupermarketAR] X-Edge-Location: ${r.headers.get('X-Edge-Location')}`)
        console.log(`[SupermarketAR] X-Network-Type: ${r.headers.get('X-Network-Type')}`)
    } catch (err) {
        console.error('[SupermarketAR] Failed to load offers:', err)
    } finally {
        document.getElementById('loading').style.display = 'none'
    }
}

// ── Get offer for detected marker
function getOfferForMarker(id) {
    return allOffers.find(o => {
        if (o.markerId !== id) return false
        if (!o.active) return false
        if (o.validUntil && new Date(o.validUntil) < new Date()) return false
        if (activeFilter !== 'all' && o.category !== activeFilter) return false
        return true
    }) || null
}
function updateAROverlay(offer) {
    const set = (id, val) => {
        const el = document.getElementById(id)
        if (el) el.setAttribute('value', val)
    }

    const wrapEl = document.getElementById('ar-image-wrapper')
    const imgEl  = document.getElementById('ar-product-image')

    if (!offer) {
        set('ar-category', '')
        set('ar-product',  '')
        set('ar-price',    '')
        set('ar-discount', '')
        set('ar-original', '')
        if (wrapEl) {
            wrapEl.setAttribute('visible', 'false')
            wrapEl.removeAttribute('animation__up')
            wrapEl.removeAttribute('animation__grow')
            wrapEl.removeAttribute('animation__hover')
            wrapEl.setAttribute('scale',    '0.1 0.1 0.1')
            wrapEl.setAttribute('position', '0.65 0.01 -0.15')
        }
        return
    }

    const catLabels = {
        food:     '[ FOOD ]',
        drinks:   '[ DRINKS ]',
        home:     '[ HOME ]',
        hardware: '[ HARDWARE ]',
        fresh:    '[ FRESH ]',
    }

    set('ar-category', catLabels[offer.category] || '[ OFFER ]')
    set('ar-product',  offer.product.toUpperCase())
    set('ar-price',    `EUR ${parseFloat(offer.price).toFixed(2)}`)
    set('ar-discount', offer.discount ? `-${offer.discount}` : '')
    set('ar-original', offer.original ? `WAS EUR ${parseFloat(offer.original).toFixed(2)}` : '')

    // ── Product image
    const imageUrl = getProductImage(offer.product)

    if (wrapEl && imgEl && imageUrl) {
        imgEl.setAttribute('src', imageUrl)
        wrapEl.setAttribute('scale',    '0.1 0.1 0.1')
        wrapEl.setAttribute('position', '0.65 0.01 -0.15')
        wrapEl.setAttribute('visible',  'true')
        wrapEl.removeAttribute('animation__up')
        wrapEl.removeAttribute('animation__grow')
        wrapEl.removeAttribute('animation__hover')

        setTimeout(() => {
            wrapEl.setAttribute('animation__up', {
                property: 'position',
                from:     '0.65 0.01 -0.15',
                to:       '0.65 0.55 -0.15',
                dur:      600,
                easing:   'easeOutBack'
            })
            wrapEl.setAttribute('animation__grow', {
                property: 'scale',
                from:     '0.05 0.05 0.05',
                to:       '1.1 1.1 1.1',
                dur:      600,
                easing:   'easeOutBack'
            })
            setTimeout(() => {
                wrapEl.setAttribute('animation__hover', {
                    property: 'position',
                    from:     '0.65 0.42 -0.15',
                    to:       '0.65 0.48 -0.15',
                    dur:      800,
                    easing:   'easeInOutSine',
                    loop:     true,
                    dir:      'alternate'
                })
            }, 600)
        }, 300)

        document.getElementById('ar-product').setAttribute('position', '-0.35 0.01 -0.32')
        document.getElementById('ar-price').setAttribute('position',   '-0.35 0.01 0.0')
        document.getElementById('ar-discount').setAttribute('position','-0.35 0.01 0.2')

    } else {
        if (wrapEl) {
            wrapEl.setAttribute('visible', 'false')
            wrapEl.removeAttribute('animation__up')
            wrapEl.removeAttribute('animation__grow')
            wrapEl.removeAttribute('animation__hover')
            wrapEl.setAttribute('scale',    '0.1 0.1 0.1')
            wrapEl.setAttribute('position', '0.65 0.01 -0.15')
        }
        document.getElementById('ar-product').setAttribute('position', '0 0.01 -0.25')
        document.getElementById('ar-price').setAttribute('position',   '-0.2 0.01 0.0')
        document.getElementById('ar-discount').setAttribute('position','0.52 0.01 0.0')
    }
}

// ── Show offer popup
function showPopup(offer) {
    if (!offer) return
    currentOffer = offer
    document.getElementById('offer-product').textContent   = offer.product
    document.getElementById('offer-price-now').textContent = `€${parseFloat(offer.price).toFixed(2)}`
    document.getElementById('offer-price-was').textContent = offer.original ? `€${parseFloat(offer.original).toFixed(2)}` : ''
    document.getElementById('offer-discount').textContent  =
        offer.discount ? `-${offer.discount}` : ''
    document.getElementById('offer-category').textContent  = offer.category
    document.getElementById('offer-valid').textContent     = offer.validUntil ? `Valid until ${offer.validUntil}` : ''
    document.getElementById('offer-marker').textContent    =
        `Marker: ${offer.markerId}`
    document.getElementById('offer-popup').classList.add('show')
}

function closePopup() {
    document.getElementById('offer-popup').classList.remove('show')
}

// ── Category filter
window.setFilter = function(cat) {
    activeFilter = cat
    document.querySelectorAll('.cat-btn').forEach(b =>
        b.classList.remove('active'))
    event.target.classList.add('active')
    if (markerVisible && currentOffer) {
        updateAROverlay(getOfferForMarker(currentOffer.markerId))
    }
}

// ── Shelf location helper
function getShelfLocation(id) {
    const locations = {
        M001: '📍 Aisle 1 — Pasta & Rice',
        M002: '📍 Aisle 1 — Tuna & Oil',
        M003: '📍 Aisle 1 — Tomatoes & Sauces',
        M004: '📍 Aisle 2 — Water & Juice',
        M005: '📍 Aisle 2 — Beer & Wine',
        M006: '📍 Aisle 2 — Salad & Fruit',
        M007: '📍 Aisle 3 — Cleaning & Home',
        M008: '📍 Aisle 3 — Tools & Hardware',
    }
    return locations[id] || id
}

// ── Navigation functions
function startNavigation(targetMarkerId, productName) {
    navTargetId = targetMarkerId
    closePopup()
    resetCustomerPosition()
    document.getElementById('nav-product-name').textContent = productName

    // Show panel FIRST so canvas gets real dimensions
    document.getElementById('nav-panel').classList.add('show')

    // Wait 50ms for panel to render then draw canvas
    setTimeout(() => {
        const canvas  = document.getElementById('map-canvas')
        canvas.width  = canvas.offsetWidth || 360
        canvas.height = 180
        drawMap(canvas, targetMarkerId)
        updateNavInstruction()
        startMapAnimation(canvas, targetMarkerId, () => {
            // Called when blue dot reaches target shelf
            updateNavInstruction()
        })
    }, 50)
}

function updateNavInstruction() {
    if (!navTargetId) return
    const nav = getNavigationText(navTargetId)
    if (!nav) return
    const parts   = nav.direction.split(' ')
    const arrow   = parts[0]
    const dirText = parts.slice(1).join(' ')
    document.getElementById('nav-direction').textContent = arrow
    document.getElementById('nav-aisle').textContent     = nav.aisle + ' — ' + dirText
    document.getElementById('nav-distance').textContent  = nav.arrived
        ? ' You have arrived — scan the marker'
        : nav.distance + ' away'
}

function closeNavigation() {
    document.getElementById('nav-panel').classList.remove('show')
    stopMapAnimation()
    navTargetId = null
}

window.closeNavigation = closeNavigation

// ── AR Arrow Navigation
let arNavActive  = false
let arNavTarget  = null
let compassWatch = null

function startARNavigation(targetMarkerId, productName) {
    arNavActive = true
    arNavTarget = targetMarkerId

    const bar = document.getElementById('nav-compass-bar')
    if (bar) bar.classList.add('show')

    const arrow = document.getElementById('nav-arrow-container')
    if (arrow) arrow.setAttribute('visible', 'true')

    const label = document.getElementById('nav-arrow-label')
    if (label) label.setAttribute('value', productName.toUpperCase())

    updateARArrow()

    if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', onDeviceOrientation)
    }

    compassWatch = setInterval(updateARArrow, 2000)
}

function stopARNavigation() {
    arNavActive = false
    arNavTarget = null

    const bar = document.getElementById('nav-compass-bar')
    if (bar) bar.classList.remove('show')

    const arrow = document.getElementById('nav-arrow-container')
    if (arrow) arrow.setAttribute('visible', 'false')

    window.removeEventListener('deviceorientation', onDeviceOrientation)

    if (compassWatch) {
        clearInterval(compassWatch)
        compassWatch = null
    }
}

let lastHeading = 0

function onDeviceOrientation(event) {
    if (event.alpha !== null) {
        lastHeading = event.alpha
        updateARArrow()
    }
}

function updateARArrow() {
    if (!arNavActive || !arNavTarget) return

    const nav = getNavigationText(arNavTarget)
    if (!nav) return

    const compassDir  = document.getElementById('nav-compass-direction')
    const compassText = document.getElementById('nav-compass-text')
    const compassDist = document.getElementById('nav-compass-distance')
    const parts   = nav.direction.split(' ')

    if (compassDir)  compassDir.textContent  = parts[0]
    if (compassText) compassText.textContent = parts.slice(1).join(' ')
    if (compassDist) compassDist.textContent = nav.arrived
        ? 'You have arrived'
        : nav.distance + ' away'

    const arrow = document.getElementById('nav-arrow-container')
    if (!arrow) return

    if (nav.arrived) {
        arrow.setAttribute('visible', 'false')
        return
    }

    arrow.setAttribute('visible', 'true')
}

// ── Navigate to shelf
window.navigateTo = function(targetMarkerId, productName) {
    clearSearch()
    startARNavigation(targetMarkerId, productName)
    startNavigation(targetMarkerId, productName)
}

// ── Product search
window.searchOffers = function(query) {
    const q        = query.toLowerCase().trim()
    const clearBtn = document.getElementById('search-clear')
    const panel    = document.getElementById('search-results')
    const list     = document.getElementById('search-results-list')

    if (!q) {
        clearBtn.classList.remove('show')
        panel.classList.remove('show')
        list.innerHTML = ''
        return
    }

    clearBtn.classList.add('show')

    const results = allOffers.filter(o => {
        const matchProduct  = o.product.toLowerCase().includes(q)
        const matchCategory = o.category.toLowerCase().includes(q)
        const isActive      = o.active
        const notExpired    = !o.validUntil ||
            new Date(o.validUntil) >= new Date()
        return (matchProduct || matchCategory) && isActive && notExpired
    })

    if (!results.length) {
        list.innerHTML = `
            <div class="search-empty">
                No offers found for "${query}"
            </div>`
        panel.classList.add('show')
        return
    }

    list.innerHTML = results.map(o => `
        <div class="search-result-item">
            <div class="result-info">
                <h3>${o.product}</h3>
                <div class="result-meta">
                    <span class="result-cat">${o.category}</span>
                    <span class="result-marker">${o.markerId}</span>
                </div>
                <div class="result-location">${getShelfLocation(o.markerId)}</div>
                <div class="result-nav-btn"
                     onclick="navigateTo('${o.markerId}', '${o.product.replace(/'/g, "\\'")}')">
                    📍 Navigate to shelf
                </div>
            </div>
            <div class="result-price">
                ${o.original
        ? `<div class="result-price-was">€${parseFloat(o.original).toFixed(2)}</div>`
        : ''}
                <div class="result-price-now">€${parseFloat(o.price).toFixed(2)}</div>
                ${o.discount
        ? `<div class="result-discount">-${o.discount}</div>`
        : ''}
            </div>
        </div>
    `).join('')

    panel.classList.add('show')
}

window.selectSearchResult = function(mid) {
    const offer = allOffers.find(o => o.markerId === mid)
    if (!offer) return
    clearSearch()
    showPopup(offer)
}

window.clearSearch = function() {
    document.getElementById('product-search').value = ''
    document.getElementById('search-clear').classList.remove('show')
    document.getElementById('search-results').classList.remove('show')
    document.getElementById('search-results-list').innerHTML = ''
}

window.closePopup = closePopup

// ── Marker tracking via arsession.js
initMarkerTracking(
    () => {
        markerVisible = true
        document.getElementById('scan-hint').style.display = 'none'
        const offer  = getOfferForMarker(markerId)
        currentOffer = offer
        updateAROverlay(offer)

        setCustomerPosition(markerId)

        if (navTargetId) {
            const nav = getNavigationText(navTargetId)
            if (nav && !nav.arrived) {
                const canvas  = document.getElementById('map-canvas')
                canvas.width  = canvas.offsetWidth || 360
                canvas.height = 180
                drawMap(canvas, navTargetId)
                updateNavInstruction()
            }
        }

        if (arNavActive) {
            updateARArrow()
            if (markerId === arNavTarget) {
                stopARNavigation()
                if (offer) setTimeout(() => showPopup(offer), 1000)
                return
            }
            return
        }

        if (offer) setTimeout(() => showPopup(offer), 500)
    },
    () => {
        markerVisible = false
        document.getElementById('scan-hint').style.display = 'block'
        closePopup()
    }
)
window.navigateFromPopup = function() {
    if (!currentOffer) return
    closePopup()
    startARNavigation(currentOffer.markerId, currentOffer.product)
    startNavigation(currentOffer.markerId, currentOffer.product)
}

//  Hide loading when AR scene is ready
const scene = document.querySelector('a-scene')
if (scene) {
    scene.addEventListener('loaded', () => {
        document.getElementById('loading').style.display = 'none'

        // bounce animation
        const group = document.getElementById('offer-group')
        if (group) {
            group.setAttribute('animation__float', {
                property: 'position',
                from: '0 0.02 0',
                to: '0 0.12 0',
                dur: 1500,
                easing: 'easeInOutSine',
                loop: true,
                dir: 'alternate'
            })
        }
    })
}
// Refresh offers every 30 seconds
setInterval(async () => {
    const r   = await fetch(`${WORKER_URL}/api/offers`)
    allOffers = await r.json()
    console.log('[SupermarketAR] Offers refreshed')
}, 30000)

// ── Detect network type
function detectNetwork() {
    const conn = navigator.connection ||
        navigator.mozConnection ||
        navigator.webkitConnection
    if (conn) {
        console.log(`[Network] Type: ${conn.effectiveType}`)
        console.log(`[Network] Downlink: ${conn.downlink}Mbps`)
        console.log(`[Network] RTT: ${conn.rtt}ms`)
        return conn.effectiveType
    }
    return 'unknown'
}

const networkType = detectNetwork()
console.log(`[SupermarketAR] Running on network: ${networkType}`)

// ── Start
loadOffers()