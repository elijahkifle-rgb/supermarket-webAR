// SupermarketAR — Indoor Navigation
// mapCanvas.js
// Canvas drawing functions for the store floor map

import {
    MAP_WIDTH, MAP_HEIGHT,
    MARKER_POSITIONS, LANDMARKS,
    calculatePath, getCustomerPosition,
    updateCustomerPosition
} from './navigation.js'

// ── Draw the complete store map
export function drawMap(canvas, targetMarkerId = null) {
    const ctx = canvas.getContext('2d')
    const w   = canvas.width
    const h   = canvas.height

    // Scale factor — canvas may be different from MAP_WIDTH/HEIGHT
    const sx = w / MAP_WIDTH
    const sy = h / MAP_HEIGHT

    function sc(x, y) {
        return { x: x * sx, y: y * sy }
    }

    // Background
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#0a0e1a'
    ctx.fillRect(0, 0, w, h)

    // ── Store boundary
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'
    ctx.lineWidth   = 1.5
    ctx.strokeRect(10 * sx, 10 * sy, (MAP_WIDTH - 20) * sx, (MAP_HEIGHT - 20) * sy)

    // ── Aisle corridor lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'
    ctx.lineWidth   = 1
    ctx.setLineDash([4, 4])

    // Horizontal main corridor
    const corridorY = 200
    const p1 = sc(20, corridorY)
    const p2 = sc(MAP_WIDTH - 20, corridorY)
    ctx.beginPath()
    ctx.moveTo(p1.x, p1.y)
    ctx.lineTo(p2.x, p2.y)
    ctx.stroke()
    ctx.setLineDash([])

    // ── Aisle labels
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    ctx.font      = `${9 * sx}px -apple-system, Arial, sans-serif`
    ctx.textAlign = 'left'
    ctx.fillText('Aisle 1', 15 * sx, 48 * sy)
    ctx.fillText('Aisle 2', 15 * sx, 128 * sy)
    ctx.fillText('Aisle 3', 15 * sx, 208 * sy)

    // ── Draw path if target exists
    if (targetMarkerId && MARKER_POSITIONS[targetMarkerId]) {
        const customer = getCustomerPosition()
        const target   = MARKER_POSITIONS[targetMarkerId]
        const path     = calculatePath(customer, target)

        ctx.strokeStyle = 'rgba(0,255,136,0.4)'
        ctx.lineWidth   = 2 * sx
        ctx.setLineDash([6 * sx, 4 * sx])
        ctx.beginPath()

        const first = sc(path[0].x, path[0].y)
        ctx.moveTo(first.x, first.y)

        for (let i = 1; i < path.length; i++) {
            const pt = sc(path[i].x, path[i].y)
            ctx.lineTo(pt.x, pt.y)
        }
        ctx.stroke()
        ctx.setLineDash([])

        // Arrow at end of path
        const last   = sc(path[path.length - 1].x, path[path.length - 1].y)
        const prev   = sc(path[path.length - 2].x, path[path.length - 2].y)
        drawArrow(ctx, prev.x, prev.y, last.x, last.y, 'rgba(0,255,136,0.8)', 8 * sx)
    }

    // ── Draw shelves / markers
    Object.entries(MARKER_POSITIONS).forEach(([id, pos]) => {
        const p       = sc(pos.x, pos.y)
        const isTarget = id === targetMarkerId
        const isCurrent = (() => {
            const c = getCustomerPosition()
            return Math.abs(c.x - pos.x) < 15 && Math.abs(c.y - pos.y) < 15
        })()

        // Shelf rectangle
        const rw = 40 * sx
        const rh = 22 * sy
        ctx.fillStyle   = isTarget
            ? 'rgba(0,255,136,0.15)'
            : 'rgba(255,255,255,0.04)'
        ctx.strokeStyle = isTarget
            ? '#00ff88'
            : 'rgba(255,255,255,0.12)'
        ctx.lineWidth   = isTarget ? 1.5 : 1

        roundRect(ctx, p.x - rw/2, p.y - rh/2, rw, rh, 3 * sx)
        ctx.fill()
        ctx.stroke()

        // Marker ID text
        ctx.fillStyle = isTarget
            ? '#00ff88'
            : 'rgba(255,255,255,0.35)'
        ctx.font      = `bold ${7 * sx}px monospace`
        ctx.textAlign = 'center'
        ctx.fillText(id, p.x, p.y + 3 * sy)
    })

    // ── Draw landmarks
    // Entrance
    const ent = sc(LANDMARKS.entrance.x, LANDMARKS.entrance.y)
    ctx.fillStyle   = 'rgba(0,255,136,0.06)'
    ctx.strokeStyle = 'rgba(0,255,136,0.3)'
    ctx.lineWidth   = 1
    ctx.setLineDash([3, 3])
    roundRect(ctx, ent.x - 30 * sx, ent.y - 12 * sy, 60 * sx, 22 * sy, 4 * sx)
    ctx.fill()
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = '#00ff88'
    ctx.font      = `${8 * sx}px -apple-system, Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText('🚪 Entrance', ent.x, ent.y + 3 * sy)

    // Checkout
    const chk = sc(LANDMARKS.checkout.x, LANDMARKS.checkout.y)
    ctx.fillStyle   = 'rgba(67,97,238,0.12)'
    ctx.strokeStyle = 'rgba(67,97,238,0.3)'
    ctx.lineWidth   = 1
    roundRect(ctx, chk.x - 30 * sx, chk.y - 12 * sy, 60 * sx, 22 * sy, 4 * sx)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#7b9ff9'
    ctx.font      = `${8 * sx}px -apple-system, Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText('🛒 Checkout', chk.x, chk.y + 3 * sy)

    // ── Draw customer position (blue pulsing dot)
    const customer = getCustomerPosition()
    const cp       = sc(customer.x, customer.y)

    // Outer glow
    ctx.fillStyle = 'rgba(100,149,237,0.2)'
    ctx.beginPath()
    ctx.arc(cp.x, cp.y, 12 * sx, 0, Math.PI * 2)
    ctx.fill()

    // Inner dot
    ctx.fillStyle = '#6495ED'
    ctx.beginPath()
    ctx.arc(cp.x, cp.y, 6 * sx, 0, Math.PI * 2)
    ctx.fill()

    // White centre
    ctx.fillStyle = 'white'
    ctx.beginPath()
    ctx.arc(cp.x, cp.y, 3 * sx, 0, Math.PI * 2)
    ctx.fill()

    // YOU label
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.font      = `${7 * sx}px -apple-system, Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText('YOU', cp.x, cp.y - 14 * sy)

    // ── Draw target marker dot
    if (targetMarkerId && MARKER_POSITIONS[targetMarkerId]) {
        const t  = MARKER_POSITIONS[targetMarkerId]
        const tp = sc(t.x, t.y)

        // Pulsing glow
        ctx.fillStyle = 'rgba(0,255,136,0.2)'
        ctx.beginPath()
        ctx.arc(tp.x, tp.y, 14 * sx, 0, Math.PI * 2)
        ctx.fill()

        // Target dot
        ctx.fillStyle = '#00ff88'
        ctx.beginPath()
        ctx.arc(tp.x, tp.y, 7 * sx, 0, Math.PI * 2)
        ctx.fill()

        // White centre
        ctx.fillStyle = 'white'
        ctx.beginPath()
        ctx.arc(tp.x, tp.y, 3 * sx, 0, Math.PI * 2)
        ctx.fill()

        // HERE label
        ctx.fillStyle = '#00ff88'
        ctx.font      = `bold ${7 * sx}px -apple-system, Arial, sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText('HERE', tp.x, tp.y - 16 * sy)
    }
}

// ── Helper — draw rounded rectangle
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
}

// ── Helper — draw arrow at end of path
function drawArrow(ctx, fromX, fromY, toX, toY, color, size) {
    const angle = Math.atan2(toY - fromY, toX - fromX)
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(toX, toY)
    ctx.lineTo(
        toX - size * Math.cos(angle - Math.PI / 6),
        toY - size * Math.sin(angle - Math.PI / 6)
    )
    ctx.lineTo(
        toX - size * Math.cos(angle + Math.PI / 6),
        toY - size * Math.sin(angle + Math.PI / 6)
    )
    ctx.closePath()
    ctx.fill()
}

// ── Animate the map (pulse effect for dots)
let animFrame = null
export function startMapAnimation(canvas, targetMarkerId, onArrived) {
    stopMapAnimation()

    function animate() {
        updateCustomerPosition()
        drawMap(canvas, targetMarkerId)

        // Check if arrived every frame
        if (onArrived) {
            const pos    = getCustomerPosition()
            const target = MARKER_POSITIONS[targetMarkerId]
            if (target) {
                const dx = Math.abs(pos.x - target.x)
                const dy = Math.abs(pos.y - target.y)
                if (dx < 15 && dy < 15) {
                    onArrived()
                }
            }
        }

        animFrame = requestAnimationFrame(animate)
    }
    animate()
}
export function stopMapAnimation() {
    if (animFrame) {
        cancelAnimationFrame(animFrame)
        animFrame = null
    }
}
