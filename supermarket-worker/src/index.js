// supermarket-worker/src/index.js
// SupermarketAR — Cloudflare Worker
// Author: Elias Kifle Tsina

let requestCount = 0

const rateLimitMap = new Map()

function isRateLimited(ip) {
	const now         = Date.now()
	const windowMs    = 60 * 1000
	const maxRequests = 500
	if (!rateLimitMap.has(ip)) {
		rateLimitMap.set(ip, { count: 1, start: now })
		return false
	}
	const record = rateLimitMap.get(ip)
	if (now - record.start > windowMs) {
		rateLimitMap.set(ip, { count: 1, start: now })
		return false
	}
	record.count++
	return record.count > maxRequests
}

export default {
	async fetch(request, env, ctx) {

		const allowedOrigins = (env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim())
		const requestOrigin  = request.headers.get('Origin') || ''

		const corsHeaders = {
			'Access-Control-Allow-Origin':  '*',
			'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, X-Dashboard-Key',
		}

		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders })
		}

		const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown'
		if (isRateLimited(clientIP)) {
			return new Response(JSON.stringify({ error: 'Too many requests' }), {
				status: 429,
				headers: { 'Content-Type': 'application/json', ...corsHeaders }
			})
		}

		requestCount++
		const url = new URL(request.url)
		console.log(`[REQUEST] #${requestCount} ${request.method} ${url.pathname}`)

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
	const category  = url.searchParams.get('category')
	const cloudOnly = url.searchParams.get('cloudonly') === 'true'

	//  GET /api/offers/:markerId
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
		const offer   = await env.OFFERS_KV.get(
			`offer:${markerId}`, { type: 'json' }
		)
		const kvMs    = Date.now() - kvStart
		const totalMs = Date.now() - t0

		if (!offer) {
			return new Response(
				JSON.stringify({ error: 'No offer for this marker' }),
				{
					status: 404,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' }
				}
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

		const list   = await env.OFFERS_KV.list({ prefix: 'offer:' })
		const offers = await Promise.all(
			list.keys.map(k => env.OFFERS_KV.get(k.name, { type: 'json' }))
		)
		const active = offers.filter(o => {
			if (!o) return false
			if (!o.active) return false
			if (o.validUntil && new Date(o.validUntil) < new Date()) return false
			return true
		})
		const filtered = category
			? active.filter(o => o.category === category)
			: active
		const totalMs  = Date.now() - t0

		return new Response(JSON.stringify(filtered), {
			status: 200,
			headers: {
				...corsHeaders,
				'Content-Type':    'application/json',
				'X-Config':        'cloud-edge',
				'X-Total-Latency': String(totalMs)
			}
		})
	}

	//  POST
	if (request.method === 'POST') {
		const dashKey = request.headers.get('X-Dashboard-Key')
		if (dashKey !== env.DASHBOARD_KEY) {
			return new Response(JSON.stringify({ error: 'Unauthorised' }), {
				status: 401,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			})
		}
		const body = await request.json()
		if (!body.markerId || !body.product || !body.category || !body.price) {
			return new Response(JSON.stringify({ error: 'Missing required fields' }), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			})
		}


		//  Auto-compute discount if not provided
		const wasPrice = parseFloat(body.original) || 0
		const nowPrice = parseFloat(body.price)    || 0
		let discount   = body.discount || null
		if (!discount && wasPrice > 0 && nowPrice >= 0) {
			discount = Math.round((1 - nowPrice / wasPrice) * 100) + '%'
		}

		const offer = {
			markerId:   body.markerId,
			product:    body.product,
			category:   body.category,
			original:   body.original   ? parseFloat(body.original) : null,
			price:      parseFloat(body.price),
			discount:   discount,
			validUntil: body.validUntil || null,
			active:     true,
			updatedAt:  new Date().toISOString(),
			createdAt:  Date.now()
		}

		await env.OFFERS_KV.put(
			`offer:${offer.markerId}`,
			JSON.stringify(offer)
		)
		return new Response(JSON.stringify({ success: true, offer }), {
			status: 201,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		})
	}

	// DELETE
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