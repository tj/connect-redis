import {Cookie} from "express-session"
import {Redis} from "ioredis"
import {promisify} from "node:util"
import {createClient} from "redis"
import {expect, test} from "vitest"
import {RedisStore} from "./"
import * as redisSrv from "./testdata/server"

test("setup", async () => {
  await redisSrv.connect()
})


