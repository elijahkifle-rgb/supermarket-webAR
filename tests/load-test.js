import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend, Rate, Counter } from 'k6/metrics'

const latency   = new Trend('latency_ms')
const errorRate = new Rate('error_rate')
const totalReqs = new Counter('total_requests')

export let options = {
    scenarios: {
        main: {
            executor: 'constant-vus',
            vus:      10,
            duration: '2m'
        }
    },
    thresholds: {
        latency_ms: ['p(95)<1000'],
        error_rate: ['rate<0.01']
    }
}

const W       = 'https://supermarket-ar-worker.webar-football.workers.dev'
const markers = ['M001', 'M002', 'M003']

export default function() {
    const isCloud  = __ENV.CONFIG === 'cloud'
    const markerId = markers[Math.floor(Math.random() * markers.length)]
    const url      = isCloud
        ? `${W}/api/offers/${markerId}?cloudonly=true`
        : `${W}/api/offers/${markerId}`

    const res = http.get(url)

    totalReqs.add(1)

    const ok = check(res, {
        'status 200': r => r.status === 200,
        'has body':   r => r.body && r.body.length > 0
    })

    errorRate.add(!ok)
    latency.add(res.timings.duration)

    sleep(0.5)
}