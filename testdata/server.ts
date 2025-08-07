import {type ChildProcess, spawn} from "node:child_process"

let redisSrv: ChildProcess

export const port = "18543"

export function connect() {
  return new Promise((resolve, reject) => {
    redisSrv = spawn("redis-server", ["--port", port, "--loglevel", "notice"], {
      stdio: "inherit",
    })

    redisSrv.on("error", (err) => {
      reject(new Error("Error caught spawning the server:" + err.message))
    })

    setTimeout(resolve, 1500)
  })
}

export function disconnect() {
  redisSrv.kill("SIGKILL")
  return Promise.resolve()
}
