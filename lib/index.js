import got from 'got';

async function getZoneId (api, name) {
  let res

  for (let i = 1; (res = await api(`zones?page=${i}`)) && res.body.result_info.total_pages >= i; i++) {
    for (const zone of res.body.result) {
      if (zone.name === name) {
        return zone.id
      }
    }
  }

  throw new Error(`zone ${name} couldn't be found`)
}

async function getRecordId(api, zoneId){
  const res = await api(`zones/${zoneId}/web3/hostnames`)
  return res.body.result[0].id
}

function getClient (apiOpts) {
  const opts = {
    prefixUrl: 'https://api.cloudflare.com/client/v4',
    responseType: 'json'
  }

  if (apiOpts.token) {
    opts.headers = {
      Authorization: `Bearer ${apiOpts.token}`
    }
  } else {
    opts.headers = {
      'X-Auth-Email': apiOpts.email,
      'X-Auth-Key': apiOpts.key
    }
  }

  return got.extend(opts)
}

export async function update (apiOpts, { zone, link, record }) {
  const api = getClient(apiOpts)
  
  const zoneId = await getZoneId(api, zone)
  const recordId = await getRecordId(api, zoneId)

  await api.patch(`zones/${zoneId}/web3/hostnames/${recordId}`, {
    json: {
      dnslink: link
    }
  })

  return link
}