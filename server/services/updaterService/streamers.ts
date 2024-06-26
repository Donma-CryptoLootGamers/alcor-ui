import { performance } from 'perf_hooks'
import fetch from 'cross-fetch'
import { JsonRpc } from 'enf-eosjs'

import { Match, Settings } from '../../models'
import { getSettings } from '../../utils'

function getAccountAsKey(account: string) {
  return account.replace('.', '-')
}

export async function streamByGreymass(network, account, callback, actions, delay = 500) {
  console.info(`Start NODE updater for ${network.name} (${account})...`)

  // Здесь мы юзаем свой _skip так как в коде обработки экшена он думает что там будет хайпирион скип
  const rpc = new JsonRpc(`${network.protocol}://${network.host}:${network.port}`, { fetch })
  const settings = await getSettings(network)

  let offset = settings.actions_stream_offset[getAccountAsKey(account)] || 0
  //let offset = 0

  // TODO короче тестить это все дерьмо с настройками
  console.log('start fetching actions by node from', offset, 'for', network.name, '(' + account + ')')
  while (true) {
    let r
    try {
      const startTime = performance.now()
      r = await rpc.history_get_actions(account, offset, 100)
      const endTime = performance.now()
      if (r.actions.length > 0) {
        console.log(`receive actions(${network.name}, ${account}): ${r.actions.length} -> ${Math.round(endTime - startTime)}ms`)
      }
    } catch (e) {
      // TODO Почему то не срабатывает перезапуск при ошибке сети или днс
      console.log(`getActionsByNode(${network.name}) err: `, e.message)
      await new Promise((resolve, reject) => setTimeout(resolve, delay))
      continue
    }

    for (const a of r.actions.map(a => a.action_trace)) {
      offset += 1

      if (actions.includes(a.act.name)) {
        await callback(a, network)
      }
    }

    const $set = {}

    // MongoDB does not support . in keys, so we have to convert it using getAccountAsKey
    $set[`actions_stream_offset.${getAccountAsKey(account)}`] = offset
    //$set[`actions_stream_last_block_num.${getAccountAsKey(account)}`] = offset

    await Settings.updateOne({ chain: network.name }, { $set })

    if (r.actions.length < 100) {
      //console.log(`waitForNewActions(${network.name}, ${account})...`)
      await new Promise((resolve, reject) => setTimeout(resolve, delay))
    }
  }
}

export function streamHyperion(network, app, account, callback, actions) {
  //throw new Error('Update by hyperion not implemented!')

  // const client = new HyperionSocketClient(network.hyperion, { async: true, fetch })
  // client.onConnect = async () => {
  //   const last_buy_match = await Match.findOne({ chain: network.name, type: 'buymatch' }, {}, { sort: { block_num: -1 } })
  //   const last_sell_match = await Match.findOne({ chain: network.name, type: 'sellmatch' }, {}, { sort: { block_num: -1 } })

  //   client.streamActions({
  //     contract: network.contract,
  //     action: 'sellmatch',
  //     account: network.contract,
  //     start_from: last_sell_match ? last_sell_match.block_num + 1 : 1,
  //     read_until: 0,
  //     filters: []
  //   })

  //   client.streamActions({
  //     contract: network.contract,
  //     action: 'buymatch',
  //     account: network.contract,
  //     start_from: last_buy_match ? last_buy_match.block_num + 1 : 1,
  //     read_until: 0,
  //     filters: []
  //   })

  //   // Other actions
  //   client.streamActions({ contract: network.contract, action: 'sellreceipt', account: network.contract })
  //   client.streamActions({ contract: network.contract, action: 'buyreceipt', account: network.contract })
  //   client.streamActions({ contract: network.contract, action: 'cancelsell', account: network.contract })
  //   client.streamActions({ contract: network.contract, action: 'cancelbuy', account: network.contract })
  // }

  // client.onData = async ({ content }, ack) => {
  //   await callback(content, network, app)
  //   ack()
  // }

  // client.connect(() => {
  //   console.log(`Start streaming for ${network.name}..`)
  // })
}
