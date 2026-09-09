function haversineDistance(lat1, lng1, lat2, lng2) {
  const earthRadiusKm = 6371
  const toRadians = (degrees) => (degrees * Math.PI) / 180
  const latitudeDelta = toRadians(lat2 - lat1)
  const longitudeDelta = toRadians(lng2 - lng1)
  const firstLatitude = toRadians(lat1)
  const secondLatitude = toRadians(lat2)

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

module.exports = { haversineDistance }
