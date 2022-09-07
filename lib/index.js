const got = require('got')

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

async function getRulesetId (api, zone) {
  const res = await api(`zones/${zone}/rulesets`);

  for (const ruleset of res.body.result) {
    if (ruleset.phase === "http_request_transform") {
      return ruleset.id
    }
  }

  throw new Error(`ruleset with phase http_request_transform couldn't be found`)
}

async function getRuleIds (api, zone, rulesetId) {
  const res = await api(`zones/${zone}/rulesets/${rulesetId}`);
  const ruleIds = [];

  for (const rule of res.body.result.rules) {
    ruleIds.push(rule.id)
  }

  if(ruleIds.length > 0){
    return ruleIds;
  }

  throw new Error(`No rule found in the rulset ${rulesetId}`);
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

async function update (apiOpts, { zone, link, record }) {
  const api = getClient(apiOpts)
  
  const zoneId = await getZoneId(api, zone)
  console.log(`Found zoneId ${zoneId}`);

  const rulesetId = await getRulesetId(api, zoneId);
  console.log(`Found rulesetId ${rulesetId}`);
  
  const [ruleId1, ruleId2] = await getRuleIds(api, zoneId, rulesetId);
  console.log(`Found ruleIds ${ruleId1} and ${ruleId2}`);

  await Promise.all([
    api.patch(`zones/${zoneId}/rulesets/${rulesetId}/rules/${ruleId1}`, {
      json: {
        "action": "rewrite",
        "expression": "(http.host eq \"" + record + "\")",
        "action_parameters": {
          "uri": {
            "path": { 
              "expression": "concat(\"" + link + "\",http.request.uri.path)"
            }
          }
        },
        "description": "Redirect to /ipfs/<CID>"
      }
    }),
    api.patch(`zones/${zoneId}/rulesets/${rulesetId}/rules/${ruleId2}`, {
      json: {
        "action": "rewrite",
        "expression": "(http.host eq \"" + record + "\" and http.request.uri ne \"/\" and not http.request.uri contains \".\")",
        "action_parameters": {
          "uri": {
            "path": { 
              "expression": "concat(\"" + link + "\",http.request.uri.path,\".html\")"
            }
          }
        },
        "description": "Redirect non-html routes to .html"
      }
    })
  ]);

  return link
}

module.exports = update
