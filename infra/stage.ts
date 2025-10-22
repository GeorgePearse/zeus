export const domain = (() => {
  if ($app.stage === "production") return "zeus.ai"
  if ($app.stage === "dev") return "dev.zeus.ai"
  return `${$app.stage}.dev.zeus.ai`
})()

export const zoneID = "430ba34c138cfb5360826c4909f99be8"

new cloudflare.RegionalHostname("RegionalHostname", {
  hostname: domain,
  regionKey: "us",
  zoneId: zoneID,
})
