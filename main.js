const core = require('@actions/core')
const axios = require('axios')

const timeout = parseInt(core.getInput('timeout'))
if (isNaN(timeout)) {
  throw new Error('Invalid timeout, should be a positive integer representing seconds')
}
const apiKey = core.getInput('api_key')
const executionId = core.getInput('execution_id')


async function main() {
  try {
    console.log(`Waiting for execution #${executionId}!`)
  
    let [timedout, overallStatus] = await Promise.race([
      // FIXME: handle timeout properly
      new Promise(res => setTimeout(() => res(true), timeout * 1000)),
      wait(executionId)
    ])
    if (timedout) {
      overallStatus = 'timedout'
    }
    core.setOutput('overall_status', overallStatus)
    
    console.log(`Output ${overallStatus}`)
  } catch (error) {
    core.setFailed(error.message)
  }
}

async function wait(executionId) {
  return Promise.resolve()
    .then(() => check(executionId))
    .then((overallStatus) => {
      if (overallStatus === 'failed' || overallStatus === 'succeeded') return overallStatus

      process.nextTick(() => wait(executionId))
    })
}

async function check(executionId) {
  try {
    console.log(`Checking ${new Date().toISOString()}`)
    let overallStatus = 'unknown'

    const { data: { tests } } = await axios.get(`https://api.reflect.run/v1/executions/${executionId}`, {
      headers: {
        'X-API-KEY': apiKey,
      },
    })
    console.log(`Got ${JSON.stringify(tests)}`)

    // status = queued|running|succeeded|failed
    if (tests.every(({ status }) => (status === 'succeeded' || status === 'failed'))) {
      overallStatus = tests.some(({ status }) => status === 'failed') ? 'failed' : 'succeeded'
    }

    console.log(`Overall status ${overallStatus}`)

    return overallStatus
  } catch (error) {
    if (error.isAxiosError) {
      // TODO: handle network errors gracefully
    }

    throw error
  }
}


main()
