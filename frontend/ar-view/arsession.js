export function initMarkerTracking(onMarkerFound, onMarkerLost) {
    function attach() {
        const marker = document.getElementById('main-marker')
        if (!marker) {
            setTimeout(attach, 300)
            return
        }

        let markerLostTimer = null

        marker.addEventListener('markerFound', () => {
            if (markerLostTimer) {
                clearTimeout(markerLostTimer)
                markerLostTimer = null
            }
            console.log('Marker found')
            if (onMarkerFound) onMarkerFound()
        })

        marker.addEventListener('markerLost', () => {
            markerLostTimer = setTimeout(() => {
                console.log('Marker lost')
                if (onMarkerLost) onMarkerLost()
            }, 3000)
        })

        console.log('Marker tracking initialised')
    }
    setTimeout(attach, 800)
}