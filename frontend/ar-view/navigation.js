// SupermarketAR — Indoor Navigation
// navigation.js
// Store map data and path calculation logic

// ── Store map dimensions (matches canvas size)
export const MAP_WIDTH  = 360
export const MAP_HEIGHT = 280

// ─ Store landmark positions (in canvas pixels)
export const LANDMARKS = {
    entrance: { x: 290, y: 255, label: ' Entrance' },
    checkout: { x: 90,  y: 255, label: 'Checkout' },
}

// ── Shelf marker positions on the map
export const MARKER_POSITIONS = {
    M001: { x: 70,  y: 60,  aisle: 1, label: 'Pasta & Rice',      color: '#00ff88' },
    M002: { x: 180, y: 60,  aisle: 1, label: 'Tuna & Oil',        color: '#00ff88' },
    M003: { x: 290, y: 60,  aisle: 1, label: 'Tomatoes & Sauces', color: '#00ff88' },
    M004: { x: 70,  y: 140, aisle: 2, label: 'Water & Juice',     color: '#7b9ff9' },
    M005: { x: 180, y: 140, aisle: 2, label: 'Beer & Wine',       color: '#7b9ff9' },
    M006: { x: 290, y: 140, aisle: 2, label: 'Salad & Fruit',     color: '#7b9ff9' },
    M007: { x: 70,  y: 220, aisle: 3, label: 'Cleaning & Home',   color: '#ff9f43' },
    M008: { x: 290, y: 220, aisle: 3, label: 'Tools & Hardware',  color: '#ff9f43' },
}

// ── Aisle walkway positions (y coordinates)
const AISLE_PATHS = {
    entrance_to_aisle1: [ // vertical path from entrance to aisle 1
        { x: 290, y: 255 },
        { x: 290, y: 200 },
        { x: 180, y: 200 },
        { x: 180, y: 100 },
    ],
    horizontal_main: { y: 200 }, // main horizontal corridor y position
    aisle1_y: 60,
    aisle2_y: 140,
    aisle3_y: 220,
}

// ── Customer current position (updated when marker scanned)
let customerPosition = { ...LANDMARKS.entrance }
let lastScannedPosition = { ...LANDMARKS.entrance }
let targetPosition = { ...LANDMARKS.entrance }
// ──makes it importable by main.js
export function setCustomerPosition(markerId) {
    if (MARKER_POSITIONS[markerId]) {
        targetPosition = { ...MARKER_POSITIONS[markerId] }
        lastScannedPosition = { ...MARKER_POSITIONS[markerId] }
    }
}

// Called by animation loop to smoothly move dot
export function updateCustomerPosition() {
    const speed = 0.05
    customerPosition.x += (targetPosition.x - customerPosition.x) * speed
    customerPosition.y += (targetPosition.y - customerPosition.y) * speed
}

export function getCustomerPosition() {
    return customerPosition
}
export function resetCustomerPosition() {
    customerPosition    = { ...LANDMARKS.entrance }
    targetPosition      = { ...LANDMARKS.entrance }
    lastScannedPosition = { ...LANDMARKS.entrance }
}

// ── Calculate simple path between two points

export function calculatePath(from, to) {
    const corridor_y = 200

    // Compare aisle y positions directly
    const fromAisle = from.aisle || 0
    const toAisle   = to.aisle   || 0

    if (fromAisle === toAisle && fromAisle !== 0) {
        return [
            { x: from.x, y: from.y },
            { x: to.x,   y: to.y   },
        ]
    }

    return [
        { x: from.x, y: from.y    },// start
        { x: from.x, y: corridor_y }, // move to corridor
        { x: to.x,   y: corridor_y },// move along corridor
        { x: to.x,   y: to.y      }, // move to target shelf
    ]
}

// ── Calculate distance in metres (calibrated estimate)
// 1 pixel ≈ 0.05 metres for a typical small supermarket
export function calculateDistance(from, to) {
    const path   = calculatePath(from, to)
    let   total  = 0
    for (let i = 1; i < path.length; i++) {
        const dx = path[i].x - path[i-1].x
        const dy = path[i].y - path[i-1].y
        total += Math.sqrt(dx*dx + dy*dy)
    }
    const metres = (total * 0.05).toFixed(0)
    if (metres < 5)  return 'less than 5m'
    if (metres < 10) return 'about ' + metres + 'm'
    return 'about ' + metres + 'm'
}

// ── Get direction instruction
export function getDirection(from, to) {
    const path = calculatePath(from, to)
    if (path.length < 2) return 'You are at the shelf'

    const first = path[1]
    const dx = first.x - from.x
    const dy = first.y - from.y

    if (Math.abs(dy) > Math.abs(dx)) {
        return dy > 0 ? '⬇️ Go toward checkout' : '⬆️ Go toward back of store'
    } else {
        return dx > 0 ? '➡️ Turn right' : '⬅️ Turn left'
    }
}

// ── Get full navigation instruction text
export function getNavigationText(targetMarkerId) {
    const target = MARKER_POSITIONS[targetMarkerId]
    if (!target) return null

    const from      = lastScannedPosition
    const distance  = calculateDistance(from, target)
    const direction = getDirection(from, target)

    // Use animated customerPosition to detect arrival
    const animPos  = customerPosition
    const atTarget = Math.abs(animPos.x - target.x) < 15 &&
        Math.abs(animPos.y - target.y) < 15

    if (atTarget) {
        return {
            direction: 'You are here',
            distance:  'Scan the marker',
            aisle:     `Aisle ${target.aisle} — ${target.label}`,
            arrived:   true,
        }
    }

    return {
        direction,
        distance,
        aisle:   `Aisle ${target.aisle} — ${target.label}`,
        arrived: false,
    }
}