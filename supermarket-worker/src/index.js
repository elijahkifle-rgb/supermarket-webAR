// supermarket-worker/src/index.js
// SupermarketAR — Cloudflare Worker
// Author: Elias Kifle Tsina

const KEY_PREFIX       = 'offer:'
const RL_PREFIX        = 'rl:'
const RATE_LIMIT       = 500
const RATE_WINDOW_S    = 60
const VALID_CATEGORIES = ['food', 'drinks', 'fresh', 'home', 'hardware']

async function isRateLimited(env, ip) {
	const key   = RL_PREFIX + ip
	const raw   = await env.OFFERS_KV.get(key)
	const count = raw ? parseInt(raw, 10) : 0
	if (count >= RATE_LIMIT) return true
	await env.OFFERS_KV.put(key, String(count + 1), { expirationTtl: RATE_WINDOW_S })
	return false
}

function validateOffer(body) {
	const errors = []
	if (!body.markerId || typeof body.markerId !== 'string')
		errors.push('markerId')
	if (!body.product || typeof body.product !== 'string' || !body.product.trim())
		errors.push('product')
	if (!VALID_CATEGORIES.includes((body.category || '').toLowerCase()))
		errors.push('category — must be one of: ' + VALID_CATEGORIES.join(', '))
	const price = parseFloat(body.price)
	if (isNaN(price) || price < 0)
		errors.push('price — must be a non-negative number')
	if (body.original !== undefined && body.original !== null) {
		const original = parseFloat(body.original)
		if (isNaN(original) || original <= 0)
			errors.push('original — must be a positive number when provided')
	}
	return errors
}

async function listAllOffers(env) {
	const offers = []
	let cursor
	do {
		const page = await env.OFFERS_KV.list({ prefix: KEY_PREFIX, cursor })
		const values = await Promise.all(
			page.keys.map(k => env.OFFERS_KV.get(k.name, { type: 'json' }))
		)
		values.forEach(o => { if (o) offers.push(o) })
		cursor = page.list_complete ? undefined : page.cursor
	} while (cursor)
	return offers
}

export default {
	async fetch(request, env) {

		const corsHeaders = {
			'Access-Control-Allow-Origin':  '*',
			'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, X-Dashboard-Key',
		}

		if (request.method === 'OPTIONS') {
			return new Response(null, { status: 204, headers: corsHeaders })
		}

		const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown'
		if (await isRateLimited(env, clientIP)) {
			return new Response(JSON.stringify({ error: 'Too many requests' }), {
				status: 429,
				headers: { 'Content-Type': 'application/json', ...corsHeaders }
			})
		}

		const url = new URL(request.url)

		if (url.pathname.startsWith('/api/offers')) {
			return handleOffers(request, url, env, corsHeaders)
		}

		return new Response(JSON.stringify({ error: 'Not found' }), {
			status: 404,
			headers: { 'Content-Type': 'application/json', ...corsHeaders }
		})
	}
}

async function handleOffers(request, url, env, corsHeaders) {
	const t0        = Date.now()
	const pathParts = url.pathname.split('/').filter(Boolean)
	const markerId  = pathParts[2] || null
	const cloudOnly = url.searchParams.get('cloudonly') === 'true'

	// GET /api/offers/:markerId
	if (request.method === 'GET' && markerId) {

		if (cloudOnly) {
			const r = await fetch(
				`https://api.jsonbin.io/v3/b/${env.JSONBIN_BIN_ID}/latest`,
				{ headers: { 'X-Master-Key': env.JSONBIN_KEY } }
			)
			const data    = await r.json()
			const offers  = data.record || []
			const offer   = offers.find(o => o.markerId === markerId)
			const totalMs = Date.now() - t0
			return new Response(JSON.stringify(offer || null), {
				status: offer ? 200 : 404,
				headers: {
					...corsHeaders,
					'Content-Type':    'application/json',
					'X-Config':        'cloud-only',
					'X-Total-Latency': String(totalMs)
				}
			})
		}

		const kvStart = Date.now()
		const offer   = await env.OFFERS_KV.get(`offer:${markerId}`, { type: 'json' })
		const kvMs    = Date.now() - kvStart
		const totalMs = Date.now() - t0

		if (!offer) {
			return new Response(
				JSON.stringify({ error: 'No offer for this marker' }),
				{ status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
			)
		}

		return new Response(JSON.stringify(offer), {
			status: 200,
			headers: {
				...corsHeaders,
				'Content-Type':    'application/json',
				'X-Config':        'cloud-edge',
				'X-KV-Latency':    String(kvMs),
				'X-Total-Latency': String(totalMs)
			}
		})
	}

	// GET /api/offers
	if (request.method === 'GET') {

		const category = url.searchParams.get('category')

		if (cloudOnly) {
			const r = await fetch(
				`https://api.jsonbin.io/v3/b/${env.JSONBIN_BIN_ID}/latest`,
				{ headers: { 'X-Master-Key': env.JSONBIN_KEY } }
			)
			const data     = await r.json()
			const offers   = data.record || []
			const filtered = category
				? offers.filter(o => o.category === category)
				: offers
			const totalMs  = Date.now() - t0
			return new Response(JSON.stringify(filtered), {
				headers: {
					...corsHeaders,
					'Content-Type':    'application/json',
					'X-Config':        'cloud-only',
					'X-Total-Latency': String(totalMs)
				}
			})
		}

		const kvStart = Date.now()
		const offers  = await listAllOffers(env)
		const kvMs    = Date.now() - kvStart

		const active = offers.filter(o => {
			if (!o) return false
			if (!o.active) return false
			if (o.validUntil && new Date(o.validUntil + 'T23:59:59') < new Date()) return false
			return true
		})
		const filtered = category
			? active.filter(o => o.category === category)
			: active
		const totalMs = Date.now() - t0

		return new Response(JSON.stringify(filtered), {
			status: 200,
			headers: {
				...corsHeaders,
				'Content-Type':    'application/json',
				'X-Config':        'cloud-edge',
				'X-KV-Latency':    String(kvMs),
				'X-Total-Latency': String(totalMs)
			}
		})
	}

	// POST /api/offers
	if (request.method === 'POST') {
		const dashKey = request.headers.get('X-Dashboard-Key')
		if (dashKey !== env.DASHBOARD_KEY) {
			return new Response(JSON.stringify({ error: 'Unauthorised' }), {
				status: 401,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			})
		}

		const body   = await request.json()
		const errors = validateOffer(body)
		if (errors.length > 0) {
			return new Response(
				JSON.stringify({ error: 'Validation failed', fields: errors }),
				{ status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
			)
		}

		const wasPrice = parseFloat(body.original) || 0
		const nowPrice = parseFloat(body.price)    || 0
		let discount   = body.discount || null
		if (!discount && wasPrice > 0 && nowPrice >= 0) {
			discount = Math.round((1 - nowPrice / wasPrice) * 100) + '%'
		}

		const existing = await env.OFFERS_KV.get(
			`offer:${body.markerId}`, { type: 'json' }
		)

		const offer = {
			markerId:   body.markerId,
			product:    body.product.trim(),
			category:   body.category.toLowerCase(),
			original:   body.original   ? parseFloat(body.original) : null,
			price:      parseFloat(body.price),
			discount:   discount,
			validUntil: body.validUntil || null,
			active:     true,
			updatedAt:  new Date().toISOString(),
			createdAt:  existing?.createdAt || Date.now()
		}

		await env.OFFERS_KV.put(`offer:${offer.markerId}`, JSON.stringify(offer))
		return new Response(JSON.stringify({ success: true, offer }), {
			status: 201,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		})
	}

	// DELETE /api/offers/:markerId
	if (request.method === 'DELETE' && markerId) {
		const dashKey = request.headers.get('X-Dashboard-Key')
		if (dashKey !== env.DASHBOARD_KEY) {
			return new Response(JSON.stringify({ error: 'Unauthorised' }), {
				status: 401,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			})
		}
		await env.OFFERS_KV.delete(`offer:${markerId}`)
		return new Response(JSON.stringify({ success: true }), {
			status: 200,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		})
	}

	return new Response(JSON.stringify({ error: 'Method not allowed' }), {
		status: 405,
		headers: { ...corsHeaders, 'Content-Type': 'application/json' }
	})
}