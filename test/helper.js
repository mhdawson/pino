'use strict'

const os = require('os')
const writer = require('flush-write-stream')
const split = require('split2')
const { existsSync, readFileSync, statSync } = require('fs')
const pid = process.pid
const hostname = os.hostname()

const isWin = process.platform === 'win32'
const isYarnPnp = process.versions.pnp !== undefined

function getPathToNull () {
  return isWin ? '\\\\.\\NUL' : '/dev/null'
}

function once (emitter, name) {
  return new Promise((resolve, reject) => {
    if (name !== 'error') emitter.once('error', reject)
    emitter.once(name, (...args) => {
      emitter.removeListener('error', reject)
      resolve(...args)
    })
  })
}

function sink (func) {
  const result = split((data) => {
    try {
      return JSON.parse(data)
    } catch (err) {
      console.log(err)
      console.log(data)
    }
  })
  if (func) result.pipe(writer.obj(func))
  return result
}

function check (is, chunk, level, msg) {
  is(new Date(chunk.time) <= new Date(), true, 'time is greater than Date.now()')
  delete chunk.time
  is(chunk.pid, pid)
  is(chunk.hostname, hostname)
  is(chunk.level, level)
  is(chunk.msg, msg)
}

function sleep (ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function watchFileCreated (filename) {
  return new Promise((resolve, reject) => {
    const TIMEOUT = 2000
    const INTERVAL = 100
    const threshold = TIMEOUT / INTERVAL
    let counter = 0
    const interval = setInterval(() => {
      const exists = existsSync(filename)
      // On some CI runs file is created but not filled
      if (exists && statSync(filename).size !== 0) {
        clearInterval(interval)
        resolve()
      } else if (counter <= threshold) {
        counter++
      } else {
        clearInterval(interval)
        reject(new Error(
          `${filename} hasn't been created within ${TIMEOUT} ms. ` +
          (exists ? 'File exist, but still empty.' : 'File not yet created.')
        ))
      }
    }, INTERVAL)
  })
}

function watchForWrite (filename, testString) {
  return new Promise((resolve, reject) => {
    const TIMEOUT = 2000
    const INTERVAL = 100
    const threshold = TIMEOUT / INTERVAL
    let counter = 0
    const interval = setInterval(() => {
      if (readFileSync(filename).includes(testString)) {
        clearInterval(interval)
        resolve()
      } else if (counter <= threshold) {
        counter++
      } else {
        clearInterval(interval)
        reject(new Error(`'${testString}' hasn't been written to ${filename} within ${TIMEOUT} ms.`))
      }
    }, INTERVAL)
  })
}

module.exports = { getPathToNull, sink, check, once, sleep, watchFileCreated, watchForWrite, isWin, isYarnPnp }
